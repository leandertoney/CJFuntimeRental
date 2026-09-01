// Google Analytics visitor numbers, for the admin dashboard.
//
// WHY THIS EXISTS: GA4 has no client-side read API. The gtag script on the site
// only WRITES events; nothing in a browser can read them back, because that
// would let anyone scrape the property by viewing source. Reading requires a
// server holding a credential, which is this function.
//
// Auth: a Google service account. Its private key lives in the Supabase secret
// GA_SERVICE_ACCOUNT_JSON and is never sent to the browser. This function mints
// a short-lived Google access token per call and asks the GA Data API.
//
// The admin token gate matters: without it this endpoint would publish CJ's
// traffic numbers to anyone who found the URL.

const CORS = {
  'Access-Control-Allow-Origin': 'https://cjfuntimerentals.com',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const PROPERTY_ID = Deno.env.get('GA_PROPERTY_ID') || '';
const SA_JSON = Deno.env.get('GA_SERVICE_ACCOUNT_JSON') || '';
// MUST mirror admin/index.ts exactly: same env var and the same fallback to the
// service key, or every valid admin token is rejected here.
const ADMIN_TOKEN_SECRET = Deno.env.get('ADMIN_TOKEN_SECRET')
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Verify the admin token issued by admin/index.ts. That implementation uses
// STANDARD base64 with the padding stripped, NOT base64url, and decodes the
// payload as UTF-8 bytes. Both details are load-bearing: a base64url comparison
// here rejects every legitimately signed token.
async function validAdmin(auth: string | null): Promise<boolean> {
  if (!auth || !ADMIN_TOKEN_SECRET) return false;
  const token = auth.replace(/^Bearer\s+/i, '');
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(ADMIN_TOKEN_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    let bin = '';
    for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
    const expected = btoa(bin).replace(/=+$/, '');
    if (sig !== expected) return false;
    const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return !!data.exp && data.exp > Date.now();
  } catch { return false; }
}

// Service-account OAuth: sign a JWT with the private key, swap it for an
// access token. Google's libraries do this; here it is by hand because Deno
// Edge Functions should not pull a heavy SDK for one call.
async function googleAccessToken(): Promise<string | null> {
  if (!SA_JSON) return null;
  let sa: { client_email: string; private_key: string };
  try { sa = JSON.parse(SA_JSON); } catch { return null; }
  if (!sa.client_email || !sa.private_key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })));

  // The PEM body is base64 DER; strip the header, footer and newlines.
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(header + '.' + claim));
  const jwt = header + '.' + claim + '.' + b64url(new Uint8Array(sig));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!res.ok) {
    console.error('[ga-stats] token exchange failed:', (await res.text()).slice(0, 300));
    return null;
  }
  return (await res.json()).access_token || null;
}

async function runReport(token: string, body: unknown) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  if (!res.ok) {
    console.error('[ga-stats] report failed:', (await res.text()).slice(0, 300));
    return null;
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  if (!await validAdmin(req.headers.get('authorization'))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Not configured is a NORMAL state, not an error: the admin panel shows the
  // database charts regardless and simply omits visitor numbers.
  if (!PROPERTY_ID || !SA_JSON) {
    return json({ configured: false, reason: 'Google Analytics is not connected yet.' });
  }

  try {
    const token = await googleAccessToken();
    if (!token) return json({ configured: false, reason: 'Could not authenticate with Google.' });

    const days = Number(new URL(req.url).searchParams.get('days')) || 28;
    const range = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

    const [totals, byChannel, byDay, topPages] = await Promise.all([
      runReport(token, { dateRanges: range,
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] }),
      runReport(token, { dateRanges: range,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
      runReport(token, { dateRanges: range,
        dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      runReport(token, { dateRanges: range,
        dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 6 })
    ]);

    const num = (r: Record<string, unknown> | null, i: number) => {
      const rows = (r?.rows || []) as Array<{ metricValues: Array<{ value: string }> }>;
      return rows.length ? Number(rows[0].metricValues[i]?.value || 0) : 0;
    };
    const pairs = (r: Record<string, unknown> | null) =>
      ((r?.rows || []) as Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>)
        .map(row => ({ label: row.dimensionValues[0].value, value: Number(row.metricValues[0].value || 0) }));

    return json({
      configured: true,
      days,
      users: num(totals, 0),
      sessions: num(totals, 1),
      pageviews: num(totals, 2),
      channels: pairs(byChannel),
      daily: pairs(byDay),
      pages: pairs(topPages)
    });
  } catch (err) {
    console.error('[ga-stats] threw:', (err as Error).message);
    return json({ configured: false, reason: 'Analytics is temporarily unavailable.' });
  }
});
