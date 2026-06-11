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

    // Fetch all confirmed bookings for this vehicle
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, vehicle, start_date, end_date, status')
      .eq('status', 'confirmed')
      .gte('end_date', new Date().toISOString().split('T')[0]); // Only future/current bookings

    if (error) throw error;

    // Filter bookings to match the requested vehicle key
    const filteredBookings = (bookings || []).filter((b: any) => {
      // Match exact vehicle name or key
      return b.vehicle === vehicleKey ||
             b.vehicle.toLowerCase().includes(vehicleKey.toLowerCase()) ||
             vehicleKey.toLowerCase().includes(b.vehicle.toLowerCase());
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
