require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs').promises;

const CONFIG_PATH = path.join(__dirname, 'data', 'siteConfig.json');
const LEADS_PATH  = path.join(__dirname, 'data', 'leads.json');
const ADMIN_DIR   = path.join(__dirname, 'admin');
const PORT        = process.env.PORT || 3000;

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
  if (req.session && req.session.adminLoggedIn) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Config helpers ─────────────────────────────────────────────────────────────
async function readConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeConfig(cfg) {
  cfg._lastSaved = new Date().toISOString();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
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
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password === (process.env.ADMIN_PASSWORD || 'demo123')) {
    req.session.adminLoggedIn = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.adminLoggedIn) });
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
async function readLeads() {
  try {
    const raw = await fs.readFile(LEADS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// Public — anyone submitting the form hits this
app.post('/api/leads', async (req, res) => {
  const { email, source } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  const leads = await readLeads();
  leads.unshift({
    email:     email.trim().toLowerCase(),
    source:    source || 'Website',
    date:      new Date().toISOString()
  });
  await fs.writeFile(LEADS_PATH, JSON.stringify(leads, null, 2), 'utf8');
  res.json({ ok: true });
});

// Protected — admin only
app.get('/api/leads', requireAuth, async (req, res) => {
  res.json(await readLeads());
});

app.delete('/api/leads/:index', requireAuth, async (req, res) => {
  const idx = parseInt(req.params.index);
  const leads = await readLeads();
  if (idx < 0 || idx >= leads.length) return res.status(400).json({ error: 'Invalid index' });
  leads.splice(idx, 1);
  await fs.writeFile(LEADS_PATH, JSON.stringify(leads, null, 2), 'utf8');
  res.json({ ok: true });
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
  const file = COMING_SOON ? 'coming-soon.html' : 'index.html';
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.sendFile(path.join(__dirname, file));
});

app.get('/site', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Static files (serve site root last) ───────────────────────────────────────
app.use(express.static(__dirname, { index: false, etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, no-store') }));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("CJ's Fun Time Rental server running at http://localhost:" + PORT);
  console.log('Admin panel: http://localhost:' + PORT + '/admin');
  console.log('Password: ' + (process.env.ADMIN_PASSWORD || 'demo123'));
});
