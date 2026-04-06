import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const pub = {
      sections:     cfg.sections,
      sectionOrder: cfg.sectionOrder,
      vehicles:     cfg.vehicles,
      copy:         cfg.copy,
      faqs:         cfg.faqs,
      discounts:    cfg.discounts,
      blockedDates: cfg.blockedDates
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
    return new Response('window.SITE_CONFIG = null;', {
      headers: { ...CORS, 'Content-Type': 'application/javascript' }
    });
  }
});
