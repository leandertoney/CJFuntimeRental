require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');

const ADMIN_USERS_PATH = path.join(__dirname, 'data', 'admin-users.json');
function readAdminUsers() {
  return JSON.parse(fs.readFileSync(ADMIN_USERS_PATH, 'utf8'));
}
function writeAdminUsers(users) {
  fs.writeFileSync(ADMIN_USERS_PATH, JSON.stringify(users, null, 2));
}
const OpenAI  = require('openai');
const { sendDiscountCode, sendBookingConfirmation, sendOwnerBookingAlert, sendPickupReminder } = require('./emails');
const { readConfig, writeConfig, readLeads, insertLead, deleteLead, readBookings, insertBooking } = require('./db');

// ── Stripe (only active when key is set) ──────────────────────────────────────
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_REPLACE')) return null;
  return require('stripe')(key);
}

async function createStripePromoCode(email) {
  const stripe = getStripe();
  if (!stripe) {
    return 'FIRST10-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  const coupon = await stripe.coupons.create({
    percent_off:     10,
    duration:        'once',
    name:            '10% Off First Rental',
    max_redemptions: 1,
    metadata:        { email }
  });
  const promo = await stripe.promotionCodes.create({
    coupon:          coupon.id,
    max_redemptions: 1,
    metadata:        { email },
    code:            'FIRST10-' + crypto.randomBytes(4).toString('hex').toUpperCase()
  });
  return promo.code;
}

const ADMIN_DIR = path.join(__dirname, 'admin');
const PORT      = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'cjfr-dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   false,   // set to true in prod behind HTTPS
    sameSite: 'strict',
    maxAge:   8 * 60 * 60 * 1000
  }
}));

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  // Legacy session auth
  if (req.session && req.session.adminLoggedIn) return next();

  // Supabase Bearer token auth
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    // Decode JWT payload (no signature verify needed — Supabase validates on its end;
    // we just confirm the token is for our project and not expired)
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const projectRef = (process.env.SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1];
      if (payload.iss && payload.iss.includes(projectRef) && payload.exp > Date.now() / 1000) {
        return next();
      }
    } catch (e) { /* fall through */ }
  }

  res.status(401).json({ error: 'Unauthorized' });
}

// ── Dynamic config script (public) ────────────────────────────────────────────
app.get('/site-config.js', async (req, res) => {
  try {
    const cfg = await readConfig();
    const pub = {
      sections:     cfg.sections,
      vehicles:     cfg.vehicles,
      copy:         cfg.copy,
      faqs:         cfg.faqs,
      discounts:    cfg.discounts,
      blockedDates: cfg.blockedDates
    };
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send('window.SITE_CONFIG = ' + JSON.stringify(pub) + ';');
  } catch (e) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send('window.SITE_CONFIG = null;');
  }
});

// ── Auth routes ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const users = readAdminUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.adminLoggedIn = true;
    req.session.adminEmail    = user.email;
    req.session.adminName     = user.name;
    res.json({ ok: true, name: user.name });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.adminLoggedIn) {
    return res.json({ loggedIn: true, name: req.session.adminName, email: req.session.adminEmail });
  }
  res.json({ loggedIn: false });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const users = readAdminUsers();
    const idx   = users.findIndex(u => u.email === req.session.adminEmail);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    if (!(await bcrypt.compare(currentPassword, users[idx].password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    users[idx].password_hash = await bcrypt.hash(newPassword, 12);
    writeAdminUsers(users);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not update password' });
  }
});

// ── Config API (protected) ─────────────────────────────────────────────────────
app.get('/api/config', requireAuth, async (req, res) => {
  try {
    res.json(await readConfig());
  } catch (e) {
    res.status(500).json({ error: 'Could not read config' });
  }
});

app.post('/api/config', requireAuth, async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Invalid config' });
    }
    const required = ['sections', 'vehicles', 'copy', 'faqs', 'discounts', 'blockedDates'];
    for (const key of required) {
      if (!(key in incoming)) return res.status(400).json({ error: 'Missing key: ' + key });
    }
    await writeConfig(incoming);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not save config' });
  }
});

