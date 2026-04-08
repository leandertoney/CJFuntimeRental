import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!;
const BUSINESS_NAME = "CJ's Funtime Rental";
const LOCATION = { latitude: 40.0379, longitude: -76.3055 }; // Lancaster, PA

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

/**
 * Searches for the business via Places API text search.
 * Returns the place ID if found, null otherwise.
 */
async function findPlaceId(): Promise<string | null> {
  // First check if we have a cached Place ID
  const { data: sync } = await supabase.from('review_sync').select('place_id').eq('id', 1).single();
  if (sync?.place_id) return sync.place_id;

  // Search for the business
  const searchNames = [
    BUSINESS_NAME,
    "CJ's Fun Time Rental Lancaster PA",
    "CJs Funtime Rental Lancaster",
    "CJ Funtime Rental Lancaster PA slingshot",
  ];

  for (const query of searchNames) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: LOCATION,
            radius: 20000,
          },
        },
      }),
    });

    const data = await res.json();
    if (data.places && data.places.length > 0) {
      // Try to match by website or address containing Lancaster
      for (const place of data.places) {
        const addr = (place.formattedAddress || '').toLowerCase();
        const website = (place.websiteUri || '').toLowerCase();
        const name = (place.displayName?.text || '').toLowerCase();

        if (
          website.includes('cjfuntime') ||
          (addr.includes('lancaster') && (name.includes('cj') || name.includes('funtime') || name.includes('slingshot')))
        ) {
          // Cache the Place ID
          await supabase.from('review_sync').upsert({ id: 1, place_id: place.id });
          return place.id;
        }
      }
    }
  }

  return null;
}

/**
 * Fetches reviews for a given Place ID and caches them.
 */
async function fetchAndCacheReviews(placeId: string): Promise<number> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
    },
  });

  const data = await res.json();
  if (!data.reviews || data.reviews.length === 0) return 0;

  const rows = data.reviews.map((r: Record<string, unknown>) => {
    const author = r.authorAttribution as Record<string, string> | undefined;
    return {
      id: r.name as string,
      author_name: author?.displayName || 'Anonymous',
      author_photo: author?.photoUri || null,
      rating: r.rating as number,
      text: (r.text as Record<string, string>)?.text || '',
      publish_time: r.publishTime as string || null,
      relative_time: r.relativePublishTimeDescription as string || '',
      fetched_at: new Date().toISOString(),
    };
  });

  // Upsert reviews (update if already exists)
  const { error } = await supabase.from('google_reviews').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Upsert error:', error.message);

  // Update sync record
  await supabase.from('review_sync').upsert({
    id: 1,
    place_id: placeId,
    last_fetch: new Date().toISOString(),
    review_count: rows.length,
  });

  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // GET — return cached reviews (for frontend)
  if (req.method === 'GET') {
    const { data: reviews } = await supabase
      .from('google_reviews')
      .select('*')
      .order('publish_time', { ascending: false });

    return new Response(JSON.stringify({ reviews: reviews || [], source: 'google' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // POST — trigger a refresh (called by cron or admin)
  if (req.method === 'POST') {
    const placeId = await findPlaceId();

    if (!placeId) {
      return new Response(JSON.stringify({
        ok: false,
        message: 'Business not yet found in Google Places API. Will retry on next cron run.',
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const count = await fetchAndCacheReviews(placeId);

    return new Response(JSON.stringify({
      ok: true,
      placeId,
      reviewsCached: count,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
});
