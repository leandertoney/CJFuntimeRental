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
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const {
      bookingRef,
      vehicleKey,
      vehicleType,
      front,          // base64 (data URL ok)
      back,           // base64 (data URL ok)
      frontType,      // MIME
      backType,       // MIME
      agreementAccepted,
      agreementVersion
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
      agreed_at: new Date().toISOString()
    }, { onConflict: 'booking_ref' });
    if (dbErr) throw dbErr;

    return json({ ok: true, bookingRef, requiresCanamCheck: canamCheck });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return json({ error: 'Upload failed. Please try again.' }, 500);
  }
});
