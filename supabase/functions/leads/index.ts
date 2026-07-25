import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function randomHex(n: number) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function createPromoCode(email: string): Promise<string | null> {
  const code = 'FIRST10-' + randomHex(4);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return null;
  try {
    const couponRes = await fetch('https://api.stripe.com/v1/coupons', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ percent_off: '10', duration: 'once', max_redemptions: '1', 'metadata[email]': email })
    });
    const coupon = await couponRes.json();
    if (!coupon.id) {
      console.error('[createPromoCode] coupon create failed:', JSON.stringify(coupon.error || coupon));
      return null;
    }
    // Stripe API 2026-03-25.dahlia removed the top-level `coupon` param on
    // promotion_codes — it must be the nested `promotion[type]=coupon` +
    // `promotion[coupon]=<id>` form. The old top-level `coupon=<id>` returned
    // "Received unknown parameter: coupon", which the previous `catch { return code }`
    // swallowed — so every FIRST10 code was emailed to the customer but never
    // actually created in Stripe, and was rejected at checkout.
    const promoRes = await fetch('https://api.stripe.com/v1/promotion_codes', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'promotion[type]': 'coupon',
        'promotion[coupon]': coupon.id,
        code,
        max_redemptions: '1',
        'metadata[email]': email
      })
    });
    const promo = await promoRes.json();
    if (promo.error || !promo.code) {
      console.error('[createPromoCode] promotion code create failed:', JSON.stringify(promo.error || promo));
      return null;
    }
    return promo.code;
  } catch (err) {
    console.error('[createPromoCode] threw:', (err as Error).message);
    return null;
  }
}

async function sendDiscountEmail(email: string, code: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "🏎️ Your 10% off code — CJ's Fun Time Rental",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
      </td></tr>
      <tr><td style="padding:36px 0;">
        <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 16px;">Your 10% Off Code Is Here</h1>
        <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:0 0 32px;line-height:1.7;">Thanks for signing up. Use this code at checkout when you book your Polaris Slingshot or Can-Am Spyder.</p>
        <div style="background:#1a1a1a;border:1px solid rgba(255,107,0,0.3);border-radius:10px;padding:28px;text-align:center;margin-bottom:32px;">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:10px;">Your Discount Code</div>
          <div style="font-family:Impact,Arial,sans-serif;font-size:42px;letter-spacing:6px;color:#FF6B00;">${code}</div>
          <div style="font-size:12px;color:#888;margin-top:10px;">10% off your first rental &nbsp;·&nbsp; Single use &nbsp;·&nbsp; No expiry</div>
        </div>
        <div style="text-align:center;">
          <a href="https://cjfuntimerentals.com" style="display:inline-block;background:#FF6B00;color:#000;font-weight:700;font-size:14px;letter-spacing:1px;padding:14px 32px;border-radius:6px;text-decoration:none;">Book Your Ride &rarr;</a>
        </div>
      </td></tr>
      <tr><td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
        <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;·&nbsp; Lancaster, PA &nbsp;·&nbsp; Polaris Slingshot &amp; Can-Am Spyder Rentals</p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>`
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { email, source } = await req.json();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Fire async after response
    const run = async () => {
      const code = await createPromoCode(cleanEmail);
      // Always record the lead. Only email a code if Stripe actually created it —
      // never email a dead code (the old bug emailed codes that failed to create).
      await supabase.from('leads').insert({ email: cleanEmail, source: source || 'website', promo_code: code });
      if (code) {
        await sendDiscountEmail(cleanEmail, code);
      } else {
        console.error('[leads] promo code creation failed for', cleanEmail, '— no discount email sent');
      }
    };
    run().catch(err => console.error('Lead flow error:', err));

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
