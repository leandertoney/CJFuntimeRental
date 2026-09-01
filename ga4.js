/* Google Analytics 4 (G-75N54FRXFC), CJ's Fun Time Rental.
 *
 * One file loaded on every page rather than the tag pasted 26 times, so the
 * measurement id lives in exactly one place and cannot drift.
 *
 * This answers "how many people visited", which is the denominator the
 * conversion rate needs. WHICH CHANNEL a real booking came from is answered
 * separately and more reliably by attribution.js, which writes the source onto
 * the booking row itself. GA4 measures traffic; attribution.js measures money.
 */
(function () {
  var ID = 'G-75N54FRXFC';

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);

  // Conversions worth counting. Fired from the pages themselves; kept here so
  // the event names stay consistent and reporting does not fragment.
  window.CJFR_TRACK = function (name, params) {
    try { gtag('event', name, params || {}); } catch (e) { /* never block a booking */ }
  };
})();
