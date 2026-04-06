import { Resend } from 'https://esm.sh/resend@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";

function baseEmail(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center"><table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 32px 0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
      </td></tr>
      <tr><td style="padding:36px 0;">${content}</td></tr>
      <tr><td style="padding:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
        <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;·&nbsp; Lancaster, PA &nbsp;·&nbsp; Polaris Slingshot &amp; Can-Am Spyder Rentals</p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const { email, name, vehicle, startDate } = await req.json();
    if (!email || !vehicle || !startDate) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    const firstName = (name || 'there').split(' ')[0];

    const html = baseEmail(`
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:36px;letter-spacing:3px;margin:0 0 8px;">Your Ride Is<br><span style="color:#FF6B00;">Tomorrow!</span></h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:16px 0 32px;line-height:1.7;">
        Hey ${firstName} — just a friendly reminder that your <strong>${vehicle}</strong> rental kicks off tomorrow, <strong>${startDate}</strong>. We can't wait to get you out on the road.
      </p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:24px;margin-bottom:32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FF6B00;margin-bottom:16px;">What to Bring</div>
        <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 10px;">✓ &nbsp;Valid driver's license</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0 0 10px;">✓ &nbsp;Credit card used at booking</p>
        <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;">✓ &nbsp;Comfortable clothes — it's an open-air ride</p>
      </div>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0;">
        Chris will confirm your exact pickup location shortly if you haven't heard yet. Questions? Just reply to this email.
      </p>
    `);

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `🏎️ Tomorrow's the day — your ${vehicle} rental reminder`,
      html
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
