import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('ADMIN_TOKEN_SECRET') || SERVICE_KEY;

// Service client — bypasses RLS, used for all data operations
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── SHA-256 password hashing (Web Crypto) ───────────────────────────────────
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Admin users — passwords stored as SHA-256 hashes
const ADMIN_USERS: { email: string; name: string; hash: string }[] = [];
async function initUsers() {
  if (ADMIN_USERS.length) return;
  ADMIN_USERS.push(
    { email: 'leandertoney@gmail.com',   name: 'Leander', hash: await sha256('Ballin!23') },
    { email: 'chrisjohnson839@gmail.com', name: 'Chris',   hash: await sha256('Rental$!23') },
  );
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// ── HMAC token helpers ──────────────────────────────────────────────────────
async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '');
}

async function createToken(email: string, name: string): Promise<string> {
  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload = JSON.stringify({ email, name, exp });
  const b64 = btoa(payload);
  const sig = await hmacSign(b64);
  return b64 + '.' + sig;
}

async function verifyToken(token: string): Promise<{ email: string; name: string } | null> {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = await hmacSign(b64);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(atob(b64));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { email: payload.email, name: payload.name };
  } catch { return null; }
}

async function verifyAuth(req: Request): Promise<{ email: string; name: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return await verifyToken(token);
}

// ── AI Chat helpers ──────────────────────────────────────────────────────────

