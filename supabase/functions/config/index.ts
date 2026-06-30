import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: "https://127229b369d63b36820bcbf33816bad0@o4511654459801600.ingest.us.sentry.io/4511654476251136",
  environment: "production",
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  release: Deno.env.get('RELEASE_VERSION') || 'unknown'
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('config')
      .eq('id', 1)
      .single();

    if (error) throw error;

    const cfg = data.config;

    // Fetch cached Google reviews
    let googleReviews: unknown[] = [];
    try {
      const { data: reviews } = await supabase
        .from('google_reviews')
        .select('author_name, author_photo, rating, text, relative_time, publish_time')
        .order('publish_time', { ascending: false });
      if (reviews && reviews.length > 0) googleReviews = reviews;
    } catch { /* no reviews yet */ }

    // Fetch upcoming bookings for availability checking
    let upcomingBookings: unknown[] = [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: bookings } = await supabase
        .from('bookings')
        .select('vehicle, start_date, end_date')
        .eq('status', 'confirmed')
        .gte('end_date', today);
      if (bookings && bookings.length > 0) upcomingBookings = bookings;
    } catch { /* no bookings */ }

    // Fetch vehicle blocks for per-vehicle availability
    let vehicleBlocks: unknown[] = [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: blocks } = await supabase
        .from('vehicle_blocks')
        .select('vehicle_key, start_date, end_date, reason')
        .gte('end_date', today);
      if (blocks && blocks.length > 0) vehicleBlocks = blocks;
    } catch { /* no vehicle blocks yet */ }

    const pub = {
      sections:      cfg.sections,
      sectionOrder:  cfg.sectionOrder,
      vehicles:      cfg.vehicles,
      pricing:       cfg.pricing,
      copy:          cfg.copy,
      faqs:          cfg.faqs,
      discounts:     cfg.discounts,
      blockedDates:  cfg.blockedDates,
      googleReviews: googleReviews,
      bookings:      upcomingBookings,
      vehicleBlocks: vehicleBlocks
    };

    const js = 'window.SITE_CONFIG = ' + JSON.stringify(pub) + ';';
    return new Response(js, {
      headers: {
        ...CORS,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store'
      }
    });
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response('window.SITE_CONFIG = null;', {
      headers: { ...CORS, 'Content-Type': 'application/javascript' }
    });
  }
});
