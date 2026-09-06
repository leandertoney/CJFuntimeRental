import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Legacy Stripe product/price IDs for existing vehicles
const STRIPE_PRODUCTS: Record<string, string> = {
  slingshot_2022: 'prod_UHaiSY5zFpsDcV',
  slingshot_2020: 'prod_UHaiT4pRmY2sos',
  canam_spyder:   'prod_UHai9cIGKdkLoW'
};

// Attribution values arrive from the browser, so they are untrusted input on a
// money-path request. Coerce to a short plain string: Stripe rejects the entire
// session if any metadata value exceeds 500 chars.
function attrField(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, 120);
}


// Local-date day-of-week for a 'YYYY-MM-DD' string. new Date('2026-09-12')
// parses as UTC midnight and getDay() then answers in the runtime's zone, which
// silently shifts the day. Same class of bug as the dashboard's UTC rollover.
// Parse the parts explicitly so a rental date means the calendar date.
function dowLocal(dateStr: string): number {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
}

// Every calendar day the vehicle is out must be allowed, not just the pickup.
// A Thursday 4-day rental comes back Sunday, and a weekday-only code must not
// quietly discount a weekend. For a 24hr booking endDate === startDate, so this
// checks the pickup day alone.
function promoDaysAllowed(startDate: string, endDate: string, weekdays: number[]): boolean {
  const [sy, sm, sd] = String(startDate).split('-').map(Number);
  const [ey, em, ed] = String(endDate || startDate).split('-').map(Number);
  const cur = new Date(sy, (sm || 1) - 1, sd || 1);
  const end = new Date(ey, (em || 1) - 1, ed || 1);
  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return true; // don't block on unparseable input
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    if (!weekdays.includes(cur.getDay())) return false;
    cur.setDate(cur.getDate() + 1);
  }
  return true;
}

