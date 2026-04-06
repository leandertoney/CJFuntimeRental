import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'demo123';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, 401);
}

// ── AI Chat helpers ──────────────────────────────────────────────────────────

const ADMIN_TOOLS = [
  { type: 'function', function: { name: 'get_vehicles',          description: 'Read all vehicles with names, daily rates, and availability.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'update_vehicle',        description: "Update a vehicle's ratePerDay or available status. vehicleKey: slingshot_2022 | slingshot_2020 | canam_spyder.", parameters: { type: 'object', properties: { vehicleKey: { type: 'string', enum: ['slingshot_2022','slingshot_2020','canam_spyder'] }, ratePerDay: { type: 'number' }, available: { type: 'boolean' } }, required: ['vehicleKey'] } } },
  { type: 'function', function: { name: 'update_all_vehicle_rates', description: 'Set the same ratePerDay for every vehicle.', parameters: { type: 'object', properties: { ratePerDay: { type: 'number' } }, required: ['ratePerDay'] } } },
  { type: 'function', function: { name: 'get_leads',             description: 'Read all leads with email, source, date, promo code.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'delete_lead',           description: 'Delete a lead by email.', parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_lead',    description: 'Send a discount code email to a single lead.', parameters: { type: 'object', properties: { email: { type: 'string' }, code: { type: 'string' } }, required: ['email'] } } },
  { type: 'function', function: { name: 'send_promo_to_all_leads', description: 'Send a discount code email to every lead.', parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } } },
  { type: 'function', function: { name: 'get_discounts',         description: 'Read discount tiers — days, percentage, label, enabled.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'get_blocked_dates',     description: 'Read all blocked dates unavailable for booking.', parameters: { type: 'object', properties: {}, required: [] } } },
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
      if (input.ratePerDay !== undefined) v.ratePerDay = input.ratePerDay;
      if (input.available  !== undefined) v.available  = input.available;
      await writeConfig(cfg);
      return { ok: true, updated: v };
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
  const path = url.pathname.replace(/^\/functions\/v1\/admin/, '');

  // ── Auth check ──────────────────────────────────────────────────────────────
  // Login endpoint — no auth required
  if (path === '/auth/login' && req.method === 'POST') {
    const { password } = await req.json();
    if (password === ADMIN_PASSWORD) return json({ ok: true });
    return json({ error: 'Invalid password' }, 401);
  }

  // All other endpoints require password header
  const adminPass = req.headers.get('x-admin-password');
  if (adminPass !== ADMIN_PASSWORD) return unauthorized();

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
    const systemPrompt = `You are CJ Assistant, a helpful admin tool for CJ's Fun Time Rental — a 3-wheel vehicle rental business in Lancaster, PA. Use tools to execute commands. Today: ${today}. Vehicle keys: slingshot_2022 (2022 Polaris Slingshot), slingshot_2020 (2020 Polaris Slingshot), canam_spyder (2021 Can-Am Spyder F3 Limited).`;

    const messages: unknown[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message.trim() }
    ];

    // Agentic tool-use loop
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

    // JSON-mode call for final reply + chips
    const jsonSystemPrompt = `You are CJ Assistant for CJ's Fun Time Rental. Vehicles: 2022 Polaris Slingshot (slingshot_2022), 2020 Polaris Slingshot (slingshot_2020), 2021 Can-Am Spyder F3 Limited (canam_spyder). Guide the admin with clickable chips. REPLY: 1 sentence max, plain text, no markdown. CHIPS: 3-6 specific, actionable options. Respond ONLY with valid JSON: {"reply":"...","chips":["...","...","..."]}`;

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
