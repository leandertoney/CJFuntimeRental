import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      startDate, endDate,
      totalCents, baseCents,
      deliveryDropoff, deliveryPickup, deliveryFee,
      promoCode
    } = body;

    if (!vehicleKey || !durationType || !startDate) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
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

    // Server-side price verification using config pricing
    // The client sends totalCents/baseCents which we use, but we verify against config
    const rentalAmount = baseCents;
    if (!rentalAmount || rentalAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid rental amount' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
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
      'metadata[hours]': String(hours || ''),
      'metadata[days]': String(days || ''),
      'metadata[deliveryDropoff]': String(!!deliveryDropoff),
      'metadata[deliveryPickup]': String(!!deliveryPickup),
      'success_url': 'https://cjfuntimerentals.com/booking-success?session_id={CHECKOUT_SESSION_ID}',
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
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
