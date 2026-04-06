const { createClient } = require('@supabase/supabase-js');

let _client;
function getDB() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _client;
}

// ── Config ────────────────────────────────────────────────────────────────────
async function readConfig() {
  const { data, error } = await getDB()
    .from('site_config')
    .select('config')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.config;
}

async function writeConfig(cfg) {
  cfg._lastSaved = new Date().toISOString();
  const { error } = await getDB()
    .from('site_config')
    .upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Leads ─────────────────────────────────────────────────────────────────────
async function readLeads() {
  const { data, error } = await getDB()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertLead({ email, source, promoCode }) {
  const { data, error } = await getDB()
    .from('leads')
    .insert({ email, source: source || 'website', promo_code: promoCode })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLead(id) {
  const { error } = await getDB()
    .from('leads')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Bookings ──────────────────────────────────────────────────────────────────
async function readBookings() {
  const { data, error } = await getDB()
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertBooking(booking) {
  const { error } = await getDB()
    .from('bookings')
    .upsert({
      id:                booking.id,
      email:             booking.email,
      name:              booking.name,
      phone:             booking.phone,
      vehicle:           booking.vehicle,
      start_date:        booking.startDate,
      end_date:          booking.endDate,
      days:              booking.days,
      total:             booking.total,
      savings:           booking.savings || 0,
      stripe_session_id: booking.id,
      status:            'confirmed'
    });
  if (error) throw error;
}

module.exports = { readConfig, writeConfig, readLeads, insertLead, deleteLead, readBookings, insertBooking };
