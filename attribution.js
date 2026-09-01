/* Where did this customer come from?
 *
 * The problem this solves: by the time someone reaches checkout,
 * document.referrer is our OWN site, and any ?utm_ tags from the ad or post
 * they clicked are long gone from the URL. So attribution has to be captured on
 * the FIRST page of the visit and carried forward.
 *
 * Stored in localStorage under a first-touch rule: the original source wins.
 * Someone who finds us on Facebook, leaves, then returns by typing the address
 * still counts as Facebook, because Facebook is what actually earned the
 * booking.
 *
 * No cookies, no third party, no personal data: just how they arrived.
 */
(function () {
  var KEY = 'cjfr_attribution';
  var MAX_AGE_DAYS = 90; // a click older than this is not what closed the sale

  function parseSource() {
    var qs = new URLSearchParams(window.location.search);

    // 1. Explicit UTM tags always win. This is what a tagged post or ad sends.
    var utmSource = qs.get('utm_source');
    if (utmSource) {
      return {
        source: utmSource.toLowerCase(),
        medium: (qs.get('utm_medium') || '').toLowerCase(),
        campaign: (qs.get('utm_campaign') || '').toLowerCase(),
        detail: 'utm'
      };
    }

    // 2. Platform click ids, which survive even when someone forgets UTMs.
    if (qs.get('fbclid')) return { source: 'facebook', medium: 'social', campaign: '', detail: 'fbclid' };
    if (qs.get('gclid'))  return { source: 'google',   medium: 'cpc',    campaign: '', detail: 'gclid' };

    // 3. Otherwise fall back to the referring domain.
    var ref = document.referrer || '';
    if (!ref) return { source: 'direct', medium: 'none', campaign: '', detail: 'no-referrer' };

    var host;
    try { host = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); }
    catch (e) { return { source: 'direct', medium: 'none', campaign: '', detail: 'bad-referrer' }; }

    // Our own pages are not a source.
    if (host.indexOf('cjfuntimerentals.com') !== -1) return null;

    var SEARCH = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'search.brave'];
    var SOCIAL = {
      'facebook.com': 'facebook', 'm.facebook.com': 'facebook', 'l.facebook.com': 'facebook',
      'lm.facebook.com': 'facebook', 'instagram.com': 'instagram', 'l.instagram.com': 'instagram',
      't.co': 'twitter', 'x.com': 'twitter', 'tiktok.com': 'tiktok',
      'linkedin.com': 'linkedin', 'lnkd.in': 'linkedin', 'reddit.com': 'reddit',
      'youtube.com': 'youtube', 'pinterest.com': 'pinterest', 'nextdoor.com': 'nextdoor'
    };

    for (var i = 0; i < SEARCH.length; i++) {
      if (host.indexOf(SEARCH[i]) === 0 || host.indexOf('.' + SEARCH[i]) !== -1) {
        return { source: host, medium: 'organic', campaign: '', detail: 'search-referrer' };
      }
    }
    for (var k in SOCIAL) {
      if (host === k || host.indexOf('.' + k) !== -1) {
        return { source: SOCIAL[k], medium: 'social', campaign: '', detail: 'social-referrer' };
      }
    }
    // A real referral from somewhere else: a directory, a blog, a partner.
    return { source: host, medium: 'referral', campaign: '', detail: 'referrer' };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !v.first_seen) return null;
      var ageDays = (Date.now() - new Date(v.first_seen).getTime()) / 86400000;
      if (ageDays > MAX_AGE_DAYS) return null; // stale, let a fresh touch win
      return v;
    } catch (e) { return null; }
  }

  var existing = read();
  var incoming = parseSource();

  // FIRST TOUCH WINS. Only write when there is nothing stored yet, so an
  // internal click never overwrites the real source. `incoming` is null for
  // same-site navigation, which is exactly when we want to leave it alone.
  if (!existing && incoming) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        source: incoming.source,
        medium: incoming.medium,
        campaign: incoming.campaign,
        detail: incoming.detail,
        landing_page: window.location.pathname,
        first_seen: new Date().toISOString()
      }));
    } catch (e) { /* private mode: attribution is best effort, never blocking */ }
  }

  // Read by checkout.html and the tours form when a booking is created.
  window.CJFR_ATTRIBUTION = function () {
    var v = read();
    if (!v) return { source: 'direct', medium: 'none', campaign: '', landing_page: window.location.pathname };
    return v;
  };
})();
