import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Direct tour booking: creates a Stripe Checkout session for the $250 tour
// deposit and records the pending request.
//
// DELIBERATELY SEPARATE FROM `checkout/index.ts`. The rental checkout has a
// hard gate requiring a completed `id_uploads` row and runs its own baseCents
// price verification against rental duration math. A tour has neither, so
// routing tours through it would mean carving holes in the rental money path.
// Keep these two apart.
//
// The client sends NO money. Tier price and deposit are derived here.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Owner-set tiers, mirrored from /tours and from tour-request. Display and
// balance only: the ONLY thing charged online is the deposit below.
const TIERS: Record<number, number> = { 2: 450, 4: 700, 6: 900, 8: 1100 };
const DEPOSIT_CENTS = 25000; // $250, stated on every tours page

const ROUTES: Record<string, string> = {
  'north-east-md': 'North East, MD Run (Woody’s Crab House)',
  'gettysburg-york': 'Gettysburg / York History Route'
};

function overlaps(iso: string, start: string, end: string | null): boolean {
  const d = new Date(iso + 'T12:00:00');
  return d >= new Date(start + 'T00:00:00') &&
         d <= new Date((end || start) + 'T23:59:59');
}

// Server-side mirror of vehiclesFreeOn() in pages/tours.html. With direct
// payment this check is load-bearing: payment IS the confirmation, so a wrong
// answer double-books a car. Deliberately does NOT use the `check-availability`
// function, which is a documented permanent no-op with a fuzzy vehicle-name bug.
async function vehiclesFreeOn(iso: string): Promise<{ free: number; fleet: string[]; taken: Set<string> } | null> {
  const { data: cfgRow, error } = await supabase
    .from('site_config').select('config').eq('id', 1).single();
  if (error || !cfgRow?.config) return null;

  const cfg = cfgRow.config as Record<string, unknown>;
  const vehicles = cfg.vehicles as Record<string, unknown> | undefined;
  if (!vehicles) return null;
  const fleet = Object.keys(vehicles);
  if (!fleet.length) return null;

  const blocked = (cfg.blockedDates as string[]) || [];
  if (blocked.includes(iso)) return { free: 0, fleet, taken: new Set(fleet) };

  const taken = new Set<string>();

  // Confirmed bookings hold a car for their whole range.
  const { data: bookings } = await supabase
    .from('bookings').select('vehicle, vehicle_key, start_date, end_date')
    .eq('status', 'confirmed');
  (bookings || []).forEach((b: Record<string, string>) => {
    if (b.start_date && overlaps(iso, b.start_date, b.end_date)) {
      // vehicle_key is authoritative; fall back to the display name for rows
      // created before that column existed.
      taken.add(b.vehicle_key || b.vehicle);
    }
  });

  const { data: blocks } = await supabase
    .from('vehicle_blocks').select('vehicle_key, start_date, end_date');
  (blocks || []).forEach((b: Record<string, string>) => {
    if (b.start_date && overlaps(iso, b.start_date, b.end_date)) taken.add(b.vehicle_key);
  });

  const free = fleet.filter(k => !taken.has(k)).length;
  return { free, fleet, taken };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const date = String(body.preferred_date ?? '').trim();
    const groupSize = Number(body.group_size);
    const route = String(body.route ?? '').trim();
    const notes = String(body.notes ?? '').trim() || null;

    if (!name) return json({ error: 'Name is required' }, 400);
    if (!email.includes('@')) return json({ error: 'A valid email is required' }, 400);
    if (!phone) return json({ error: 'Phone is required' }, 400);
    if (!ROUTES[route]) return json({ error: 'Please choose a route' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'Pick the date you want to ride' }, 400);
    }

    // Only the published tiers can be booked directly. Odd sizes have no price
    // to charge, so they go back to the request form and Chris quotes by hand.
    if (!TIERS[groupSize]) {
      return json({
        error: 'Groups of ' + groupSize + ' are quoted by hand. Send a request and we will confirm your price.',
        useRequestForm: true
      }, 400);
    }

    // A date in the past can never be honoured.
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) return json({ error: 'Pick a date in the future' }, 400);

    const needed = Math.ceil(groupSize / 2);

    // Re-check availability server side. The page checks too, but that number
    // can be stale by the time someone finishes the form.
    const avail = await vehiclesFreeOn(date);
    if (!avail) {
      return json({ error: 'We could not confirm that date just now. Send a request instead and we will confirm directly.', useRequestForm: true }, 503);
    }
    if (avail.free < needed) {
      return json({
        error: 'That date no longer has ' + needed + (needed === 1 ? ' vehicle' : ' vehicles') + ' free. Pick another date.',
        free: avail.free, needed
      }, 409);
    }

    // Record the request BEFORE taking money, so a guest who pays always has a
    // row. Status stays 'new' until the webhook confirms the deposit.
    const { data: reqRow, error: insErr } = await supabase
      .from('tour_requests')
      .insert({
        name, email, phone, preferred_date: date, group_size: groupSize,
        route, notes, source: 'direct-booking', deposit_cents: DEPOSIT_CENTS
      })
      .select('id').single();

    if (insErr || !reqRow) {
      console.error('[tour-checkout] insert failed:', insErr?.message);
      return json({ error: 'Could not start your booking. Please call us instead.' }, 500);
    }

    const tourPrice = TIERS[groupSize];
    const balance = tourPrice - DEPOSIT_CENTS / 100;
    const routeLabel = ROUTES[route];

    const sessionBody: Record<string, string> = {
      mode: 'payment',
      'customer_email': email,
      'metadata[kind]': 'tour-deposit',
      'metadata[tourRequestId]': reqRow.id,
      'metadata[route]': route,
      'metadata[groupSize]': String(groupSize),
      'metadata[tourDate]': date,
      'metadata[vehiclesNeeded]': String(needed),
      'metadata[depositCents]': String(DEPOSIT_CENTS),
      'metadata[tourPrice]': String(tourPrice),
      'success_url': `https://cjfuntimerentals.com/tours?booked=1&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `https://cjfuntimerentals.com/tours?canceled=1`,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(DEPOSIT_CENTS),
      'line_items[0][price_data][product_data][name]':
        `Guided Tour Deposit: ${routeLabel}, ${groupSize} guests`,
      'line_items[0][price_data][product_data][description]':
        `Holds ${date}. Tour total $${tourPrice.toLocaleString()}; the remaining $${balance.toLocaleString()} is due the day of the ride.`,
      'line_items[0][quantity]': '1'
    };

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Stripe retries are safe: one session per tour request row.
        'Idempotency-Key': `tour-deposit-${reqRow.id}`
      },
      body: new URLSearchParams(sessionBody).toString()
    });

    const session = await res.json();
    if (!res.ok || !session.url) {
      console.error('[tour-checkout] stripe session failed:', JSON.stringify(session).slice(0, 400));
      return json({ error: 'Could not reach checkout. Please try again or call us.' }, 502);
    }

    await supabase.from('tour_requests')
      .update({ stripe_session_id: session.id }).eq('id', reqRow.id);

    return json({ ok: true, url: session.url, id: reqRow.id });
  } catch (err) {
    console.error('[tour-checkout] threw:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
