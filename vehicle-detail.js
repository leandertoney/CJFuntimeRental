/**
 * CJ's Fun Time Rental — Vehicle Detail Panel
 *
 * Renders a full-screen slide-in panel with vehicle specs, features,
 * safety, connectivity, inclusions, reviews, and an inline booking form.
 *
 * Triggered by [data-vehicle-detail="<key>"] buttons in the fleet grid.
 * "Book This Ride" inside the panel opens the booking modal (stripe-checkout.js)
 * with the vehicle pre-selected.
 */

(function () {
  'use strict';

  var VEHICLES = {
    slingshot_2022: {
      key: 'slingshot_2022',
      label: '2022 Polaris Slingshot SL',
      type: 'slingshot',
      rate9hr: 175,
      rate24hr: 220,
      rateHourly: 30,
      img: 'cj_orange_sling.jpg',
      badges: ['Best Seller', 'AutoDrive (No Clutch)', '3-Wheeler'],
      tagline: 'The ultimate open-air thrill machine — orange, aggressive, unforgettable.',
      specs: [
        '2022 model year',
        'AutoDrive — no clutch, no stall',
        '2.0L 4-Cyl · 203 hp',
        '3-wheel autocycle',
        '2 seats (driver + passenger)',
        '300 miles included per trip',
      ],
      features: [
        'Open-air cockpit with 180° panoramic views',
        'Premium Rockford Fosgate audio system',
        'Alpine 7″ touchscreen with Apple CarPlay',
        'LED daytime running lights & performance lighting',
        'Sporty bucket seats with 4-point harness mounts',
        'Rear-view camera standard',
        'Push-button start',
        'USB charging ports (front)',
      ],
      safety: [
        'Automotive-grade seat belts (front & rear anchorage)',
        'Roll hoops for occupant protection',
        'Electronic Stability Control (ESC)',
        'ABS with traction control',
        'No motorcycle license required in PA',
        'Insurance & protection included in every rental',
      ],
      connectivity: [
        'Apple CarPlay via Alpine 7″ touchscreen',
        'Bluetooth audio & hands-free calling',
        'Rockford Fosgate 4-speaker sound system',
        'USB charging ports',
        'Integrated GPS navigation',
      ],
      included: [
        '300 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'No motorcycle license required',
        'Drop-off available within 30 mi ($50/way)',
        'Multi-day discounts available',
      ],
      reviews: [
        { name: 'Samuel A.', rating: 5, text: "This was an incredible experience! CJ was the best host I've ever had on any platform. Would 100% book again." },
        { name: 'Kayla R.', rating: 5, text: "The orange slingshot was absolutely stunning. So much fun — drew attention everywhere we went in Lancaster." },
        { name: 'Brian T.', rating: 5, text: "Super clean, super fast, and CJ made the whole process smooth. AutoDrive is perfect if you're nervous about manual." },
        { name: 'Deondra M.', rating: 5, text: "Best road trip vehicle I've ever driven. The sound system alone is worth it." },
      ],
    },

    slingshot_2020: {
      key: 'slingshot_2020',
      label: '2020 Polaris Slingshot S',
      type: 'slingshot',
      rate9hr: 175,
      rate24hr: 220,
      rateHourly: 30,
      img: 'gray_polaris_front.png',
      badges: ['3-Wheeler', 'Manual Transmission', "Pure Driver's Machine"],
      tagline: "Raw, manual, mechanical — the Slingshot the way driving was meant to feel.",
      specs: [
        '2020 model year',
        '5-speed manual transmission',
        '2.0L 4-Cyl · 173 hp',
        '3-wheel autocycle',
        '2 seats (driver + passenger)',
        '300 miles included per trip',
      ],
      features: [
        'Open-air cockpit with 180° panoramic views',
        'Aggressive sport-tuned suspension',
        '7″ touchscreen infotainment display',
        'LED daytime running lights',
        'Sporty bucket seats',
        'Push-button start',
        'Rear-view camera',
        'Digital instrument cluster',
      ],
      safety: [
        'Automotive-grade seat belts',
        'Roll hoops for occupant protection',
        'ABS braking system',
        'Traction control',
        'No motorcycle license required in PA',
        'Insurance & protection included in every rental',
      ],
      connectivity: [
        '7″ Touchscreen infotainment display',
        'Bluetooth audio & phone integration',
        'USB charging port',
        'AM/FM/SiriusXM ready',
      ],
      included: [
        '300 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'No motorcycle license required',
        'Drop-off available within 30 mi ($50/way)',
        'Multi-day discounts available',
      ],
      reviews: [
        { name: 'Jake S.', rating: 5, text: "The manual transmission on the gray Slingshot made it feel so raw and real. Loved every second." },
        { name: 'Marcus W.', rating: 5, text: "If you know how to drive manual, get this one. Pure joy on backroads." },
        { name: 'Ashley N.', rating: 5, text: "Beautiful car, great condition, CJ was incredibly helpful. Already planning my next trip." },
      ],
    },

    canam_spyder: {
      key: 'canam_spyder',
      label: '2021 Can-Am Spyder F3 Limited',
      type: 'canam',
      rate9hr: 160,
      rate24hr: 200,
      rateHourly: 30,
      img: 'Can_Am_Spyder_F3_Limited.png',
      badges: ['Premium Pick', '3-Wheeler', 'Touring Comfort'],
      tagline: 'Long-haul luxury meets open-road freedom — the Can-Am built for adventure.',
      specs: [
        '2021 model year',
        'SE6 semi-automatic transmission',
        'Rotax 1330 ACE · 115 hp',
        '3-wheel motorcycle',
        '2 seats (driver + passenger)',
        '300 miles included per trip',
        'Motorcycle license required in PA',
      ],
      features: [
        'SE6 semi-auto transmission — smooth paddle-shift',
        'Heated grips & heated seat (driver)',
        'Premium touring windshield',
        'Integrated hard-sided saddlebags',
        'Air-ride adjustable rear suspension',
        'LED lighting throughout',
        'Reverse gear standard',
        'Large fuel tank for long-distance trips',
      ],
      safety: [
        'Stability Control System (SCS) standard',
        'ABS with cornering ABS (C-ABS)',
        'Traction Control System (TCS)',
        'Vehicle Hold Assist (VHA) on hills',
        'Motorcycle license required in PA',
        'Insurance & protection included in every rental',
      ],
      connectivity: [
        'Garmin GPS navigation (integrated)',
        'Bluetooth audio with premium speakers',
        'Hands-free phone integration',
        'USB charging ports',
        'LinQ accessory mounting system',
      ],
      included: [
        '300 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'Motorcycle license required in PA',
        'Drop-off available within 30 mi ($50/way)',
        'Multi-day discounts available',
      ],
      reviews: [
        { name: 'Tiffany G.', rating: 5, text: "The Can-Am is so comfortable for longer rides. Heated grips and the GPS made our day trip to Philly amazing." },
        { name: 'Robert H.', rating: 5, text: "Premium doesn't begin to describe it. Smoothest ride I've ever had on three wheels." },
        { name: 'Deja L.', rating: 5, text: "CJ had everything ready and walked us through all the controls. We felt safe the whole time. Will be back!" },
        { name: 'Mike P.', rating: 5, text: "The saddlebags were a game changer for our trip. CJ's service is unmatched." },
      ],
    },
  };

  var SOCIAL_PHOTOS = [
    { src: 'cj_night_rental.png',  alt: 'Night rental' },
    { src: 'cj_couple_rental.png', alt: 'Couple rental' },
    { src: 'cj_hopi_rental.png',   alt: 'Hopi rental' },
    { src: 'cj_mam_rental.png',    alt: 'MAM rental' },
    { src: 'cj_double_rental.png', alt: 'Double rental' },
    { src: 'cj_baby_driver.png',   alt: 'Baby Driver rental' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function renderSpecItems(items) {
    return items.map(function (item) {
      return '<div class="vd-spec-item">' + item + '</div>';
    }).join('');
  }

  function renderStars(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '\u2605';
    return s;
  }

  function renderReviews(reviews) {
    return reviews.map(function (r) {
      return '<div class="vd-review-card">' +
        '<div class="vd-review-stars">' + renderStars(r.rating) + '</div>' +
        '<p class="vd-review-quote">\u201c' + r.text + '\u201d</p>' +
        '<p class="vd-review-author">' + r.name + ' &nbsp;\u00b7&nbsp; <span style="color:rgba(255,107,0,0.7)">Verified Renter</span></p>' +
        '</div>';
    }).join('');
  }

  function renderBadges(badges) {
    return badges.map(function (b) { return '<span class="vd-badge">' + b + '</span>'; }).join('');
  }

  function renderPhotoStrip() {
    return '<div class="vd-photo-strip" id="vd-photo-strip">' +
      SOCIAL_PHOTOS.map(function (p, i) {
        return '<button class="vd-strip-thumb" data-strip-idx="' + i + '" aria-label="View photo: ' + p.alt + '">' +
          '<img src="' + p.src + '" alt="' + p.alt + '" loading="lazy">' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function getPricingForVehicle(v) {
    // Try to get pricing from SITE_CONFIG first
    var p = (window.SITE_CONFIG && window.SITE_CONFIG.pricing) || {};
    var type = v.type || (v.key && v.key.indexOf('canam') !== -1 ? 'canam' : 'slingshot');
    return {
      hourly: (p.hourlyRate) || v.rateHourly || 30,
      ninehr: (p.ninehrRate && p.ninehrRate[type]) || v.rate9hr || 175,
      daily:  (p.dailyRate && p.dailyRate[type]) || v.rate24hr || 220,
      hourlyMin: (p.hourlyMin) || 3
    };
  }

  // ── Panel open / close ─────────────────────────────────────────────────────

  window.openVehicleDetail = openPanel;
  function openPanel(vehicleKey) {
    // Load from SITE_CONFIG (dynamic) with fallback to hardcoded VEHICLES
    var src = (window.SITE_CONFIG && window.SITE_CONFIG.vehicles) || VEHICLES;
    var v = src[vehicleKey];
    if (!v) v = VEHICLES[vehicleKey];
    if (!v) return;

    // Normalize field names
    if (!v.key) v.key = vehicleKey;
    if (!v.label && v.name) v.label = v.name;
    if (!v.type) v.type = vehicleKey.indexOf('canam') !== -1 ? 'canam' : 'slingshot';
    if (v.specsList && !Array.isArray(v.specs)) v.specs = v.specsList;

    // Get fallback detail data
    var detail = VEHICLES[vehicleKey] || {};
    if (!v.badges)       v.badges       = detail.badges       || [];
    if (!v.tagline)      v.tagline      = detail.tagline      || '';
    if (!Array.isArray(v.specs))     v.specs     = detail.specs     || [];
    if (!v.features)     v.features     = detail.features     || [];
    if (!v.safety)       v.safety       = detail.safety       || [];
    if (!v.connectivity) v.connectivity = detail.connectivity || [];
    if (!v.included)     v.included     = detail.included     || [];
    if (!v.reviews)      v.reviews      = detail.reviews      || [];
    if (!v.img)          v.img          = detail.img          || '';

    var prices = getPricingForVehicle(v);

    var panel = document.getElementById('vd-panel');
    if (!panel) return;

    panel.setAttribute('data-vehicle', vehicleKey);

    panel.innerHTML =
      // Sticky header
      '<div class="vd-header">' +
        '<button class="vd-back" id="vd-back">\u2190 Back to Fleet</button>' +
        '<span class="vd-header-title">' + v.label + '</span>' +
        '<span class="vd-header-price">from $' + prices.ninehr + '</span>' +
      '</div>' +

      // Hero image with badges bottom-left
      '<div class="vd-hero">' +
        '<img id="vd-hero-img" src="' + v.img + '" alt="' + v.label + ' rental Lancaster PA">' +
        '<div class="vd-hero-overlay"></div>' +
        '<div class="vd-hero-badge">' + renderBadges(v.badges) + '</div>' +
      '</div>' +
      renderPhotoStrip() +

      // Body: left col + right booking sidebar
      '<div class="vd-body">' +

        // Left column
        '<div class="vd-left">' +
          '<div class="vd-title-row"><h1 class="vd-name">' + v.label + '</h1></div>' +
          '<div class="vd-rating">' +
            '<span class="vd-stars">\u2605\u2605\u2605\u2605\u2605</span>' +
            '<span class="vd-rating-text">5.0 &nbsp;\u00b7&nbsp; Verified Renters</span>' +
          '</div>' +
          '<p style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin-bottom:36px">' + v.tagline + '</p>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">Vehicle Specs</div>' +
            '<div class="vd-specs-grid">' + renderSpecItems(v.specs) + '</div>' +
          '</div>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">Features</div>' +
            '<div class="vd-specs-grid">' + renderSpecItems(v.features) + '</div>' +
          '</div>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">Safety &amp; Protection</div>' +
            '<div class="vd-specs-grid">' + renderSpecItems(v.safety) + '</div>' +
          '</div>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">Connectivity &amp; Tech</div>' +
            '<div class="vd-specs-grid">' + renderSpecItems(v.connectivity) + '</div>' +
          '</div>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">Everything Included</div>' +
            '<div class="vd-specs-grid">' + renderSpecItems(v.included) + '</div>' +
          '</div>' +

          '<div class="vd-section">' +
            '<div class="vd-section-title">What Renters Say</div>' +
            '<div class="vd-reviews">' + renderReviews(v.reviews) + '</div>' +
          '</div>' +
        '</div>' +

        // Right booking sidebar — pricing table + book button
        '<div class="vd-booking">' +
          '<div class="vd-booking-title">Reserve This Ride</div>' +

          '<div class="vd-pricing-table">' +
            '<div class="vd-pricing-row">' +
              '<span class="vd-pricing-label">Hourly <span class="vd-pricing-note">' + prices.hourlyMin + 'hr min</span></span>' +
              '<span class="vd-pricing-value">$' + prices.hourly + '/hr</span>' +
            '</div>' +
            '<div class="vd-pricing-row">' +
              '<span class="vd-pricing-label">9 Hours</span>' +
              '<span class="vd-pricing-value">$' + prices.ninehr + '</span>' +
            '</div>' +
            '<div class="vd-pricing-row">' +
              '<span class="vd-pricing-label">24 Hours</span>' +
              '<span class="vd-pricing-value">$' + prices.daily + '</span>' +
            '</div>' +
            '<div class="vd-pricing-row vd-pricing-note-row">' +
              '<span class="vd-pricing-label">Multi-Day</span>' +
              '<span class="vd-pricing-value">Discounted rates</span>' +
            '</div>' +
          '</div>' +

          '<div class="vd-field">' +
            '<label>Pickup &amp; Return</label>' +
            '<input type="text" value="Lancaster, PA" readonly>' +
          '</div>' +

          '<div class="vd-inclusions-mini">' +
            '<div class="vd-inclusion">Insurance &amp; protection included</div>' +
            '<div class="vd-inclusion">300 miles included</div>' +
            '<div class="vd-inclusion">Drop-off available (+$50/way)</div>' +
            (v.type !== 'canam' ? '<div class="vd-inclusion">No motorcycle license required</div>' : '<div class="vd-inclusion">Motorcycle license required in PA</div>') +
          '</div>' +

          '<button class="btn btn-primary vd-book-btn" id="vd-book-btn">Book This Ride &rarr;</button>' +
          '<p class="vd-booking-note">\uD83D\uDD12 Secure checkout &middot; No charge until Stripe checkout</p>' +
        '</div>' +

      '</div>';

    // Back / close button
    var backBtn = document.getElementById('vd-back');
    if (backBtn) backBtn.addEventListener('click', closePanel);

    // Book This Ride → open booking modal with vehicle preselected
    var bookBtn = document.getElementById('vd-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', function () {
        closePanel();
        if (window.CJStripe) {
          window.CJStripe.openModal(vehicleKey);
        }
      });
    }

    // Photo strip → swap hero image
    var strip = document.getElementById('vd-photo-strip');
    if (strip) {
      strip.addEventListener('click', function (e) {
        var thumb = e.target.closest('.vd-strip-thumb');
        if (!thumb) return;
        var idx = parseInt(thumb.getAttribute('data-strip-idx'), 10);
        var photo = SOCIAL_PHOTOS[idx];
        if (!photo) return;
        var heroImg = document.getElementById('vd-hero-img');
        if (heroImg) { heroImg.src = photo.src; heroImg.alt = photo.alt; }
        strip.querySelectorAll('.vd-strip-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
      });
    }

    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    var panel = document.getElementById('vd-panel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Fleet card "View Details" buttons → open detail panel
    document.querySelectorAll('[data-vehicle-detail]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(this.getAttribute('data-vehicle-detail'));
      });
    });

    // Escape key closes panel
    document.addEventListener('keydown', function (e) {
      var panel = document.getElementById('vd-panel');
      if (e.key === 'Escape' && panel && panel.classList.contains('open')) closePanel();
    });
  });

  // Expose for external use
  window.CJVehicle = { open: openPanel, close: closePanel };

}());
