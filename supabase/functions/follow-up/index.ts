import { Resend } from 'https://esm.sh/resend@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";
const GOOGLE_REVIEW_URL = 'https://g.page/r/CUCQ9L4rz2SUEBI/review';
const COMEBACK_CODE = 'COMEBACK10';

/** Ensure the COMEBACK10 promo code exists in Stripe (idempotent) */
async function ensurePromoCode(): Promise<void> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return;

  // Check if it already exists
  const checkRes = await fetch(
    'https://api.stripe.com/v1/promotion_codes?code=' + COMEBACK_CODE + '&limit=1',
    { headers: { 'Authorization': 'Bearer ' + stripeKey } }
  );
  const checkData = await checkRes.json();
  if (checkData.data && checkData.data.length > 0) return; // already exists

  // Create coupon (10% off, once, reusable)
  const couponRes = await fetch('https://api.stripe.com/v1/coupons', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ percent_off: '10', duration: 'once', name: 'Comeback 10% Off' })
  });
  const coupon = await couponRes.json();
  if (!coupon.id) return;

  // Create promotion code (reusable, no max redemptions)
  await fetch('https://api.stripe.com/v1/promotion_codes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ coupon: coupon.id, code: COMEBACK_CODE })
  });
}

function baseEmail(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
      </td></tr>
      <tr><td style="padding:36px 0;">${content}</td></tr>
      <tr><td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
        <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;&middot;&nbsp; Lancaster, PA &nbsp;&middot;&nbsp; Polaris Slingshot &amp; Can-Am Spyder Rentals</p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const { email, name, vehicle } = await req.json();
    if (!email || !vehicle) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    const firstName = (name || 'there').split(' ')[0];

    // Ensure COMEBACK10 promo code exists in Stripe
    await ensurePromoCode();

    const html = baseEmail(`
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 8px;">How Was<br><span style="color:#FF6B00;">Your Ride?</span></h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
        Hey ${firstName} — hope you had an amazing time on the <strong>${vehicle}</strong>! We'd love to hear about your experience.
      </p>

      <div style="text-align:center;margin-bottom:36px;">
        <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;background:#FF6B00;color:#000;font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.5px;padding:16px 40px;border-radius:8px;text-decoration:none;">
          Leave a Google Review &rarr;
        </a>
        <p style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:12px;">Takes less than 60 seconds</p>
      </div>

      <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">Your Review Helps Us</div>
        <p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.7;margin:0;">
          We're a small, locally owned rental in Lancaster, PA. Every Google review helps other people find us and helps us keep doing what we love. Even a few words and a star rating makes a real difference.
        </p>
      </div>

      <div style="text-align:center;">
        <p style="font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0 0 16px;">
          Want to ride again? Use code <strong style="color:#FF6B00;">COMEBACK10</strong> for 10% off your next rental.
        </p>
        <a href="https://cjfuntimerentals.com" style="display:inline-block;border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">
          Book Again &rarr;
        </a>
      </div>
    `);

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `How was your ${vehicle} ride? ⭐`,
      html
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