// ── Leads API ──────────────────────────────────────────────────────────────────
// Public — anyone submitting the form hits this
app.post('/api/leads', async (req, res) => {
  const { email, source } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  const cleanEmail = email.trim().toLowerCase();

  res.json({ ok: true });

  // Generate promo code, save lead, send email — all async after response
  createStripePromoCode(cleanEmail)
    .then(async code => {
      await insertLead({ email: cleanEmail, source: source || 'website', promoCode: code });
      await sendDiscountCode(cleanEmail, code);
    })
    .catch(err => console.error('Lead flow error:', err.message));
});

// ── Stripe Checkout ────────────────────────────────────────────────────────────
const STRIPE_PRICE_IDS = {
  slingshot_2022: 'price_1TJ1WhDlmCSCy5M3ZzTUKo6U',
  slingshot_2020: 'price_1TJ1WhDlmCSCy5M3lht61h3l',
  canam_spyder:   'price_1TJ1WiDlmCSCy5M30zruaRZ7'
};

app.post('/api/checkout', async (req, res) => {
  const { vehicleKey, days, startDate, endDate, promoCode } = req.body;
  if (!vehicleKey || !days || !startDate) return res.status(400).json({ error: 'Missing fields' });

  const priceId = STRIPE_PRICE_IDS[vehicleKey];
  if (!priceId) return res.status(400).json({ error: 'Unknown vehicle' });

  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    // Look up current rate from config so pricing is always up to date
    let unitAmount;
    try {
      const cfg = await readConfig();
      const vehicle = cfg.vehicles[vehicleKey];
      unitAmount = vehicle ? Math.round(vehicle.ratePerDay * 100) : null;
    } catch (_) {}

    const STRIPE_PRODUCTS = {
      slingshot_2022: 'prod_UHaiSY5zFpsDcV',
      slingshot_2020: 'prod_UHaiT4pRmY2sos',
      canam_spyder:   'prod_UHai9cIGKdkLoW'
    };

    // Fall back to static price ID if config unavailable
    const lineItem = unitAmount
      ? {
          price_data: {
            currency:    'usd',
            unit_amount: unitAmount,
            product:     STRIPE_PRODUCTS[vehicleKey]
          },
          quantity: Number(days)
        }
      : { price: priceId, quantity: Number(days) };

    const sessionParams = {
      mode:                 'payment',
      line_items: [lineItem],
      metadata: { vehicleKey, startDate, endDate: endDate || startDate, days },
      success_url: 'https://cjfuntimerentals.com/booking-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  'https://cjfuntimerentals.com',
      phone_number_collection: { enabled: true },
      custom_fields: [
        {
          key:   'pickup_date',
          label: { type: 'custom', custom: 'Pickup Date' },
          type:  'text',
          text:  { default_value: startDate }
        },
        {
          key:   'return_date',
          label: { type: 'custom', custom: 'Return Date' },
          type:  'text',
          text:  { default_value: endDate || startDate }
        }
      ]
    };

    // Apply promo code if provided
    if (promoCode) {
      sessionParams.discounts = [{ promotion_code: promoCode }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe Webhook (fires after successful payment) ────────────────────────────
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body);
  } catch (err) {
    return res.status(400).send('Webhook error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const meta     = session.metadata || {};
    const customer = session.customer_details || {};
    const email    = customer.email || '';
    const name     = customer.name  || '';
    const phone    = customer.phone || '';
    const total    = (session.amount_total / 100).toFixed(2);
    const discount = session.total_details?.amount_discount
      ? (session.total_details.amount_discount / 100).toFixed(2)
      : null;

    // Look up vehicle name from config
    let vehicleName = meta.vehicleKey || 'Vehicle';
    try {
      const cfg = await readConfig();
      vehicleName = cfg.vehicles[meta.vehicleKey]?.name || vehicleName;
    } catch (_) {}

    // Save booking to Supabase
    await insertBooking({
      id:        session.id,
      email:     email.toLowerCase(),
      name,
      phone,
      vehicle:   vehicleName,
      startDate: meta.startDate,
      endDate:   meta.endDate,
      days:      Number(meta.days) || 1,
      total:     Number(total),
      savings:   discount ? Number(discount) : 0
    });

    // Send emails
    await Promise.all([
      sendBookingConfirmation({ email, name, vehicle: vehicleName, startDate: meta.startDate, endDate: meta.endDate, days: meta.days, total, savings: discount }),
      sendOwnerBookingAlert({ name, email, phone, vehicle: vehicleName, startDate: meta.startDate, endDate: meta.endDate, days: meta.days, total })
    ]).catch(err => console.error('Post-payment email error:', err.message));
  }

  res.json({ received: true });
});

// Manual booking confirmation fallback
app.post('/api/booking-confirmed', async (req, res) => {
  const { email, name, vehicle, startDate, endDate, days, total, savings } = req.body;
  if (!email || !vehicle || !startDate) return res.status(400).json({ error: 'Missing fields' });
  try {
    await insertBooking({
      id:        crypto.randomBytes(8).toString('hex'),
      email:     email.trim().toLowerCase(),
      name:      name || '',
      phone:     req.body.phone || '',
      vehicle, startDate,
      endDate:   endDate || startDate,
      days:      Number(days) || 1,
      total:     Number(total) || 0,
      savings:   Number(savings) || 0
    });
    await Promise.all([
      sendBookingConfirmation({ email, name, vehicle, startDate, endDate, days, total, savings }),
      sendOwnerBookingAlert({ name, email, phone: req.body.phone, vehicle, startDate, endDate, days, total })
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Booking error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  res.json(await readBookings());
});

// Protected — admin only
app.get('/api/leads', requireAuth, async (req, res) => {
  res.json(await readLeads());
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    await deleteLead(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Admin Chat ──────────────────────────────────────────────────────────────
const ADMIN_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_vehicles',
      description: 'Read the current list of all vehicles with their names, daily rates, and availability status.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_vehicle',
      description: 'Update one vehicle\'s ratePerDay or available status. Vehicle keys: slingshot_2022, slingshot_2020, canam_spyder.',
      parameters: {
        type: 'object',
        properties: {
          vehicleKey: { type: 'string', enum: ['slingshot_2022', 'slingshot_2020', 'canam_spyder'], description: 'The internal key for the vehicle.' },
          ratePerDay: { type: 'number', description: 'New daily rate in dollars. Omit to leave unchanged.' },
          available:  { type: 'boolean', description: 'Whether the vehicle is available for booking. Omit to leave unchanged.' }
        },
        required: ['vehicleKey']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_all_vehicle_rates',
      description: 'Set the same ratePerDay for every vehicle at once.',
      parameters: {
        type: 'object',
        properties: {
          ratePerDay: { type: 'number', description: 'The new daily rate to apply to all vehicles.' }
        },
        required: ['ratePerDay']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_leads',
      description: 'Read all leads. Returns the full list with email, source, date, and promo code.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_lead',
      description: 'Delete a lead by email address.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'The email address of the lead to delete.' }
        },
        required: ['email']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_promo_to_lead',
      description: 'Send a discount code email to a single lead by email address.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'The recipient\'s email address.' },
          code:  { type: 'string', description: 'The promo code to send. Defaults to FIRST10 if omitted.' }
        },
        required: ['email']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_promo_to_all_leads',
      description: 'Send a discount code email to every lead in the system.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The promo code to send to all leads.' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_discounts',
      description: 'Read the current discount tiers — days required, percentage off, label, and enabled status.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_blocked_dates',
      description: 'Read the list of all blocked dates unavailable for booking.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
];

async function executeToolCall(name, input) {
  switch (name) {
    case 'get_vehicles': {
      const cfg = await readConfig();
      return { vehicles: cfg.vehicles };
    }
    case 'update_vehicle': {
      const cfg = await readConfig();
      const v = cfg.vehicles[input.vehicleKey];
      if (!v) return { error: 'Unknown vehicle key: ' + input.vehicleKey };
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
      return { ok: true, ratePerDay: input.ratePerDay, vehiclesUpdated: Object.keys(cfg.vehicles) };
    }
    case 'get_leads': {
      const leads = await readLeads();
      return { count: leads.length, leads };
    }
    case 'delete_lead': {
      const leads = await readLeads();
      const lead = leads.find(l => l.email === input.email.trim().toLowerCase());
      if (!lead) return { error: 'Lead not found: ' + input.email };
      await deleteLead(lead.id);
      return { ok: true, deleted: input.email };
    }
    case 'send_promo_to_lead': {
      const code = input.code || 'FIRST10';
      await sendDiscountCode(input.email, code);
      return { ok: true, sentTo: input.email, code };
    }
    case 'send_promo_to_all_leads': {
      const leads = await readLeads();
      const results = [];
      for (const lead of leads) {
        try {
          await sendDiscountCode(lead.email, input.code);
          results.push({ email: lead.email, sent: true });
        } catch (e) {
          results.push({ email: lead.email, sent: false, error: e.message });
        }
      }
      return { ok: true, totalLeads: leads.length, results };
    }
    case 'get_discounts': {
      const cfg = await readConfig();
      return { discounts: cfg.discounts };
    }
    case 'get_blocked_dates': {
      const cfg = await readConfig();
      return { blockedDates: cfg.blockedDates, count: cfg.blockedDates.length };
    }
    default:
      return { error: 'Unknown tool: ' + name };
  }
}

app.post('/api/admin/chat', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ reply: 'Please provide a message.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ reply: 'Message too long.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ reply: 'AI assistant is not configured. Add OPENAI_API_KEY to your .env file.' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are CJ Assistant, a helpful admin tool for CJ's Fun Time Rental — a 3-wheel vehicle rental business in Lancaster, PA. Use tools to execute commands. Today: ${new Date().toISOString().split('T')[0]}. Vehicle keys: slingshot_2022 (2022 Polaris Slingshot), slingshot_2020 (2020 Polaris Slingshot), canam_spyder (2021 Can-Am Spyder F3 Limited).`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: message.trim() }
    ];

    // Phase 1: agentic tool-use loop (no response_format — incompatible with tools)
    let loopCount = 0;
    while (loopCount++ < 10) {
      const response = await client.chat.completions.create({
        model:    'gpt-4o',
        tools:    ADMIN_TOOLS,
        messages
      });

      const choice = response.choices[0];
      messages.push(choice.message);

      if (choice.finish_reason === 'stop') break;

      if (choice.finish_reason === 'tool_calls') {
        for (const toolCall of choice.message.tool_calls) {
          const toolInput = JSON.parse(toolCall.function.arguments);
          const result    = await executeToolCall(toolCall.function.name, toolInput);
          messages.push({
            role:         'tool',
            tool_call_id: toolCall.id,
            content:      JSON.stringify(result)
          });
        }
      } else {
        break;
      }
    }

    // Phase 2: separate JSON-only call to get reply + suggestions reliably
    const jsonSystemPrompt = `You are CJ Assistant for CJ's Fun Time Rental. The business has 3 vehicles:
- 2022 Polaris Slingshot
- 2020 Polaris Slingshot
- 2021 Can-Am Spyder F3 Limited

Your job is to guide the admin using clickable chips as much as possible. The admin should rarely need to type.

REPLY rules:
- 1 sentence max. Plain text only — no asterisks, dashes, or markdown.
- If you need clarification, ask it in one short sentence and let the chips answer it.
- If an action completed, confirm it in one sentence.
- Never list options in the reply text — put them in chips instead.

CHIPS rules:
- Return 3 to 6 chips depending on context.
- Chips ARE the options. If the user needs to pick something, each chip IS one of the choices.
- Phrase chips as things the admin would naturally say or want, e.g. "Change 2022 Slingshot to $200/day"
- When a choice needs a specific value (like a price), include a realistic example value in the chip text so the user can tap and immediately understand what will happen.
- Chips must be specific and actionable — never generic like "See more" or "Go back".
- Adapt to the conversation. After showing prices, chips should be about changing or acting on those prices. After leads, chips should be about contacting or managing those leads.
- Never repeat the same chip set twice in a row.

Respond ONLY with valid JSON, no other text:
{"reply":"...","chips":["...","...","..."]}`;


    const jsonResponse = await client.chat.completions.create({
      model:           'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: jsonSystemPrompt },
        ...messages.slice(1) // pass full conversation minus original system prompt
      ]
    });

    let reply = 'Done.';
    let suggestions = [];
    try {
      const parsed = JSON.parse(jsonResponse.choices[0].message.content);
      reply       = parsed.reply  || 'Done.';
      suggestions = parsed.chips  || parsed.suggestions || [];
    } catch (e) {
      reply = jsonResponse.choices[0].message.content || 'Done.';
    }

    return res.json({ reply, suggestions });
  } catch (e) {
    console.error('Chat route error:', e);
    res.status(500).json({ reply: 'Something went wrong. Please try again.' });
  }
});

// ── Admin panel routes ─────────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'index.html')));
app.get('/admin/admin.js',  (req, res) => res.sendFile(path.join(ADMIN_DIR, 'admin.js')));
app.get('/admin/admin.css', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'admin.css')));