const ADMIN_TOOLS = [
  { type: 'function', function: { name: 'get_vehicles', description: 'Read all vehicles with names, daily rates, availability, and all detail fields.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'update_vehicle', description: "Update any fields on an existing vehicle. Can change ratePerDay, available, name, label, tag, specs, img, badges, tagline, specsList, features, safety, connectivity, included, reviews.", parameters: { type: 'object', properties: { vehicleKey: { type: 'string', description: 'The vehicle key (e.g. slingshot_2022)' }, ratePerDay: { type: 'number' }, available: { type: 'boolean' }, name: { type: 'string' }, label: { type: 'string' }, tag: { type: 'string' }, specs: { type: 'string' }, img: { type: 'string' }, tagline: { type: 'string' }, badges: { type: 'array', items: { type: 'string' } }, specsList: { type: 'array', items: { type: 'string' } }, features: { type: 'array', items: { type: 'string' } }, safety: { type: 'array', items: { type: 'string' } }, connectivity: { type: 'array', items: { type: 'string' } }, included: { type: 'array', items: { type: 'string' } }, reviews: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rating: { type: 'number' }, text: { type: 'string' } } } } }, required: ['vehicleKey'] } } },
  { type: 'function', function: { name: 'add_vehicle', description: 'Add a new vehicle to the fleet. Provide a unique vehicleKey (lowercase_with_underscores), name, label, ratePerDay, img (filename), tag, specs (short string), and optionally all detail arrays.', parameters: { type: 'object', properties: { vehicleKey: { type: 'string', description: 'Unique key like slingshot_2024 or vanderhall_venice' }, name: { type: 'string' }, label: { type: 'string' }, ratePerDay: { type: 'number' }, img: { type: 'string' }, tag: { type: 'string' }, specs: { type: 'string' }, tagline: { type: 'string' }, badges: { type: 'array', items: { type: 'string' } }, specsList: { type: 'array', items: { type: 'string' } }, features: { type: 'array', items: { type: 'string' } }, safety: { type: 'array', items: { type: 'string' } }, connectivity: { type: 'array', items: { type: 'string' } }, included: { type: 'array', items: { type: 'string' } }, reviews: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rating: { type: 'number' }, text: { type: 'string' } } } } }, required: ['vehicleKey', 'name', 'ratePerDay'] } } },
  { type: 'function', function: { name: 'delete_vehicle', description: 'Remove a vehicle from the fleet by its key.', parameters: { type: 'object', properties: { vehicleKey: { type: 'string' } }, required: ['vehicleKey'] } } },
  { type: 'function', function: { name: 'update_all_vehicle_rates', description: 'Set the same ratePerDay for every vehicle.', parameters: { type: 'object', properties: { ratePerDay: { type: 'number' } }, required: ['ratePerDay'] } } },
  { type: 'function', function: { name: 'get_leads', description: 'Read all leads with email, source, date, promo code.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'delete_lead', description: 'Delete a lead by email.', parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_lead', description: 'Send a discount code email to a single lead.', parameters: { type: 'object', properties: { email: { type: 'string' }, code: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_all_leads', description: 'Send a discount code email to every lead.', parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } } },
  { type: 'function', function: { name: 'get_discounts', description: 'Read discount tiers — days, percentage, label, enabled.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'get_blocked_dates', description: 'Read all blocked dates unavailable for booking.', parameters: { type: 'object', properties: {}, required: [] } } },
];

async function readConfig() {
  const { data } = await supabase.from('site_config').select('config').eq('id', 1).single();
  return data?.config;
}

async function writeConfig(cfg: unknown) {
  await supabase.from('site_config').upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() });
}

async function executeToolCall(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'get_vehicles': {
      const cfg = await readConfig();
      return { vehicles: cfg?.vehicles };
    }
    case 'update_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      const v = cfg?.vehicles?.[key];
      if (!v) return { error: 'Unknown vehicle key: ' + key };
      const editableFields = ['ratePerDay','available','name','label','tag','specs','img','tagline','badges','specsList','features','safety','connectivity','included','reviews'];
      for (const f of editableFields) {
        if (input[f] !== undefined) (v as Record<string, unknown>)[f] = input[f];
      }
      await writeConfig(cfg);
      return { ok: true, updated: v };
    }
    case 'add_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      if (cfg.vehicles[key]) return { error: 'Vehicle key already exists: ' + key };
      cfg.vehicles[key] = {
        available: true,
        name: input.name || key,
        label: input.label || input.name || key,
        tag: input.tag || '',
        specs: input.specs || '',
        ratePerDay: input.ratePerDay || 0,
        img: input.img || '',
        badges: input.badges || [],
        tagline: input.tagline || '',
        specsList: input.specsList || [],
        features: input.features || [],
        safety: input.safety || [],
        connectivity: input.connectivity || [],
        included: input.included || [],
        reviews: input.reviews || [],
        stripeProductId: '',
      };
      await writeConfig(cfg);
      return { ok: true, added: key, vehicle: cfg.vehicles[key] };
    }
    case 'delete_vehicle': {
      const cfg = await readConfig();
      const key = input.vehicleKey as string;
      if (!cfg.vehicles[key]) return { error: 'Vehicle not found: ' + key };
      const deleted = cfg.vehicles[key];
      delete cfg.vehicles[key];
      await writeConfig(cfg);
      return { ok: true, deleted: key, vehicle: deleted };
    }
    case 'update_all_vehicle_rates': {
      const cfg = await readConfig();
      for (const key of Object.keys(cfg.vehicles)) {
        cfg.vehicles[key].ratePerDay = input.ratePerDay;
      }
      await writeConfig(cfg);
      return { ok: true, ratePerDay: input.ratePerDay };
    }
    case 'get_leads': {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return { count: data?.length ?? 0, leads: data };
    }
    case 'delete_lead': {
      const { data } = await supabase.from('leads').select('id, email').ilike('email', input.email as string);
      if (!data?.length) return { error: 'Lead not found: ' + input.email };
      await supabase.from('leads').delete().eq('id', data[0].id);
      return { ok: true, deleted: input.email };
    }
    case 'send_promo_to_lead': {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
      const code = (input.code as string) || 'FIRST10';
      await resend.emails.send({
        from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
        to: input.email as string,
        subject: `Your ${code} discount code — CJ's Fun Time Rental`,
        html: `<p>Your code: <strong>${code}</strong></p>`
      });
      return { ok: true, sentTo: input.email, code };
    }
    case 'send_promo_to_all_leads': {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
      const { data: leads } = await supabase.from('leads').select('email');
      const results = [];
      for (const lead of (leads ?? [])) {
        try {
          await resend.emails.send({
            from: "CJ's Fun Time Rental <bookings@cjfuntimerentals.com>",
            to: lead.email,
            subject: `Your ${input.code} discount code — CJ's Fun Time Rental`,
            html: `<p>Your code: <strong>${input.code}</strong></p>`
          });
          results.push({ email: lead.email, sent: true });
        } catch (e) {
          results.push({ email: lead.email, sent: false, error: (e as Error).message });
        }
      }
      return { ok: true, results };
    }
    case 'get_discounts': {
      const cfg = await readConfig();
      return { discounts: cfg?.discounts };
    }
    case 'get_blocked_dates': {
      const cfg = await readConfig();
      return { blockedDates: cfg?.blockedDates, count: cfg?.blockedDates?.length ?? 0 };
    }
    default:
      return { error: 'Unknown tool: ' + name };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin/, '');

  // ── Login (public) ─────────────────────────────────────────────────────────
  if (path === '/login' && req.method === 'POST') {
    await initUsers();
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: 'Email and password required' }, 400);
    const user = ADMIN_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    const pwHash = await sha256(password);
    if (!user || user.hash !== pwHash) {
      return json({ error: 'Invalid email or password' }, 401);
    }
    const token = await createToken(user.email, user.name);
    return json({ ok: true, token, name: user.name, email: user.email });
  }

  // ── Me (public — returns logged-in status) ────────────────────────────────
  if (path === '/me' && req.method === 'GET') {
    const user = await verifyAuth(req);
    if (user) return json({ loggedIn: true, name: user.name, email: user.email });
    return json({ loggedIn: false });
  }

  // All other endpoints require a valid token
  const authedUser = await verifyAuth(req);
  if (!authedUser) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Change password ────────────────────────────────────────────────────────
  if (path === '/change-password' && req.method === 'POST') {
    await initUsers();
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) return json({ error: 'Both passwords required' }, 400);
    if (newPassword.length < 8) return json({ error: 'New password must be at least 8 characters' }, 400);
    const user = ADMIN_USERS.find(u => u.email === authedUser.email);
    const curHash = await sha256(currentPassword);
    if (!user || user.hash !== curHash) {
      return json({ error: 'Current password is incorrect' }, 401);
    }
    user.hash = await sha256(newPassword);
    return json({ ok: true });
  }

  // ── Config ──────────────────────────────────────────────────────────────────
  if (path === '/config' && req.method === 'GET') {
    const { data, error } = await supabase.from('site_config').select('config').eq('id', 1).single();
    if (error) return json({ error: error.message }, 500);
    return json(data.config);
  }

  if (path === '/config' && req.method === 'POST') {
    const incoming = await req.json();
    const required = ['sections', 'vehicles', 'copy', 'faqs', 'discounts', 'blockedDates'];
    for (const key of required) {
      if (!(key in incoming)) return json({ error: 'Missing key: ' + key }, 400);
    }
    incoming._lastSaved = new Date().toISOString();
    const { error } = await supabase.from('site_config').upsert({ id: 1, config: incoming, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Leads ───────────────────────────────────────────────────────────────────
  if (path === '/leads' && req.method === 'GET') {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  if (path.startsWith('/leads/') && req.method === 'DELETE') {
    const id = path.replace('/leads/', '');
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Bookings ────────────────────────────────────────────────────────────────
  if (path === '/bookings' && req.method === 'GET') {
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // ── AI Chat ─────────────────────────────────────────────────────────────────
  if (path === '/chat' && req.method === 'POST') {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return json({ reply: 'AI assistant is not configured.', suggestions: [] });

    const { message } = await req.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return json({ reply: 'Please provide a message.', suggestions: [] });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are CJ Assistant, a helpful admin tool for CJ's Fun Time Rental — a 3-wheel vehicle rental business in Lancaster, PA. Use tools to execute commands. Today: ${today}. Use get_vehicles to see current fleet. You can add_vehicle, update_vehicle (any field), and delete_vehicle. Vehicle keys are lowercase_with_underscores (e.g. slingshot_2024).`;

    const messages: unknown[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message.trim() }
    ];

    let loopCount = 0;
    while (loopCount++ < 10) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', tools: ADMIN_TOOLS, messages })
      });
      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) break;
      messages.push(choice.message);
      if (choice.finish_reason === 'stop') break;
      if (choice.finish_reason === 'tool_calls') {
        for (const toolCall of choice.message.tool_calls) {
          const toolInput = JSON.parse(toolCall.function.arguments);
          const result = await executeToolCall(toolCall.function.name, toolInput);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }
      } else break;
    }

    const jsonSystemPrompt = `You are CJ Assistant for CJ's Fun Time Rental. Guide the admin with clickable chips. You can manage vehicles (add, update, delete), leads, promos, discounts, and blocked dates. REPLY: 1 sentence max, plain text, no markdown. CHIPS: 3-6 specific, actionable options. Respond ONLY with valid JSON: {"reply":"...","chips":["...","...","..."]}`;

    const jsonRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: jsonSystemPrompt }, ...messages.slice(1)]
      })
    });
    const jsonData = await jsonRes.json();

    let reply = 'Done.';
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(jsonData.choices[0].message.content);
      reply       = parsed.reply   || 'Done.';
      suggestions = parsed.chips   || parsed.suggestions || [];
    } catch {
      reply = jsonData.choices?.[0]?.message?.content || 'Done.';
    }

    return json({ reply, suggestions });
  }

  return json({ error: 'Not found' }, 404);
});
