// Phase 2: ID Upload + Rental Agreement Feature
// Handles government photo ID uploads (front+back) to private storage
// Deployed: 2026-07-06
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';
import { AGREEMENT_VERSION, RENTAL_AGREEMENT_TEXT } from '../_shared/rental-agreement.ts';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

// Service-role client — the ONLY thing allowed to touch the private booking-ids
// bucket. The browser never gets storage credentials for this bucket.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKET = 'booking-ids';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file (matches bucket limit)
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// Decode a base64 payload (with or without a data: URL prefix) to bytes.
function decodeBase64(input: string): Uint8Array {
  const comma = input.indexOf(',');
  const b64 = input.startsWith('data:') && comma !== -1 ? input.slice(comma + 1) : input;
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Basic UUID shape check for the client-generated booking reference.
function isValidRef(ref: unknown): ref is string {
  return typeof ref === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
}

// Additional-driver names are shown back to admins in the dashboard, so keep
// them short and strip anything that is not plausibly part of a name.
function cleanName(input: unknown): string {
  return typeof input === 'string' ? input.replace(/[<>]/g, '').trim().slice(0, 120) : '';
}

// Decode + validate one side of an ID image. Returns bytes or an error message.
function readImage(b64: unknown, mime: unknown): { bytes?: Uint8Array; error?: string } {
  if (!b64) return { error: 'Both front and back ID images are required.' };
  if (typeof mime !== 'string' || !ALLOWED_MIME[mime]) {
    return { error: 'ID images must be JPEG, PNG, WEBP, or PDF.' };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(b64 as string);
  } catch {
    return { error: 'Could not read the uploaded images.' };
  }
  if (bytes.length === 0) return { error: 'Uploaded images appear to be empty.' };
  if (bytes.length > MAX_BYTES) return { error: 'Each ID image must be 10 MB or smaller.' };
  return { bytes };
}

// Store one driver's front/back pair in the private bucket under the booking
// reference. `prefix` is '' for the primary renter and 'driver2-' for the
// additional driver, giving <ref>/front.jpg and <ref>/driver2-front.jpg.
async function storePair(
  bookingRef: string,
  prefix: string,
  front: { bytes: Uint8Array; mime: string },
  back: { bytes: Uint8Array; mime: string }
): Promise<{ frontPath: string; backPath: string }> {
  const frontPath = `${bookingRef}/${prefix}front.${ALLOWED_MIME[front.mime]}`;
  const backPath = `${bookingRef}/${prefix}back.${ALLOWED_MIME[back.mime]}`;

  const up1 = await supabase.storage.from(BUCKET)
    .upload(frontPath, front.bytes, { contentType: front.mime, upsert: true });
  if (up1.error) throw up1.error;

  const up2 = await supabase.storage.from(BUCKET)
    .upload(backPath, back.bytes, { contentType: back.mime, upsert: true });
  if (up2.error) throw up2.error;

  return { frontPath, backPath };
}

// ── Post-booking additional-driver upload (token mode) ──────────────────────
// The admin can add a second driver to an existing booking; the customer gets
// an emailed link carrying a single-use token. That link is the ONLY way this
// path is reachable, so the token is what authorises the write. It expires and
// is cleared once the images land.
async function loadByToken(token: string) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{24,128}$/.test(token)) return null;
  const { data } = await supabase
    .from('id_uploads')
    .select('booking_ref, vehicle_type, driver2_name, driver2_front_path, driver2_token_expires_at')
    .eq('driver2_upload_token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.driver2_token_expires_at && new Date(data.driver2_token_expires_at) < new Date()) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // GET /id-upload?token=... — the upload page asks what this link is for, so it
  // can show the right ID rules (Can-Am needs a licence, Slingshot any photo ID).
  if (req.method === 'GET') {
    try {
      const token = new URL(req.url).searchParams.get('token') || '';
      const row = await loadByToken(token);
      if (!row) return json({ error: 'This link is no longer valid. Please ask CJ Funtime Rentals for a new one.' }, 404);
      return json({
        ok: true,
        driverName: row.driver2_name || '',
        vehicleType: row.vehicle_type === 'canam' ? 'canam' : 'slingshot',
        alreadyUploaded: !!row.driver2_front_path
      });
    } catch (err) {
      Sentry.captureException(err);
      await Sentry.flush(2000);
      return json({ error: 'Could not open this link. Please try again.' }, 500);
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();

    // ── Token mode: additional driver uploading after the booking exists ─────
    if (body && body.token) {
      const row = await loadByToken(body.token);
      if (!row) return json({ error: 'This link is no longer valid. Please ask CJ Funtime Rentals for a new one.' }, 404);

      const f = readImage(body.front, body.frontType);
      if (f.error) return json({ error: f.error }, 400);
      const b = readImage(body.back, body.backType);
      if (b.error) return json({ error: b.error }, 400);

      const vType = row.vehicle_type === 'canam' ? 'canam' : 'slingshot';
      const paths = await storePair(
        row.booking_ref,
        'driver2-',
        { bytes: f.bytes!, mime: body.frontType },
        { bytes: b.bytes!, mime: body.backType }
      );

      // Targeted update, never an upsert: this row already holds the primary
      // renter's ID and agreement and must not be replaced.
      const { error: updErr } = await supabase.from('id_uploads')
        .update({
          driver2_front_path: paths.frontPath,
          driver2_back_path: paths.backPath,
          driver2_required_id_type: vType === 'canam' ? 'drivers_license' : 'photo_id',
          driver2_canam_license_check_required: vType === 'canam',
          driver2_upload_token: null,        // single use
          driver2_token_expires_at: null
        })
        .eq('booking_ref', row.booking_ref);
      if (updErr) throw updErr;

      // Mirror onto the booking so the admin list shows the second driver's
      // Can-Am check without joining id_uploads.
      await supabase.from('bookings')
        .update({
          driver2_id_upload_status: 'received',
          driver2_requires_canam_license_check: vType === 'canam'
        })
        .eq('id_ref', row.booking_ref);

      return json({ ok: true, driverName: row.driver2_name || '' });
    }

    const {
      bookingRef,
      vehicleKey,
      vehicleType,
      front,          // base64 (data URL ok)
      back,           // base64 (data URL ok)
      frontType,      // MIME
      backType,       // MIME
      agreementAccepted,
      agreementVersion,
      // Optional additional driver. Every field below is optional on purpose:
      // a cached copy of the old checkout.html sends none of them and must keep
      // working exactly as before.
      driver2Name,
      driver2Front,
      driver2Back,
      driver2FrontType,
      driver2BackType
    } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!isValidRef(bookingRef)) return json({ error: 'Invalid booking reference' }, 400);

    const vType = vehicleType === 'canam' ? 'canam' : 'slingshot';

    if (!front || !back) {
      return json({ error: 'Both front and back ID images are required.' }, 400);
    }
    if (!ALLOWED_MIME[frontType] || !ALLOWED_MIME[backType]) {
      return json({ error: 'ID images must be JPEG, PNG, WEBP, or PDF.' }, 400);
    }
    if (agreementAccepted !== true) {
      return json({ error: 'You must accept the rental agreement.' }, 400);
    }
    // We store the server-side agreement text (source of truth), not client text.
    // The version the client saw must match what we're storing.
    if (agreementVersion && agreementVersion !== AGREEMENT_VERSION) {
      return json({ error: 'Rental agreement is out of date. Please reload and try again.' }, 409);
    }

    // ── Additional driver (optional) ─────────────────────────────────────────
    // Present only when the renter ticked "add an additional driver". Same ID
    // rules as the primary: any government photo ID for a Slingshot, a driver's
    // licence for the Can-Am (flagged for a manual M-endorsement check).
    const hasDriver2 = !!(driver2Name || driver2Front || driver2Back);
    const driver2CleanName = cleanName(driver2Name);
    let d2Front: Uint8Array | null = null;
    let d2Back: Uint8Array | null = null;

    if (hasDriver2) {
      if (!driver2CleanName) {
        return json({ error: "Please enter the additional driver's full name." }, 400);
      }
      const f2 = readImage(driver2Front, driver2FrontType);
      if (f2.error) return json({ error: `Additional driver: ${f2.error}` }, 400);
      const b2 = readImage(driver2Back, driver2BackType);
      if (b2.error) return json({ error: `Additional driver: ${b2.error}` }, 400);
      d2Front = f2.bytes!;
      d2Back = b2.bytes!;
    }

    let frontBytes: Uint8Array, backBytes: Uint8Array;
    try {
      frontBytes = decodeBase64(front);
      backBytes = decodeBase64(back);
    } catch {
      return json({ error: 'Could not read the uploaded images.' }, 400);
    }
    if (frontBytes.length === 0 || backBytes.length === 0) {
      return json({ error: 'Uploaded images appear to be empty.' }, 400);
    }
    if (frontBytes.length > MAX_BYTES || backBytes.length > MAX_BYTES) {
      return json({ error: 'Each ID image must be 10 MB or smaller.' }, 400);
    }

    // ── Store to the PRIVATE bucket (service role) ────────────────────────────
    const frontPath = `${bookingRef}/front.${ALLOWED_MIME[frontType]}`;
    const backPath = `${bookingRef}/back.${ALLOWED_MIME[backType]}`;

    const up1 = await supabase.storage.from(BUCKET)
      .upload(frontPath, frontBytes, { contentType: frontType, upsert: true });
    if (up1.error) throw up1.error;

    const up2 = await supabase.storage.from(BUCKET)
      .upload(backPath, backBytes, { contentType: backType, upsert: true });
    if (up2.error) throw up2.error;

    let driver2Paths: { frontPath: string; backPath: string } | null = null;
    if (hasDriver2) {
      driver2Paths = await storePair(
        bookingRef,
        'driver2-',
        { bytes: d2Front!, mime: driver2FrontType },
        { bytes: d2Back!, mime: driver2BackType }
      );
    }

    // ── Record the upload + agreement snapshot ────────────────────────────────
    const requiredIdType = vType === 'canam' ? 'drivers_license' : 'photo_id';
    const canamCheck = vType === 'canam';

    const { error: dbErr } = await supabase.from('id_uploads').upsert({
      booking_ref: bookingRef,
      vehicle_key: vehicleKey || null,
      vehicle_type: vType,
      required_id_type: requiredIdType,
      front_path: frontPath,
      back_path: backPath,
      canam_license_check_required: canamCheck,
      agreement_version: AGREEMENT_VERSION,
      agreement_text: RENTAL_AGREEMENT_TEXT,
      agreed_at: new Date().toISOString(),
      driver2_name: hasDriver2 ? driver2CleanName : null,
      driver2_front_path: driver2Paths?.frontPath || null,
      driver2_back_path: driver2Paths?.backPath || null,
      driver2_required_id_type: hasDriver2 ? requiredIdType : null,
      driver2_canam_license_check_required: hasDriver2 ? canamCheck : false,
      driver2_added_at: hasDriver2 ? new Date().toISOString() : null,
      driver2_added_by: hasDriver2 ? 'booking_flow' : null
    }, { onConflict: 'booking_ref' });
    if (dbErr) throw dbErr;

    return json({
      ok: true,
      bookingRef,
      requiresCanamCheck: canamCheck,
      additionalDriver: hasDriver2 ? driver2CleanName : null
    });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return json({ error: 'Upload failed. Please try again.' }, 500);
  }
});