// ── Coming soon mode ───────────────────────────────────────────────────────────
// Set COMING_SOON=true in .env to show the holding page.
// The full site remains at /site for client preview.
const COMING_SOON = process.env.COMING_SOON === 'true';

app.get('/', (req, res) => {
  const file = COMING_SOON ? 'index.html' : 'full-site.html';
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.sendFile(path.join(__dirname, file));
});

// /site redirects to / to avoid duplicate content
app.get('/site', (req, res) => {
  res.redirect(301, '/');
});

// ── Landing pages ──────────────────────────────────────────────────────────────
const landingPages = [
  'slingshot-rental-lancaster-pa',
  'slingshot-rental-near-york-pa',
  'slingshot-rental-near-harrisburg-pa',
  'slingshot-rental-near-reading-pa',
  'can-am-spyder-rental-pa',
  'scenic-routes-lancaster-pa',
];
landingPages.forEach(slug => {
  app.get(`/${slug}`, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.sendFile(path.join(__dirname, 'pages', `${slug}.html`));
  });
});

// ── Blog ───────────────────────────────────────────────────────────────────────
app.get('/blog', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.sendFile(path.join(__dirname, 'blog', 'index.html'));
});
app.get('/blog/:slug', (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9-]/gi, '');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.sendFile(path.join(__dirname, 'blog', `${slug}.html`), err => {
    if (err) res.status(404).send('<!DOCTYPE html><html><head><title>Not Found</title><meta name="robots" content="noindex"></head><body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Page Not Found</h1><p><a href="/" style="color:#FF6B00">Back to Home</a></p></div></body></html>');
  });
});

// ── Static files (serve site root last) ───────────────────────────────────────
app.use(express.static(__dirname, {
  index: false,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const isHtml = filePath.endsWith('.html');
    const isData = filePath.includes('/data/');
    if (isHtml || isData) {
      res.setHeader('Cache-Control', 'no-cache, no-store');
    } else {
      // Images, JS, CSS, fonts — cache for 1 week
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
  }
}));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("CJ's Fun Time Rental server running at http://localhost:" + PORT);
  console.log('Admin panel: http://localhost:' + PORT + '/admin');
  console.log('Admin users: leandertoney@gmail.com, chrisjohnson839@gmail.com');
});
