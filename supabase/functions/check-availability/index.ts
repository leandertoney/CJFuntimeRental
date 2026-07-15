import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { vehicleKey } = await req.json();

    if (!vehicleKey) {
      return new Response(
        JSON.stringify({ error: 'vehicleKey required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all confirmed bookings, future/current only
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, vehicle, vehicle_key, start_date, end_date, status')
      .eq('status', 'confirmed')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;

    // Match by exact vehicle_key (set on every booking since 2026-07-15).
    // Older bookings created before that column exist have vehicle_key NULL
    // and only ever stored the display NAME (e.g. "2016 Polaris Slingshot").
    // Comparing that name directly against vehicleKey (e.g. "slingshot_2020")
    // can never match — different formats — so for legacy rows we resolve
    // vehicleKey to its configured display name first, then compare name to
    // name. Note two fleet vehicles share the same display name (the two
    // 2016 Slingshots), so this fallback is inherently ambiguous between
    // them; it's only reached for bookings that predate exact-key tracking.
    let legacyVehicleName: string | null = null;
    const needsLegacyFallback = (bookings || []).some((b: any) => !b.vehicle_key);
    if (needsLegacyFallback) {
      const { data: cfgRow } = await supabase.from('site_config').select('config').eq('id', 1).single();
      legacyVehicleName = (cfgRow?.config?.vehicles?.[vehicleKey]?.name || '').toLowerCase();
    }

    const filteredBookings = (bookings || []).filter((b: any) => {
      if (b.vehicle_key) return b.vehicle_key === vehicleKey;
      if (!legacyVehicleName) return false;
      const v = (b.vehicle || '').toLowerCase();
      return v === legacyVehicleName || v.includes(legacyVehicleName) || legacyVehicleName.includes(v);
    });

    return new Response(
      JSON.stringify({ bookings: filteredBookings }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Check Availability Error]', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, bookings: [] }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