// Describe the allowed days FROM the config array rather than hardcoding a
// sentence. A hardcoded "Monday to Friday" silently becomes a lie the moment
// the array changes, which is the same drift that put wrong prices in this
// codebase: a value edited in one place and a label left behind in another.
const PROMO_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function promoDaysLabel(weekdays: number[]): string {
  const ds = [...new Set(weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (ds.length === 0) return '';
  // Contiguous in week order, or contiguous when wrapped through Sunday
  // (e.g. [0,1,2,3,4] reads better as "Sunday to Thursday").
  const contiguous = ds.every((d, i) => i === 0 || d === ds[i - 1] + 1);
  if (contiguous && ds.length > 1) {
    return `${PROMO_DAY_NAMES[ds[0]]} to ${PROMO_DAY_NAMES[ds[ds.length - 1]]}`;
  }
  if (ds.length === 1) return PROMO_DAY_NAMES[ds[0]];
  return ds.map((d) => PROMO_DAY_NAMES[d]).join(', ');
}

function promoWeekdayMsg(weekdays: number[]): string {
  return `This code is good for ${promoDaysLabel(weekdays)} rentals. Pick those days to use it.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await req.json();
    const {
      vehicleKey, durationType, hours, days,
      startDate, endDate, pickupTime,
      totalCents, baseCents,
      deliveryDropoff, deliveryPickup, deliveryFee,
      promoCode, bookingRef, attribution, validatePromoOnly
    } = body;

    if (!vehicleKey || !durationType || !startDate) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Promo lookup, used by the checkout page's "Apply" button ────────────
    // Returns just the percentage so the page can show the discounted total
    // before the customer commits. Deliberately answers BEFORE the ID gate
    // below, because a customer checks a code before uploading anything.
    //
    // This returns only a percentage for a code the caller already knows. It
    // never lists codes, so it cannot be used to discover them, and it is not
    // authorization to charge: the checkout path re-resolves the code from
    // config on its own and never trusts a percentage sent by the client.
    if (validatePromoOnly) {
      let vCfg: Record<string, unknown> = {};
      try {
        const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
        vCfg = data?.config?.pricing || {};
      } catch { /* fall through: unknown code */ }
      const vCodes = (vCfg.promoCodes || {}) as Record<string, Record<string, unknown>>;
      const vKey = String(promoCode || '').trim().toUpperCase();
      let vPromo = vCodes[vKey];
      if (!vPromo && /^FIRST10-[A-Z0-9]{8}$/.test(vKey)) vPromo = vCodes.FIRST10;
      const vNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const vToday = vNow.getFullYear() + '-' +
        String(vNow.getMonth() + 1).padStart(2, '0') + '-' +
        String(vNow.getDate()).padStart(2, '0');
      const vPct = vPromo ? Number(vPromo.percentOff) || 0 : 0;
      const vExpired = vPromo && vPromo.expires ? String(vPromo.expires) < vToday : false;
      if (!vPromo || vPct <= 0 || vPct > 100 || vPromo.enabled === false || vExpired) {
        return new Response(JSON.stringify({ ok: false, error: 'That code is not valid or has expired.' }),
          { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      // A weekday-only code rejected with a generic message reads as broken, so
      // say what the rule is. MUST stay identical to the checkout block below.
      const vWeekdays = Array.isArray(vPromo.weekdays) ? vPromo.weekdays as number[] : null;
      if (vWeekdays && !promoDaysAllowed(String(startDate), String(endDate || startDate), vWeekdays)) {
        return new Response(JSON.stringify({ ok: false, error: promoWeekdayMsg(vWeekdays) }),
          { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        ok: true, code: vKey, percentOff: vPct,
        label: String(vPromo.label || (vPct + '% off your rental')),
        restriction: vWeekdays ? promoDaysLabel(vWeekdays) + ' rentals only' : ''
      }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── Hard gate: no checkout without an uploaded ID + accepted agreement ─────
    // Every website booking must have both ID images stored and the rental
    // agreement accepted BEFORE we create a payment session. This is also what
    // closes off any legacy path that would POST here without going through the
    // ID/contract step. Fail closed: no valid upload record => no checkout.
    if (!bookingRef) {
      return new Response(JSON.stringify({ error: 'A photo ID and signed agreement are required before checkout.' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    {
      const { data: idUpload } = await supabase
        .from('id_uploads')
        .select('booking_ref, front_path, back_path, agreed_at')
        .eq('booking_ref', bookingRef)
        .maybeSingle();
      if (!idUpload || !idUpload.front_path || !idUpload.back_path || !idUpload.agreed_at) {
        return new Response(JSON.stringify({ error: 'A photo ID and signed agreement are required before checkout.' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    let vehicleName = vehicleKey;
    let vehicleAltName = '';
    let vehicleAltName2 = '';
    let vehicleType = vehicleKey.includes('canam') ? 'canam' : 'slingshot';
    let stripeProductId: string | null = null;

    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      const vehicle = data?.config?.vehicles?.[vehicleKey];
      if (vehicle?.label || vehicle?.name) vehicleName = vehicle.label || vehicle.name;
      // Legacy bookings stored `name`, but vehicleName prefers `label`, so keep
      // both spellings for the availability match below.
      if (vehicle?.name) vehicleAltName = vehicle.name;
      if (vehicle?.label) vehicleAltName2 = vehicle.label;
      if (vehicle?.type) vehicleType = vehicle.type;
      if (vehicle?.stripeProductId) stripeProductId = vehicle.stripeProductId;
    } catch { /* fall through */ }

    if (!stripeProductId) stripeProductId = STRIPE_PRODUCTS[vehicleKey] || null;

    // ── Availability ────────────────────────────────────────────────────────
    // Dates here are INCLUSIVE on both ends: a 24hr booking sends
    // endDate === startDate, and every booking taken so far has been a single
    // day. The previous test was `reqStart < bEnd && reqEnd > bStart`, which is
    // the half-open comparison. On a same-day booking it compares a date to
    // itself and returns false, so two customers could book the same vehicle on
    // the same day. Inclusive overlap is `reqStart <= bEnd && reqEnd >= bStart`.
    //
    // Compared as plain 'YYYY-MM-DD' strings, which sort correctly and avoid the
    // UTC-vs-local shift that new Date('2026-09-12') introduces.
    const reqStartStr = String(startDate);
    const reqEndStr   = String(endDate || startDate);

    // Match on vehicle_key OR the display name. `bookings.vehicle` holds a NAME
    // ("2016 Polaris Slingshot") while this function receives a KEY
    // ("slingshot_2020"), so the old .eq('vehicle', vehicleKey) matched nothing
    // and the double-booking guard never actually fired on a real booking.
    // vehicle_key is populated only on newer rows (6 of 11 are NULL), so both
    // are needed. Two vehicles share the name "2016 Polaris Slingshot", which
    // makes the name comparison over-broad rather than under-broad: it can
    // refuse a free vehicle, never sell one twice. That is the safe direction,
    // and vehicle_key wins whenever it is present.
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, vehicle, vehicle_key')
      .eq('status', 'confirmed');

    if (existing && existing.length > 0) {
      for (const b of existing) {
        const sameVehicle = b.vehicle_key
          ? b.vehicle_key === vehicleKey
          : [vehicleName, vehicleAltName, vehicleAltName2]
              .filter(Boolean)
              .includes(String(b.vehicle || ''));
        if (!sameVehicle) continue;
        const bStart = String(b.start_date);
        const bEnd   = String(b.end_date || b.start_date);
        if (reqStartStr <= bEnd && reqEndStr >= bStart) {
          return new Response(JSON.stringify({ error: 'Those dates are already booked. Please choose different dates.' }), {
            status: 409, headers: { ...CORS, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Owner-set blocks (maintenance, personal use, a day held back). The widget
    // already greys these out, but that is browser-side only: without this the
    // sole thing standing between a promo link and a booking on a blocked day
    // is client code. Fail closed the same way double-booking does.
    const { data: blocks } = await supabase
      .from('vehicle_blocks')
      .select('start_date, end_date, reason')
      .eq('vehicle_key', vehicleKey);

    if (blocks && blocks.length > 0) {
      for (const bl of blocks) {
        const blStart = String(bl.start_date);
        const blEnd   = String(bl.end_date || bl.start_date);
        if (reqStartStr <= blEnd && reqEndStr >= blStart) {
          return new Response(JSON.stringify({ error: 'That vehicle is unavailable on those dates. Please choose different dates.' }), {
            status: 409, headers: { ...CORS, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Get vehicle info from Supabase config

    // ── Server-side price verification ──────────────────────────────────────
    // The client computes baseCents/totalCents itself (booking-widget.js's
    // calcPrice()) and we previously charged that number with no server-side
    // check at all — a stale, buggy, or tampered client value would be
    // charged verbatim. Recompute the expected rental amount independently
    // from the same config + duration/day math the client uses (mirrored
    // from calcPrice()), using PRICING_DEFAULTS as the floor exactly like the
    // client does (falsy/zeroed config values are ignored, not treated as
    // real overrides — the live site_config.pricing.* fields are currently
    // zeroed out, so this floor is what's actually in effect everywhere).
    const PRICING_DEFAULTS = {
      hourlyRate: 30,
      hourlyMin: 3,
      hourlyCap: 180,
      tenhrRate: { slingshot: 180, canam: 180 } as Record<string, number>,
      dailyRate: { slingshot: 250, canam: 250 } as Record<string, number>,
      multiDay: [
        { minDays: 7, slingshot: 190, canam: 190, enabled: true },
        { minDays: 4, slingshot: 210, canam: 210, enabled: true },
        { minDays: 2, slingshot: 220, canam: 220, enabled: true }
      ],
      deliveryFee: 50
    };

    let cfgPricing: Record<string, unknown> = {};
    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      cfgPricing = data?.config?.pricing || {};
    } catch { /* fall through to defaults */ }

    const hourlyRate = Number(cfgPricing.hourlyRate) || PRICING_DEFAULTS.hourlyRate;
    const hourlyMin = Number(cfgPricing.hourlyMin) || PRICING_DEFAULTS.hourlyMin;
    const hourlyCap = Number(cfgPricing.hourlyCap) || PRICING_DEFAULTS.hourlyCap;
    const tenhrRate = (cfgPricing.tenhrRate as Record<string, number>) || PRICING_DEFAULTS.tenhrRate;
    const dailyRate = (cfgPricing.dailyRate as Record<string, number>) || PRICING_DEFAULTS.dailyRate;
    const multiDay = (Array.isArray(cfgPricing.multiDay) && (cfgPricing.multiDay as unknown[]).length > 0)
      ? (cfgPricing.multiDay as typeof PRICING_DEFAULTS.multiDay)
      : PRICING_DEFAULTS.multiDay;

    let expectedBaseDollars = 0;
    if (durationType === 'hourly') {
      // Mirror booking-widget.js calcPrice(): cap the hourly total at the 9hr
      // rate so no 3-9hr duration bills above $180. MUST stay identical to the
      // client or this function 409s every legitimate hourly checkout.
      expectedBaseDollars = Math.min(hourlyRate * (Number(hours) || hourlyMin), hourlyCap);
    } else if (durationType === '10hr') {
      expectedBaseDollars = tenhrRate[vehicleType] || PRICING_DEFAULTS.tenhrRate[vehicleType] || 180;
    } else if (durationType === '24hr') {
      expectedBaseDollars = dailyRate[vehicleType] || PRICING_DEFAULTS.dailyRate[vehicleType] || 250;
    } else if (durationType === 'multi') {
      const d = Number(days) || 0;
      const tier = multiDay.find((t) => t.enabled && d >= t.minDays);
      const perDay = tier ? (tier[vehicleType as 'slingshot' | 'canam'] || 0) : (dailyRate[vehicleType] || PRICING_DEFAULTS.dailyRate[vehicleType] || 250);
      expectedBaseDollars = perDay * d;
    }

    // ── Promo codes ─────────────────────────────────────────────────────────
    // Codes live in site_config.pricing.promoCodes as
    //   { "COMEBACK15": { percentOff: 15, expires: "2026-10-31", label: "..." } }
    // and are resolved HERE, on the server, from the code string alone. The
    // client sends only the code; it never sends a percentage or a discounted
    // amount, so a customer editing devtools cannot invent their own discount.
    //
    // The discount applies to the RENTAL ONLY. It deliberately does not touch
    // the refundable deposit (that money comes back to the customer, so
    // discounting it just shrinks our security hold) or delivery (a real cost
    // we pay to drive the vehicle). This is exactly why we do not use Stripe
    // coupons here: coupon 6pEsbmdK is unrestricted (applies_to: null), so
    // handing it to Stripe would take 15% off the deposit and both delivery
    // legs as well.
    const promoCodes = (cfgPricing.promoCodes || {}) as Record<string, Record<string, unknown>>;
    let promoPercentOff = 0;
    let promoApplied = '';
    if (promoCode) {
      const key = String(promoCode).trim().toUpperCase();
      let promo = promoCodes[key];
      // Legacy FIRST10-XXXXXXXX codes: the signup form has minted a unique
      // Stripe promotion code per lead since April and the welcome email
      // promises 10% off with "No expiry". Those Stripe codes are no longer
      // consulted (their coupon is unrestricted, so Stripe would discount the
      // refundable deposit and delivery too), but the promise still stands, so
      // any well-formed FIRST10-* falls back to a single config entry and is
      // honoured at 10% off the rental.
      if (!promo && /^FIRST10-[A-Z0-9]{8}$/.test(key)) promo = promoCodes.FIRST10;
      // Local calendar date, not toISOString(): a UTC date string rolls over
      // in the evening Eastern and would expire a code a day early.
      const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const todayET = nowET.getFullYear() + '-' +
        String(nowET.getMonth() + 1).padStart(2, '0') + '-' +
        String(nowET.getDate()).padStart(2, '0');
      const pct = promo ? Number(promo.percentOff) || 0 : 0;
      const expired = promo && promo.expires ? String(promo.expires) < todayET : false;
      if (!promo || pct <= 0 || pct > 100 || promo.enabled === false || expired) {
        return new Response(
          JSON.stringify({ error: 'That promo code is not valid. Remove it to continue, or check the code and try again.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
      // Identical rule to the validate block above. The client cannot be
      // trusted to have run it, so it is re-checked on the charging path.
      const cWeekdays = Array.isArray(promo.weekdays) ? promo.weekdays as number[] : null;
      if (cWeekdays && !promoDaysAllowed(String(startDate), String(endDate || startDate), cWeekdays)) {
        return new Response(JSON.stringify({ error: promoWeekdayMsg(cWeekdays) }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      promoPercentOff = pct;
      promoApplied = key;
      // Round the discount the same way the client does (checkout.html), or
      // the price-match check below fails by a cent on odd amounts.
      expectedBaseDollars = expectedBaseDollars - Math.round(expectedBaseDollars * pct) / 100;
    }
    const expectedBaseCents = Math.round(expectedBaseDollars * 100);

    // The client sends totalCents/baseCents which we use to build the Stripe
    // line item, but only after confirming it matches our own computation
    // (a few cents of tolerance for client-side floating point rounding).
    const rentalAmount = baseCents;
    if (!rentalAmount || rentalAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid rental amount' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
    if (expectedBaseCents > 0 && Math.abs(rentalAmount - expectedBaseCents) > 5) {
      Sentry.captureMessage(
        `Checkout price mismatch: client sent ${rentalAmount}c, server expected ${expectedBaseCents}c ` +
        `(vehicleKey=${vehicleKey}, durationType=${durationType}, days=${days}, hours=${hours})`,
        'error'
      );
      return new Response(JSON.stringify({ error: 'Pricing has changed — please refresh the page and try again.' }), {
        status: 409, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Delivery fee: log-only for now, NOT blocking. Real historical bookings
    // have been seen with deliveryDropoff/deliveryPickup=true in Stripe
    // metadata but no delivery fee actually charged (root cause not yet
    // understood — possibly a customer toggling delivery off mid-checkout).
    // Blocking here risks rejecting a legitimate customer's real payment over
    // a mismatch that may be harmless, so this only reports to Sentry for
    // visibility until that's investigated as its own task.
    const expectedDeliveryFeeCents = Math.round((Number(cfgPricing.delivery && (cfgPricing.delivery as Record<string, unknown>).fee) || PRICING_DEFAULTS.deliveryFee) * 100)
      * ((deliveryDropoff ? 1 : 0) + (deliveryPickup ? 1 : 0));
    if (Math.abs(Number(deliveryFee || 0) - expectedDeliveryFeeCents) > 5) {
      Sentry.captureMessage(
        `Checkout delivery fee mismatch (non-blocking): client sent ${deliveryFee}c (dropoff=${deliveryDropoff}, pickup=${deliveryPickup}), server expected ${expectedDeliveryFeeCents}c`,
        'warning'
      );
    }

    // ── Refundable reservation deposit ───────────────────────────────────────
    // $100 (default) charged as its own line item, refunded from the admin
    // panel after the vehicle comes back. Configurable / disable-able via
    // site_config.pricing.deposit = { enabled: boolean, amount: dollars }.
    const depCfg = (cfgPricing.deposit || {}) as Record<string, unknown>;
    const depositEnabled = depCfg.enabled !== false; // default ON
    const depositCents = depositEnabled ? Math.round((Number(depCfg.amount) || 100) * 100) : 0;

    // Build duration description for Stripe
    let durationDesc = '';
    switch (durationType) {
      case 'hourly': durationDesc = `${hours || 3} Hour Rental`; break;
      // '10hr' is the internal key for the capped single-day rate. Its meaning
      // changed 10h -> 9h on 2026-08-02; the key is intentionally NOT renamed
      // because '9hr' is already a legacy key on historical bookings.
      case '10hr':   durationDesc = '9-Hour Rental'; break;
      case '9hr':    durationDesc = '9-Hour Rental'; break; // legacy key, older rows
      case '24hr':   durationDesc = '24-Hour Rental'; break;
      case 'multi':  durationDesc = `${days || 1}-Day Rental`; break;
      default:       durationDesc = 'Rental';
    }

    // Build Stripe checkout session
    const sessionBody: Record<string, string> = {
      mode: 'payment',
      'metadata[vehicleKey]': vehicleKey,
      'metadata[durationType]': durationType,
      'metadata[startDate]': startDate,
      'metadata[endDate]': endDate || startDate,
      'metadata[pickupTime]': pickupTime || '',
      'metadata[hours]': String(hours || ''),
      'metadata[days]': String(days || ''),
      'metadata[deliveryDropoff]': String(!!deliveryDropoff),
      'metadata[deliveryPickup]': String(!!deliveryPickup),
      'metadata[bookingRef]': bookingRef,
      'metadata[depositCents]': String(depositCents),
      // First-touch channel, for reporting only. Stripe caps a metadata value
      // at 500 chars and rejects the whole request if one is over, so each is
      // trimmed hard. Never used in any pricing decision.
      'metadata[attrSource]': attrField(attribution?.source),
      'metadata[attrMedium]': attrField(attribution?.medium),
      'metadata[attrCampaign]': attrField(attribution?.campaign),
      'metadata[attrLanding]': attrField(attribution?.landing_page),
      'metadata[attrFirstSeen]': attrField(attribution?.first_seen),
      'success_url': `https://cjfuntimerentals.com/booking-success?session_id={CHECKOUT_SESSION_ID}&vehicle=${encodeURIComponent(vehicleKey)}&date=${encodeURIComponent(startDate)}`,
      'cancel_url': 'https://cjfuntimerentals.com',
      'phone_number_collection[enabled]': 'true',
    };

    // Line item 0: Vehicle rental
    let lineIdx = 0;
    if (stripeProductId) {
      sessionBody[`line_items[${lineIdx}][price_data][currency]`] = 'usd';
      sessionBody[`line_items[${lineIdx}][price_data][unit_amount]`] = String(rentalAmount);
      sessionBody[`line_items[${lineIdx}][price_data][product]`] = stripeProductId;
    } else {
      sessionBody[`line_items[${lineIdx}][price_data][currency]`] = 'usd';
      sessionBody[`line_items[${lineIdx}][price_data][unit_amount]`] = String(rentalAmount);
      sessionBody[`line_items[${lineIdx}][price_data][product_data][name]`] = `${vehicleName} — ${durationDesc}`;
    }
    sessionBody[`line_items[${lineIdx}][quantity]`] = '1';

    // Line item 1: Delivery fee (if applicable)
    if (deliveryFee && deliveryFee > 0) {
      lineIdx++;
      const deliveryParts: string[] = [];
      if (deliveryDropoff) deliveryParts.push('Drop-off');
      if (deliveryPickup) deliveryParts.push('Pickup');
      const deliveryLabel = deliveryParts.join(' + ') + ' Service';

      sessionBody[`line_items[${lineIdx}][price_data][currency]`] = 'usd';
      sessionBody[`line_items[${lineIdx}][price_data][unit_amount]`] = String(deliveryFee);
      sessionBody[`line_items[${lineIdx}][price_data][product_data][name]`] = deliveryLabel;
      sessionBody[`line_items[${lineIdx}][quantity]`] = '1';
    }

    // Line item: Refundable reservation deposit (if enabled)
    if (depositCents > 0) {
      lineIdx++;
      sessionBody[`line_items[${lineIdx}][price_data][currency]`] = 'usd';
      sessionBody[`line_items[${lineIdx}][price_data][unit_amount]`] = String(depositCents);
      sessionBody[`line_items[${lineIdx}][price_data][product_data][name]`] = 'Refundable Reservation Deposit';
      sessionBody[`line_items[${lineIdx}][price_data][product_data][description]`] = 'Fully refunded after the vehicle is returned in good condition.';
      sessionBody[`line_items[${lineIdx}][quantity]`] = '1';
    }

    // The discount is already baked into the rental line item above, so there
    // is nothing to hand Stripe here beyond a record of which code was used.
    //
    // allow_promotion_codes is deliberately NOT set. It used to be, which put
    // Stripe's own promo box on the payment page — and the one coupon in this
    // account (6pEsbmdK) is unrestricted, so anyone who got hold of a
    // FIRST10-* code could have taken 10% off the refundable deposit and the
    // delivery fees too. Discounts belong on our checkout page, where we
    // control what they apply to.
    if (promoApplied) {
      sessionBody['metadata[promoCode]'] = promoApplied;
      sessionBody['metadata[promoPercentOff]'] = String(promoPercentOff);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(sessionBody)
    });

    const session = await stripeRes.json();
    if (session.error) throw new Error(session.error.message);

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
