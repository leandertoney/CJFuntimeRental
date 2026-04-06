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

const STRIPE_PRODUCTS: Record<string, string> = {
  slingshot_2022: 'prod_UHaiSY5zFpsDcV',
  slingshot_2020: 'prod_UHaiT4pRmY2sos',
  canam_spyder:   'prod_UHai9cIGKdkLoW'
};

const STRIPE_PRICE_IDS: Record<string, string> = {
  slingshot_2022: 'price_1TJ1WhDlmCSCy5M3ZzTUKo6U',
  slingshot_2020: 'price_1TJ1WhDlmCSCy5M3lht61h3l',
  canam_spyder:   'price_1TJ1WiDlmCSCy5M30zruaRZ7'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { vehicleKey, days, startDate, endDate, promoCode } = await req.json();
    if (!vehicleKey || !days || !startDate) {
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

    // Get current rate from Supabase config
    let unitAmount: number | null = null;
    try {
      const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
      const vehicle = data?.config?.vehicles?.[vehicleKey];
      if (vehicle?.ratePerDay) unitAmount = Math.round(vehicle.ratePerDay * 100);
    } catch { /* fall through to static price */ }

    const lineItem = unitAmount
      ? { price_data: { currency: 'usd', unit_amount: unitAmount, product: STRIPE_PRODUCTS[vehicleKey] }, quantity: Number(days) }
      : { price: STRIPE_PRICE_IDS[vehicleKey], quantity: Number(days) };

    const sessionBody: Record<string, string> = {
      mode: 'payment',
      'line_items[0][quantity]': String(Number(days)),
      'metadata[vehicleKey]': vehicleKey,
      'metadata[startDate]': startDate,
      'metadata[endDate]': endDate || startDate,
      'metadata[days]': String(days),
      'success_url': 'https://cjfuntimerentals.com/booking-success?session_id={CHECKOUT_SESSION_ID}',
      'cancel_url': 'https://cjfuntimerentals.com',
      'phone_number_collection[enabled]': 'true',
    };

    if (unitAmount) {
      sessionBody['line_items[0][price_data][currency]'] = 'usd';
      sessionBody['line_items[0][price_data][unit_amount]'] = String(unitAmount);
      sessionBody['line_items[0][price_data][product]'] = STRIPE_PRODUCTS[vehicleKey];
    } else {
      sessionBody['line_items[0][price]'] = STRIPE_PRICE_IDS[vehicleKey];
    }

    if (promoCode) {
      // Look up the Stripe promotion_code ID from the human-readable code string
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
