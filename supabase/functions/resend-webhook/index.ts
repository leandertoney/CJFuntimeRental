// Receives delivery/open/bounce events from Resend and records them against
// the campaign_emails row for that message.
//
// Why a webhook and not polling: the RESEND_API_KEY in this project is a
// SEND-ONLY key. It returns 401 on /emails and every other read endpoint, so
// there is no way to ask Resend whether something was opened. Resend has to
// tell us. Escalating the key to full access just to poll would widen what a
// leaked key could do, for data that is pushed to us for free.
//
// Deployed with --no-verify-jwt: Resend does not carry a Supabase JWT. The
// Svix signature below is what authenticates the request, so it is not
// optional. Without it, anyone who found this URL could invent opens.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Svix signs `${id}.${timestamp}.${body}` with the base64 secret that follows
// the "whsec_" prefix, and sends one or more space-separated `v1,<sig>` pairs.
async function verify(secret: string, id: string, ts: string, sigHeader: string, body: string) {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time compare, so a wrong signature cannot be guessed byte by byte.
  for (const part of sigHeader.split(' ')) {
    const got = part.split(',')[1];
    if (!got || got.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET is not set; refusing to trust this request');
    return new Response('Not configured', { status: 500 });
  }

  const id  = req.headers.get('svix-id');
  const ts  = req.headers.get('svix-timestamp');
  const sig = req.headers.get('svix-signature');
  const body = await req.text();
  if (!id || !ts || !sig) return new Response('Missing signature headers', { status: 401 });

  // Reject replays of an old, validly-signed request.
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return new Response('Timestamp out of tolerance', { status: 401 });

  if (!(await verify(secret, id, ts, sig, body))) {
    return new Response('Bad signature', { status: 401 });
  }

  let evt: { type?: string; data?: { email_id?: string } };
  try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

  const emailId = evt?.data?.email_id;
  if (!emailId) return new Response('ok', { status: 200 });

  const column = evt.type === 'email.opened'    ? 'opened_at'
               : evt.type === 'email.delivered' ? 'delivered_at'
               : evt.type === 'email.bounced'   ? 'bounced_at'
               : null;
  // Anything else (sent, delivery_delayed, complained) is acknowledged and
  // ignored. Returning non-200 would make Resend retry an event we do not want.
  if (!column) return new Response('ok', { status: 200 });

  // Only the FIRST event of a kind counts: `is null` makes this idempotent, so
  // Resend's retries and a recipient opening the mail five times both leave a
  // single timestamp. That is what makes the panel's number unique recipients.
  const { error } = await supabase
    .from('campaign_emails')
    .update({ [column]: new Date().toISOString() })
    .eq('email_id', emailId)
    .is(column, null);

  if (error) {
    // 500 so Resend retries; the update is idempotent so a retry is harmless.
    console.error('[resend-webhook] update failed:', error.message);
    return new Response('Update failed', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
