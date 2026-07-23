import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('ADMIN_TOKEN_SECRET') || SERVICE_KEY;

// Service client — bypasses RLS, used for all data operations
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── SHA-256 password hashing (Web Crypto) ───────────────────────────────────
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Admin users — pre-computed SHA-256 hashes only (no plaintext passwords in
// source). To rotate a password: sha256 the new one and replace the hash here.
const ADMIN_USERS: { email: string; name: string; hash: string }[] = [
  { email: 'leandertoney@gmail.com',    name: 'Leander', hash: '8cf7a5b981c18b79bc36f7796887c317e50800649ac813ba207f0da984950f1a' },
  { email: 'chrisjohnson839@gmail.com', name: 'Chris',   hash: '284230bf951f50c8eb985d8a192635f79227ed655669f3b2044906af3a4a18be' },
];

// Admin API is only ever called from the production site (and localhost dev)
const CORS = {
  'Access-Control-Allow-Origin': 'https://cjfuntimerentals.com',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// ── Per-IP login rate limit (in-memory; resets on cold start, which is fine —
// its job is to blunt online brute-force, not be a perfect counter) ──────────
const loginAttempts = new Map<string, { count: number; first: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count++;
  return rec.count > LOGIN_MAX_ATTEMPTS;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// ── HMAC token helpers ──────────────────────────────────────────────────────
// Unicode-safe base64 (btoa throws on chars > 0xFF; encode UTF-8 bytes instead)
function b64encodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decodeUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '');
}

async function createToken(email: string, name: string): Promise<string> {
  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload = JSON.stringify({ email, name, exp });
  const b64 = b64encodeUtf8(payload);
  const sig = await hmacSign(b64);
  return b64 + '.' + sig;
}

async function verifyToken(token: string): Promise<{ email: string; name: string } | null> {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = await hmacSign(b64);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64decodeUtf8(b64));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { email: payload.email, name: payload.name };
  } catch { return null; }
}

async function verifyAuth(req: Request): Promise<{ email: string; name: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return await verifyToken(token);
}

// ── AI Chat helpers ──────────────────────────────────────────────────────────

