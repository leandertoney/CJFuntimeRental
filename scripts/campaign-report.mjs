// Run: set -a; source .env; set +a; node scripts/campaign-report.mjs
//
// Reports on the LABORDAY15 campaign sent 2026-09-06 to 40 unconverted leads.
// This is the first discount campaign this business has ever actually run: the
// 54 earlier FIRST10 codes were unredeemable because no promo field existed.
//
// Campaign results. Ground truth for conversions is Stripe metadata.promoCode
// on the checkout session, written server-side, so it cannot be lost to a
// cleared browser the way a UTM can.
const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:k,Authorization:'Bearer '+k};
const SENT='2026-09-06T19:37:18Z';

const bk=await (await fetch(u+`/rest/v1/bookings?select=email,total,status,created_at,start_date,attr_source,attr_campaign&created_at=gte.${SENT}`,{headers:H})).json();
const leads=await (await fetch(u+`/rest/v1/leads?select=email,created_at&created_at=gte.${SENT}`,{headers:H})).json();

console.log('CAMPAIGN: LABORDAY15  (sent 2026-09-06 3:37pm ET to 40 leads)');
console.log('');
console.log('Bookings since send:', bk.filter(b=>b.status==='confirmed').length);
for(const b of bk) console.log('  ',b.created_at?.slice(0,16), b.email, '$'+b.total, b.attr_campaign||'(no campaign tag)');
console.log('New leads since send:', leads.length);
for(const l of leads) console.log('  ',l.created_at?.slice(0,16), l.email);

// Stripe sessions carrying the code
const sk=process.env.STRIPE_SECRET_KEY;
const since=Math.floor(new Date(SENT).getTime()/1000);
const r=await fetch(`https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${since}`,{headers:{Authorization:'Bearer '+sk}});
const j=await r.json();
const promo=(j.data||[]).filter(s=>s.metadata&&s.metadata.promoCode);
console.log('');
console.log('Stripe checkouts started with a promo code:',promo.length);
for(const s of promo) console.log('  ',new Date(s.created*1000).toISOString().slice(0,16),
  s.metadata.promoCode, '$'+(s.amount_total/100).toFixed(2), s.payment_status);
