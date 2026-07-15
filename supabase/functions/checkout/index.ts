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
      promoCode, bookingRef
    } = body;

    if (!vehicleKey || !durationType || !startDate) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
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

    // Check for double-booking
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, start_date, end_date')
      .eq('status', 'confirmed')
      .eq('vehicle', vehicleKey);

    if (existing && existing.length > 0) {
      const reqStart = new Date(startDate);
      const reqEnd   = new Date(endDate || startDate);
      for (const b of existing) {
        const bStart = new Date(b.start_date);
        const bEnd   = new Date(b.end_date || b.start_date);
        if (reqStart < bEnd && reqEnd > bStart) {
          return new Response(JSON.stringify({ error: 'Those dates are already booked. Please choose different dates.' }), {
            status: 409, headers: { ...CORS, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Get vehicle info from Supabase config
    let vehicleName = vehicleKey;
    let vehicleType = vehicleKey.includes('canam') ? 'canam' : 'slingshot';
    let stripeProductId: string | null = null;

    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      const vehicle = data?.config?.vehicles?.[vehicleKey];
      if (vehicle?.label || vehicle?.name) vehicleName = vehicle.label || vehicle.name;
      if (vehicle?.type) vehicleType = vehicle.type;
      if (vehicle?.stripeProductId) stripeProductId = vehicle.stripeProductId;
    } catch { /* fall through */ }

    if (!stripeProductId) stripeProductId = STRIPE_PRODUCTS[vehicleKey] || null;

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
      hourlyRate: 35,
      hourlyMin: 3,
      tenhrRate: { slingshot: 180, canam: 180 } as Record<string, number>,
      dailyRate: { slingshot: 250, canam: 250 } as Record<string, number>,
      multiDay: [
        { minDays: 7, slingshot: 190, canam: 190, enabled: true },
        { minDays: 4, slingshot: 210, canam: 210, enabled: true },
        { minDays: 2, slingshot: 225, canam: 225, enabled: true }
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
    const tenhrRate = (cfgPricing.tenhrRate as Record<string, number>) || PRICING_DEFAULTS.tenhrRate;
    const dailyRate = (cfgPricing.dailyRate as Record<string, number>) || PRICING_DEFAULTS.dailyRate;
    const multiDay = (Array.isArray(cfgPricing.multiDay) && (cfgPricing.multiDay as unknown[]).length > 0)
      ? (cfgPricing.multiDay as typeof PRICING_DEFAULTS.multiDay)
      : PRICING_DEFAULTS.multiDay;

    let expectedBaseDollars = 0;
    if (durationType === 'hourly') {
      expectedBaseDollars = hourlyRate * (Number(hours) || hourlyMin);
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

    // Build duration description for Stripe
    let durationDesc = '';
    switch (durationType) {
      case 'hourly': durationDesc = `${hours || 3} Hour Rental`; break;
      case '9hr':    durationDesc = '9-Hour Rental'; break;
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

    // Promo code handling
    if (promoCode) {
      const promoRes = await fetch(
        'https://api.stripe.com/v1/promotion_codes?code=' + encodeURIComponent(promoCode) + '&limit=1&active=true',
        { headers: { 'Authorization': 'Bearer ' + stripeKey } }
      );
      const promoData = await promoRes.json();
      const promoId = promoData?.data?.[0]?.id;
      if (promoId) {
        sessionBody['discounts[0][promotion_code]'] = promoId;
      } else {
        return new Response(
          JSON.stringify({ error: 'Promo code "' + promoCode + '" is invalid or expired.' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      sessionBody['allow_promotion_codes'] = 'true';
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
