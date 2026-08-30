import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

const FROM = "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>";
// The domain is SEND-ONLY (no mailboxes), so every send sets Reply-To to the
// customer. Chris hits reply and it reaches the guest, not a black hole.
//
// Overridable by env ONLY so an end-to-end test can be run without mailing the
// real client a fake tour request. Unset in production, which is the default.
const OWNER_RECIPIENTS = (Deno.env.get('TOUR_OWNER_RECIPIENTS') || 'chrisjohnson839@gmail.com,leandertoney@gmail.com')
  .split(',').map(s => s.trim()).filter(Boolean);

// resend@2 is a passthrough: it forwards whatever key it is given straight into
// the API JSON body. The Resend API reads `reply_to`, so a camelCase `replyTo`
// alone is silently DROPPED and the reply address is lost. Verified by
// intercepting the SDK's own fetch. Both spellings are sent so the correct one
// always lands regardless of SDK version.
function replyTo(addr: string) {
  return { reply_to: addr, replyTo: addr } as Record<string, string>;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Mirrors the tiers published on /tours. Display only: this function never
// charges anything and never writes a money column. V1 deposits are a manual
// Stripe link sent by Chris after he confirms the date.
const TIERS: Record<number, number> = { 2: 450, 4: 700, 6: 900, 8: 1100 };

const ROUTES: Record<string, string> = {
  'north-east-md': 'North East, MD Run (Woody’s Crab House)',
  'gettysburg-york': 'Gettysburg / York History Route'
};

function quoteFor(size: number): string {
  const exact = TIERS[size];
  if (exact) return '$' + exact.toLocaleString();
  // Odd group sizes are real (a 5-person party books). We deliberately do NOT
  // invent a price for them; Chris quotes from the nearest vehicle count.
  const vehicles = Math.ceil(size / 2);
  const nearest = TIERS[vehicles * 2] ?? TIERS[8];
  return 'to be confirmed (nearest tier $' + nearest.toLocaleString() + ')';
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ownerEmail(r: Record<string, string>, quote: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:32px 0;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;padding:28px;">
    <tr><td>
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FF6B00;margin:0 0 8px;">New Tour Request</p>
      <h1 style="font-size:22px;margin:0 0 20px;">${esc(r.name)} wants to book a guided tour</h1>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.9;">
        <tr><td style="color:#666;width:140px;">Name</td><td><strong>${esc(r.name)}</strong></td></tr>
        <tr><td style="color:#666;">Email</td><td><a href="mailto:${esc(r.email)}" style="color:#FF6B00;">${esc(r.email)}</a></td></tr>
        <tr><td style="color:#666;">Phone</td><td><a href="tel:${esc(r.phone)}" style="color:#FF6B00;">${esc(r.phone)}</a></td></tr>
        <tr><td style="color:#666;">Preferred date</td><td><strong>${esc(r.preferred_date) || 'Not specified'}</strong></td></tr>
        <tr><td style="color:#666;">Group size</td><td><strong>${esc(r.group_size)} guests</strong></td></tr>
        <tr><td style="color:#666;">Route</td><td><strong>${esc(r.routeLabel)}</strong></td></tr>
        <tr><td style="color:#666;">Tour price</td><td><strong>${esc(quote)}</strong></td></tr>
      </table>
      ${r.notes ? `<p style="font-size:14px;background:#f6f6f6;border-radius:6px;padding:14px;margin:18px 0 0;line-height:1.7;"><strong>Notes:</strong><br>${esc(r.notes)}</p>` : ''}
      <p style="font-size:13px;color:#666;line-height:1.8;margin:22px 0 0;border-top:1px solid #eee;padding-top:18px;">
        This date showed as available on the live fleet calendar when they submitted. Next step: reply to this guest and send the $250 deposit link. The balance is due the day of the ride. Nothing has been charged yet.
      </p>
    </td></tr>
  </table></td></tr></table>
</body></html>`;
}

function guestEmail(r: Record<string, string>, quote: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:Helvetica,Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
    <tr><td style="padding:0 0 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
      <a href="https://cjfuntimerentals.com"><img src="https://cjfuntimerentals.com/cj_funtime_logo.png" alt="CJ's Fun Time Rental" width="140" style="display:block;height:auto;margin:0 auto;"></a>
    </td></tr>
    <tr><td style="padding:36px 0;">
      <h1 style="font-family:Impact,Arial,sans-serif;font-size:32px;letter-spacing:2px;margin:0 0 16px;">We Got Your Tour Request</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.65);line-height:1.8;margin:0 0 24px;">
        Thanks ${esc(r.name)}. Your date was open on our fleet calendar when you sent this, so we are good to go. Chris personally guides every tour and will be in touch shortly with your deposit link.
      </p>
      <div style="background:#1a1a1a;border:1px solid rgba(255,107,0,0.3);border-radius:10px;padding:24px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:2;color:rgba(255,255,255,0.85);">
          <tr><td style="color:#888;width:130px;">Route</td><td>${esc(r.routeLabel)}</td></tr>
          <tr><td style="color:#888;">Preferred date</td><td>${esc(r.preferred_date) || 'Flexible'}</td></tr>
          <tr><td style="color:#888;">Group size</td><td>${esc(r.group_size)} guests</td></tr>
          <tr><td style="color:#888;">Tour price</td><td style="color:#FF6B00;font-weight:700;">${esc(quote)}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;margin:0 0 10px;"><strong style="color:#fff;">What happens next</strong></p>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.8;margin:0 0 24px;">
        1. Chris gets in touch to lock in the details.<br>
        2. He sends a secure payment link for the $250 deposit, which holds the date.<br>
        3. The remainder is due the day of the ride.<br><br>
        Rained out? You reschedule free. We would rather move your date than run a tour in the wet.
      </p>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);line-height:1.8;margin:0;">
        Nothing has been charged yet. Just reply to this email if anything above looks wrong.
      </p>
    </td></tr>
    <tr><td style="padding:28px 0 0;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
      <p style="font-size:11px;color:#555;margin:0;">CJ's Fun Time Rental &nbsp;&middot;&nbsp; Lancaster, PA &nbsp;&middot;&nbsp; Guided Slingshot Tours</p>
    </td></tr>
  </table></td></tr></table>
</body></html>`;
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
    const preferred_date = String(body.preferred_date ?? '').trim() || null;
    const group_size = Number(body.group_size);
    const route = String(body.route ?? '').trim();
    const notes = String(body.notes ?? '').trim() || null;

    if (!name) return json({ error: 'Name is required' }, 400);
    if (!email.includes('@')) return json({ error: 'A valid email is required' }, 400);
    if (!phone) return json({ error: 'Phone is required' }, 400);
    if (!Number.isInteger(group_size) || group_size < 2 || group_size > 8) {
      return json({ error: 'Group size must be between 2 and 8' }, 400);
    }
    if (!ROUTES[route]) return json({ error: 'Please choose a route' }, 400);
    // Date is optional, but if given it must be a real ISO date the DB accepts.
    if (preferred_date && !/^\d{4}-\d{2}-\d{2}$/.test(preferred_date)) {
      return json({ error: 'Preferred date must be a valid date' }, 400);
    }

    const { data, error } = await supabase
      .from('tour_requests')
      .insert({ name, email, phone, preferred_date, group_size, route, notes, source: body.source || 'tours-page' })
      .select('id')
      .single();

    if (error) {
      console.error('[tour-request] insert failed:', error.message);
      return json({ error: 'Could not save your request. Please call us instead.' }, 500);
    }

    const quote = quoteFor(group_size);
    const view = {
      name, email, phone, notes: notes ?? '',
      preferred_date: preferred_date ?? '',
      group_size: String(group_size),
      routeLabel: ROUTES[route]
    } as Record<string, string>;

    // The lead is already saved, so email failure must not fail the request.
    //
    // The test-data guard is deliberately NARROW here. The scheduled emails can
    // afford to skip anything containing "test", but this owner email is the
    // ONLY way a tour lead surfaces -- there is no admin UI for tour_requests
    // yet. A real customer at contestwinner@gmail.com would be saved and then
    // silently never reported, which is a lost booking. So: only the reserved
    // @example.com domain, or an explicit flag sent by our own E2E test.
    const isTest = email.endsWith('@example.com') || body.source === 'e2e-test';
    if (!isTest) {
      try {
        await resend.emails.send({
          from: FROM,
          to: OWNER_RECIPIENTS,
          ...replyTo(email),
          subject: `New tour request: ${name}, ${group_size} guests, ${ROUTES[route]}`,
          html: ownerEmail(view, quote)
        });
      } catch (err) {
        console.error('[tour-request] owner email failed:', (err as Error).message);
      }
      try {
        await resend.emails.send({
          from: FROM,
          to: email,
          ...replyTo(OWNER_RECIPIENTS[0]),
          subject: 'We got your guided tour request',
          html: guestEmail(view, quote)
        });
      } catch (err) {
        console.error('[tour-request] guest email failed:', (err as Error).message);
      }
    }

    return json({ ok: true, id: data.id, skipped: isTest ? 'test-data' : undefined });
  } catch (err) {
    console.error('[tour-request] threw:', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