const ADMIN_TOOLS = [
  { type: 'function', function: { name: 'get_vehicles', description: 'Read all vehicles with names, daily rates, availability, and all detail fields.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'update_vehicle', description: "Update any fields on an existing vehicle. Can change ratePerDay, available, name, label, tag, specs, img, badges, tagline, specsList, features, safety, connectivity, included, reviews.", parameters: { type: 'object', properties: { vehicleKey: { type: 'string', description: 'The vehicle key (e.g. slingshot_2022)' }, ratePerDay: { type: 'number' }, available: { type: 'boolean' }, name: { type: 'string' }, label: { type: 'string' }, tag: { type: 'string' }, specs: { type: 'string' }, img: { type: 'string' }, tagline: { type: 'string' }, badges: { type: 'array', items: { type: 'string' } }, specsList: { type: 'array', items: { type: 'string' } }, features: { type: 'array', items: { type: 'string' } }, safety: { type: 'array', items: { type: 'string' } }, connectivity: { type: 'array', items: { type: 'string' } }, included: { type: 'array', items: { type: 'string' } }, reviews: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rating: { type: 'number' }, text: { type: 'string' } } } } }, required: ['vehicleKey'] } } },
  { type: 'function', function: { name: 'add_vehicle', description: 'Add a new vehicle to the fleet. Provide a unique vehicleKey (lowercase_with_underscores), name, label, ratePerDay, img (filename), tag, specs (short string), and optionally all detail arrays.', parameters: { type: 'object', properties: { vehicleKey: { type: 'string', description: 'Unique key like slingshot_2024 or vanderhall_venice' }, name: { type: 'string' }, label: { type: 'string' }, ratePerDay: { type: 'number' }, img: { type: 'string' }, tag: { type: 'string' }, specs: { type: 'string' }, tagline: { type: 'string' }, badges: { type: 'array', items: { type: 'string' } }, specsList: { type: 'array', items: { type: 'string' } }, features: { type: 'array', items: { type: 'string' } }, safety: { type: 'array', items: { type: 'string' } }, connectivity: { type: 'array', items: { type: 'string' } }, included: { type: 'array', items: { type: 'string' } }, reviews: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rating: { type: 'number' }, text: { type: 'string' } } } } }, required: ['vehicleKey', 'name', 'ratePerDay'] } } },
  { type: 'function', function: { name: 'delete_vehicle', description: 'Remove a vehicle from the fleet by its key.', parameters: { type: 'object', properties: { vehicleKey: { type: 'string' } }, required: ['vehicleKey'] } } },
  { type: 'function', function: { name: 'update_all_vehicle_rates', description: 'Set the same ratePerDay for every vehicle.', parameters: { type: 'object', properties: { ratePerDay: { type: 'number' } }, required: ['ratePerDay'] } } },
  { type: 'function', function: { name: 'get_leads', description: 'Read all leads with email, source, date, promo code.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'delete_lead', description: 'Delete a lead by email.', parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_lead', description: 'Send a discount code email to a single lead.', parameters: { type: 'object', properties: { email: { type: 'string' }, code: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_all_leads', description: 'Send a discount code email to every lead.', parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } } },
  { type: 'function', function: { name: 'get_discounts', description: 'Read discount tiers — days, percentage, label, enabled.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'get_blocked_dates', description: 'Read all blocked dates unavailable for booking.', parameters: { type: 'object', properties: {}, required: [] } } },
];

async function readConfig() {
  const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
  return data?.config;
}

async function writeConfig(cfg: unknown) {
  await supabase.from('site_config').upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() });
}

async function executeToolCall(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'get_vehicles': {
      const cfg = await readConfig();
      return { vehicles: cfg?.vehicles };
    }
    case 'update_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      const v = cfg?.vehicles?.[key];
      if (!v) return { error: 'Unknown vehicle key: ' + key };
      const editableFields = ['ratePerDay','available','name','label','tag','specs','type','img','tagline','badges','specsList','features','safety','connectivity','included','reviews'];
      for (const f of editableFields) {
        if (input[f] !== undefined) (v as Record<string, unknown>)[f] = input[f];
      }
      await writeConfig(cfg);
      return { ok: true, updated: v };
    }
    case 'add_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      if (cfg.vehicles[key]) return { error: 'Vehicle key already exists: ' + key };
      cfg.vehicles[key] = {
        available: true,
        name: input.name || key,
        label: input.label || input.name || key,
        tag: input.tag || '',
        specs: input.specs || '',
        type: input.type || (key.includes('canam') ? 'canam' : 'slingshot'),
        ratePerDay: input.ratePerDay || 0,
        img: input.img || '',
        badges: input.badges || [],
        tagline: input.tagline || '',
        specsList: input.specsList || [],
        features: input.features || [],
        safety: input.safety || [],
        connectivity: input.connectivity || [],
        included: input.included || [],
        reviews: input.reviews || [],
        stripeProductId: '',
      };
      await writeConfig(cfg);
      return { ok: true, added: key, vehicle: cfg.vehicles[key] };
    }
    case 'delete_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      if (!cfg.vehicles[key]) return { error: 'Vehicle not found: ' + key };
      const deleted = cfg.vehicles[key];
      delete cfg.vehicles[key];
      await writeConfig(cfg);
      return { ok: true, deleted: key, vehicle: deleted };
    }
    case 'update_all_vehicle_rates': {
      const cfg = await readConfig();
      for (const key of Object.keys(cfg.vehicles)) {
        cfg.vehicles[key].ratePerDay = input.ratePerDay;
      }
      await writeConfig(cfg);
      return { ok: true, ratePerDay: input.ratePerDay };
    }
    case 'get_leads': {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return { count: data?.length ?? 0, leads: data };
    }
    case 'delete_lead': {
      const { data } = await supabase.from('leads').select('id, email').ilike('email', input.email as string);
      if (!data?.length) return { error: 'Lead not found: ' + input.email };
      await supabase.from('leads').delete().eq('id', data[0].id);
      return { ok: true, deleted: input.email };
    }
    case 'send_promo_to_lead': {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
      const code = (input.code as string) || 'FIRST10';
      await resend.emails.send({
        from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
        to: input.email as string,
        subject: `Your ${code} discount code — CJ's Fun Time Rental`,
        html: `<p>Your code: <strong>${code}</strong></p>`
      });
      return { ok: true, sentTo: input.email, code };
    }
    case 'send_promo_to_all_leads': {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
      const { data: leads } = await supabase.from('leads').select('email');
      const results = [];
      for (const lead of (leads ?? [])) {
        try {
          await resend.emails.send({
            from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
            to: lead.email,
            subject: `Your ${input.code} discount code — CJ's Fun Time Rental`,
            html: `<p>Your code: <strong>${input.code}</strong></p>`
          });
          results.push({ email: lead.email, sent: true });
        } catch (e) {
          results.push({ email: lead.email, sent: false, error: (e as Error).message });
        }
      }
      return { ok: true, results };
    }
    case 'get_discounts': {
      const cfg = await readConfig();
      return { discounts: cfg?.discounts };
    }
    case 'get_blocked_dates': {
      const cfg = await readConfig();
      return { blockedDates: cfg?.blockedDates, count: cfg?.blockedDates?.length ?? 0 };
    }
    default:
      return { error: 'Unknown tool: ' + name };
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin/, '');

  // ── Login (public) ─────────────────────────────────────────────────────────
  if (path === '/login' && req.method === 'POST') {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (loginRateLimited(ip)) {
      return json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429);
    }
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);
    const user = ADMIN_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    const pwHash = await sha256(password);
    if (!user || user.hash !== pwHash) {
      return json({ error: 'Invalid email or password' }, 401);
    }
    loginAttempts.delete(ip); // successful login clears the counter
    const token = await createToken(user.email, user.name);
    return json({ ok: true, token, name: user.name, email: user.email });
  }

  // ── Me (public — returns logged-in status) ────────────────────────────────
  if (path === '/me' && req.method === 'GET') {
    const user = await verifyAuth(req);
    if (user) return json({ loggedIn: true, name: user.name, email: user.email });
    return json({ loggedIn: false });
  }

  // All other endpoints require a valid token
  const authedUser = await verifyAuth(req);
  if (!authedUser) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Change password ────────────────────────────────────────────────────────
  // NOTE: this only mutates the in-memory hash and is LOST on cold start.
  // Permanent rotation = update the hash constant in ADMIN_USERS and redeploy.
  if (path === '/change-password' && req.method === 'POST') {
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) return json({ error: 'Both passwords required' }, 400);
    if (newPassword.length < 8) return json({ error: 'New password must be at least 8 characters' }, 400);
    const user = ADMIN_USERS.find(u => u.email === authedUser.email);
    const curHash = await sha256(currentPassword);
    if (!user || user.hash !== curHash) {
      return json({ error: 'Current password is incorrect' }, 401);
    }
    user.hash = await sha256(newPassword);
    return json({ ok: true });
  }

  // ── Config ──────────────────────────────────────────────────────────────────
  if (path === '/config' && req.method === 'GET') {
    const { data, error } = await supabase.from('site_config').select('config').eq('id', 1).single();
    if (error) return json({ error: error.message }, 500);
    return json(data.config);
  }

  if (path === '/config' && req.method === 'POST') {
    const incoming = await req.json();
    const required = ['sections', 'vehicles', 'copy', 'faqs', 'discounts', 'blockedDates'];
    for (const key of required) {
      if (!(key in incoming)) return json({ error: 'Missing key: ' + key }, 400);
    }
    incoming._lastSaved = new Date().toISOString();
    const { error } = await supabase.from('site_config').upsert({ id: 1, config: incoming, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Leads ───────────────────────────────────────────────────────────────────
  if (path === '/leads' && req.method === 'GET') {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  if (path.startsWith('/leads/') && req.method === 'DELETE') {
    const id = path.replace('/leads/', '');
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Bookings ────────────────────────────────────────────────────────────────
  if (path === '/bookings' && req.method === 'GET') {
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);

    // Filter out test bookings and transform snake_case to camelCase
    const bookings = (data || [])
      .filter((booking: any) => !booking.id.startsWith('test_') && !booking.email.includes('test') && !booking.email.includes('@example.com'))
      .map((booking: any) => ({
        ...booking,
        startDate: booking.start_date,
        endDate: booking.end_date,
        createdAt: booking.created_at,
        stripeSessionId: booking.stripe_session_id,
        deliveryDropoff: booking.delivery_dropoff,
        deliveryPickup: booking.delivery_pickup,
        deliveryAddress: booking.delivery_address,
        pickupLocation: booking.pickup_location,
        pickupTime: booking.pickup_time,
        pickupInstructions: booking.pickup_instructions
      }));

    return json(bookings);
  }

  // ── PUT /bookings/:id — Update booking details (incl. reschedule) ──────────
  // Whitelisted fields only. Date changes run a full availability-conflict
  // check (other confirmed bookings, per-vehicle blocks, fleet-wide blocked
  // dates) and recompute `days`.
  if (path.match(/^\/bookings\/[^/]+$/) && req.method === 'PUT') {
    const bookingId = path.split('/')[2];
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

    const ALLOWED_FIELDS = [
      'pickup_location', 'pickup_address', 'pickup_time', 'fuel_level', 'pickup_instructions',
      'return_location', 'return_address', 'return_time', 'key_drop_location', 'return_instructions',
      'start_date', 'end_date'
    ];
    const updates: Record<string, unknown> = {};
    for (const f of ALLOWED_FIELDS) {
      if (f in body) updates[f] = body[f];
    }
    if (Object.keys(updates).length === 0) return json({ error: 'No valid fields to update' }, 400);

    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, vehicle, vehicle_key, start_date, end_date, days, total, status, delivery_dropoff, delivery_pickup')
      .eq('id', bookingId)
      .maybeSingle();
    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!existing) return json({ error: 'Booking not found' }, 404);

    const newStart = String(updates.start_date ?? existing.start_date);
    const newEnd = String(updates.end_date ?? existing.end_date);
    const dateChanged = newStart !== existing.start_date || newEnd !== existing.end_date;

    if (dateChanged) {
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      if (!ISO_DATE.test(newStart) || !ISO_DATE.test(newEnd)) {
        return json({ error: 'Dates must be in YYYY-MM-DD format' }, 400);
      }
      if (newEnd < newStart) {
        return json({ error: 'end_date cannot be before start_date' }, 400);
      }

      // Prefer exact vehicle_key match (set on every booking since 2026-07-15).
      // Legacy bookings without a stored key fall back to fuzzy display-name
      // matching, which cannot tell apart vehicles that share a name (e.g. the
      // two 2016 Slingshots) — only used when we have nothing better.
      const bookingVehicle = (existing.vehicle || '').toLowerCase();
      const sameVehicle = (b: { vehicle: string; vehicle_key?: string | null }) => {
        if (existing.vehicle_key && b.vehicle_key) return b.vehicle_key === existing.vehicle_key;
        const v = (b.vehicle || '').toLowerCase();
        return v === bookingVehicle || v.includes(bookingVehicle) || bookingVehicle.includes(v);
      };

      // 1) Other confirmed bookings on the same vehicle that overlap the new range
      const { data: others, error: bErr } = await supabase
        .from('bookings')
        .select('id, vehicle, vehicle_key, start_date, end_date')
        .eq('status', 'confirmed')
        .neq('id', bookingId)
        .lte('start_date', newEnd)
        .gte('end_date', newStart);
      if (bErr) return json({ error: bErr.message }, 500);

      const bookingConflict = (others || []).find(sameVehicle);
      if (bookingConflict) {
        return json({
          error: `Vehicle already booked ${bookingConflict.start_date} → ${bookingConflict.end_date} (booking ${bookingConflict.id})`
        }, 409);
      }

      // 2) Per-vehicle manual blocks + 3) fleet-wide blocked dates
      const { data: cfgRow } = await supabase.from('site_config').select('config').eq('id', 1).single();
      const cfg = cfgRow?.config || {};

      // Resolve the booking's own vehicle key: prefer the stored column, else
      // fall back to matching config vehicles by display name (legacy bookings).
      const vehicleKeys = existing.vehicle_key
        ? [existing.vehicle_key]
        : Object.entries(cfg.vehicles || {})
            .filter(([key, v]) =>
              sameVehicle({ vehicle: (v as { name?: string })?.name || '' }) ||
              sameVehicle({ vehicle: key.replace(/_/g, ' ') }))
            .map(([key]) => key);

      if (vehicleKeys.length > 0) {
        const { data: blocks, error: vbErr } = await supabase
          .from('vehicle_blocks')
          .select('vehicle_key, start_date, end_date, reason')
          .in('vehicle_key', vehicleKeys)
          .lte('start_date', newEnd)
          .gte('end_date', newStart);
        if (vbErr) return json({ error: vbErr.message }, 500);
        if (blocks && blocks.length > 0) {
          const blk = blocks[0];
          return json({
            error: `Vehicle blocked ${blk.start_date} → ${blk.end_date}${blk.reason ? ' (' + blk.reason + ')' : ''}`
          }, 409);
        }
      }

      const blockedDates: string[] = Array.isArray(cfg.blockedDates) ? cfg.blockedDates : [];
      if (blockedDates.length > 0) {
        for (let d = new Date(newStart + 'T00:00:00Z'); d <= new Date(newEnd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
          const iso = d.toISOString().split('T')[0];
          if (blockedDates.includes(iso)) {
            return json({ error: `Date ${iso} is blocked fleet-wide` }, 409);
          }
        }
      }

      // Recompute rental length (calendar days, minimum 1 — matches existing data model)
      const msPerDay = 24 * 60 * 60 * 1000;
      const diff = Math.round((new Date(newEnd + 'T00:00:00Z').getTime() - new Date(newStart + 'T00:00:00Z').getTime()) / msPerDay);
      const newDays = Math.max(1, diff === 0 ? 1 : diff);
      updates.days = newDays;

      // 4) Price-difference guardrail (v1: date-change only, no price changes).
      // Flat ratePerDay pricing today means this never actually differs, but
      // if day-of-week/seasonal pricing is ever added, this stops a silent
      // price change and requires an explicit admin override.
      // Skipped when delivery was involved: `total` includes a delivery fee
      // that isn't broken out on the booking row, so rate*days can't be
      // compared against it without a false positive on every delivery booking.
      const hasDelivery = !!(existing.delivery_dropoff || existing.delivery_pickup);
      if (!hasDelivery && vehicleKeys.length > 0 && !body.confirmPriceChange) {
        const rate = Number((cfg.vehicles || {})?.[vehicleKeys[0]]?.ratePerDay);
        if (Number.isFinite(rate) && Number.isFinite(existing.total) && existing.days > 0) {
          const expectedTotal = rate * newDays;
          if (Math.abs(expectedTotal - Number(existing.total)) > 0.01) {
            return json({
              warning: 'price_mismatch',
              error: `New dates would price at $${expectedTotal.toFixed(2)} vs the $${Number(existing.total).toFixed(2)} already paid. Confirm to proceed without changing the charged amount, or handle the price difference manually.`,
              currentTotal: existing.total,
              expectedTotal
            }, 409);
          }
        }
      }

      // Re-arm automated emails for the new dates (dedup stamps cleared)
      updates.pickup_reminder_sent_at = null;
      updates.return_instructions_sent_at = null;
      updates.midrental_checkin_sent_at = null;
    }

    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single();
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, booking: updated, dateChanged });
  }

  // ── GET /bookings/:id/id — ID images (signed) + rental agreement ───────────
  // Returns short-lived signed URLs for the private ID images. The bucket is
  // private, so these URLs are the ONLY way to view an ID, and only an
  // authenticated admin can mint them.
  if (path.match(/^\/bookings\/[^/]+\/id$/) && req.method === 'GET') {
    const bookingId = path.split('/')[2];

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, id_ref, requires_canam_license_check, canam_license_verified, canam_verified_by, canam_verified_at, agreement_version, agreement_text, agreed_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return json({ error: 'Booking not found' }, 404);
    if (!booking.id_ref) return json({ hasUpload: false });

    const { data: upload } = await supabase
      .from('id_uploads')
      .select('front_path, back_path, required_id_type, vehicle_type')
      .eq('booking_ref', booking.id_ref)
      .maybeSingle();

    if (!upload) return json({ hasUpload: false });

    const [frontSigned, backSigned] = await Promise.all([
      supabase.storage.from('booking-ids').createSignedUrl(upload.front_path, 900),
      supabase.storage.from('booking-ids').createSignedUrl(upload.back_path, 900)
    ]);

    return json({
      hasUpload: true,
      requiredIdType: upload.required_id_type,
      vehicleType: upload.vehicle_type,
      requiresCanamCheck: !!booking.requires_canam_license_check,
      canamVerified: !!booking.canam_license_verified,
      canamVerifiedBy: booking.canam_verified_by || null,
      canamVerifiedAt: booking.canam_verified_at || null,
      agreementVersion: booking.agreement_version || null,
      agreementText: booking.agreement_text || null,
      agreedAt: booking.agreed_at || null,
      frontUrl: frontSigned.data?.signedUrl || null,
      backUrl: backSigned.data?.signedUrl || null
    });
  }

  // ── POST /bookings/:id/verify-canam — admin confirms the M endorsement ─────
  // We do NOT read the license automatically. This records that an admin
  // manually eyeballed the motorcycle (M) endorsement on the uploaded license.
  if (path.match(/^\/bookings\/[^/]+\/verify-canam$/) && req.method === 'POST') {
    const bookingId = path.split('/')[2];
    const verifiedAt = new Date().toISOString();

    const { data: booking, error } = await supabase
      .from('bookings')
      .update({
        canam_license_verified: true,
        canam_verified_by: authedUser.email,
        canam_verified_at: verifiedAt
      })
      .eq('id', bookingId)
      .select('id, id_ref')
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!booking) return json({ error: 'Booking not found' }, 404);

    if (booking.id_ref) {
      await supabase.from('id_uploads')
        .update({
          canam_license_verified: true,
          canam_verified_by: authedUser.email,
          canam_verified_at: verifiedAt
        })
        .eq('booking_ref', booking.id_ref);
    }

    return json({ ok: true, verifiedBy: authedUser.email, verifiedAt });
  }

  // ── POST /bookings/:id/refund-deposit — vehicle returned, refund the $100 ──
  // Refunds ONLY the deposit portion of the original payment via the Stripe
  // Refunds API (partial refund on the payment intent). Idempotent: a second
  // call is rejected once deposit_refunded_at is set, and the Stripe request
  // carries an idempotency key tied to the booking id as a backstop.
  if (path.match(/^\/bookings\/[^/]+\/refund-deposit$/) && req.method === 'POST') {
    const bookingId = path.split('/')[2];

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, deposit_cents, deposit_refunded_at, stripe_payment_intent, stripe_session_id, email, name')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!booking) return json({ error: 'Booking not found' }, 404);
    if (!booking.deposit_cents || booking.deposit_cents <= 0) {
      return json({ error: 'No deposit was collected on this booking.' }, 400);
    }
    if (booking.deposit_refunded_at) {
      return json({ error: 'Deposit was already refunded on ' + booking.deposit_refunded_at + '.' }, 409);
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    // Resolve the payment intent (older bookings may not have it stored).
    let paymentIntent = booking.stripe_payment_intent;
    if (!paymentIntent && booking.stripe_session_id) {
      const sessRes = await fetch(
        'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(booking.stripe_session_id),
        { headers: { 'Authorization': 'Bearer ' + stripeKey } }
      );
      const sess = await sessRes.json();
      paymentIntent = sess?.payment_intent || null;
    }
    if (!paymentIntent) {
      return json({ error: 'Could not find the Stripe payment for this booking.' }, 500);
    }

    const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': 'deposit-refund-' + bookingId
      },
      body: new URLSearchParams({
        payment_intent: paymentIntent,
        amount: String(booking.deposit_cents),
        'metadata[reason]': 'reservation_deposit_refund',
        'metadata[bookingId]': bookingId,
        'metadata[refundedBy]': authedUser.email
      })
    });
    const refund = await refundRes.json();
    if (refund.error) return json({ error: 'Stripe refund failed: ' + refund.error.message }, 502);

    const refundedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        deposit_refunded_at: refundedAt,
        deposit_refund_id: refund.id,
        deposit_refunded_by: authedUser.email
      })
      .eq('id', bookingId);
    if (updErr) {
      // Refund went through but the DB write failed — surface loudly so the
      // admin knows not to click again on another device.
      return json({ ok: true, warning: 'Refund succeeded (' + refund.id + ') but recording it failed: ' + updErr.message, refundId: refund.id, refundedAt }, 200);
    }

    return json({ ok: true, refundId: refund.id, refundedAt, amountCents: booking.deposit_cents });
  }

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  if (path === '/chat' && req.method === 'POST') {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json({ reply: 'AI assistant is not configured.', suggestions: [] });

    const { message } = await req.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return json({ reply: 'Please provide a message.', suggestions: [] });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are CJ Assistant, a helpful admin tool for CJ's Fun Time Rental — a 3-wheel vehicle rental business in Lancaster, PA. Use tools to execute commands. Today: ${today}. Use get_vehicles to see current fleet. You can add_vehicle, update_vehicle (any field), and delete_vehicle. Vehicle keys are lowercase_with_underscores (e.g. slingshot_2024).`;

    const messages: unknown[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message.trim() }
    ];

    let loopCount = 0;
    while (loopCount++ < 10) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', tools: ADMIN_TOOLS, messages })
      });
      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) break;
      messages.push(choice.message);
      if (choice.finish_reason === 'stop') break;
      if (choice.finish_reason === 'tool_calls') {
        for (const toolCall of choice.message.tool_calls) {
          const toolInput = JSON.parse(toolCall.function.arguments);
          const result = await executeToolCall(toolCall.function.name, toolInput);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }
      } else break;
    }

    const jsonSystemPrompt = `You are CJ Assistant for CJ's Fun Time Rental. Guide the admin with clickable chips. You can manage vehicles (add, update, delete), leads, promos, discounts, and blocked dates. REPLY: 1 sentence max, plain text, no markdown. CHIPS: 3-6 specific, actionable options. Respond ONLY with valid JSON: {"reply":"...","chips":["...","...","..."]}`;

    const jsonRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: jsonSystemPrompt }, ...messages.slice(1)]
      })
    });
    const jsonData = await jsonRes.json();

    let reply = 'Done.';
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(jsonData.choices[0].message.content);
      reply       = parsed.reply   || 'Done.';
      suggestions = parsed.chips   || parsed.suggestions || [];
    } catch {
      reply = jsonData.choices?.[0]?.message?.content || 'Done.';
    }

    return json({ reply, suggestions });
  }

  // ── GET /vehicle-blocks — Fetch all per-vehicle blocks ──────────────────
  if (path === '/vehicle-blocks' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('vehicle_blocks')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) return json({ error: error.message }, 500);
    return json({ blocks: data || [] });
  }

  // ── POST /vehicle-blocks — Create new vehicle block ─────────────────────
  if (path === '/vehicle-blocks' && req.method === 'POST') {
    const body = await req.json();
    const { vehicle_key, start_date, end_date, reason } = body;

    if (!vehicle_key || !start_date || !end_date) {
      return json({ error: 'vehicle_key, start_date, and end_date are required' }, 400);
    }

    const created_by = authedUser.email || 'unknown';

    const { data, error } = await supabase
      .from('vehicle_blocks')
      .insert({
        vehicle_key,
        start_date,
        end_date,
        reason: reason || null,
        created_by
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, block: data });
  }

  // ── DELETE /vehicle-blocks/:id — Remove vehicle block ───────────────────
  if (path.startsWith('/vehicle-blocks/') && req.method === 'DELETE') {
    const id = path.split('/')[2];
    if (!id) return json({ error: 'Block ID required' }, 400);

    const { error } = await supabase
      .from('vehicle_blocks')
      .delete()
      .eq('id', id);

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('[Admin Error]', error);
    Sentry.captureException(error);
    await Sentry.flush(2000);
    return json({ error: 'Internal server error', detail: (error as Error)?.message ?? String(error) }, 500);
  }
});
