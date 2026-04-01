/**
 * CJ's Fun Time Rental — Vehicle Detail Panel
 *
 * Renders a full-screen slide-in panel with vehicle specs, features,
 * safety, connectivity, inclusions, reviews, and an inline booking form.
 *
 * Triggered by [data-vehicle-detail="<key>"] buttons in the fleet grid.
 * "Book This Ride" inside the panel opens the booking modal (stripe-checkout.js)
 * with the vehicle pre-selected and dates pre-filled.
 */

(function () {
  'use strict';

  var VEHICLES = {
    slingshot_2022: {
      key: 'slingshot_2022',
      label: '2022 Polaris Slingshot SL',
      rate: 180,
      img: 'cj_orange_sling.jpg',
      badges: ['Best Seller', 'AutoDrive (No Clutch)', '3-Wheeler'],
      tagline: 'The ultimate open-air thrill machine \u2014 orange, aggressive, unforgettable.',
      specs: [
        '2022 model year',
        'AutoDrive \u2014 no clutch, no stall',
        '2.0L 4-Cyl \u00b7 203 hp',
        '3-wheel autocycle',
        '2 seats (driver + passenger)',
        '600 miles included per trip',
      ],
      features: [
        'Open-air cockpit with 180\u00b0 panoramic views',
        'Premium Rockford Fosgate audio system',
        'Alpine 7\u201d touchscreen with Apple CarPlay',
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
        'Apple CarPlay via Alpine 7\u201d touchscreen',
        'Bluetooth audio & hands-free calling',
        'Rockford Fosgate 4-speaker sound system',
        'USB charging ports',
        'Integrated GPS navigation',
      ],
      included: [
        '600 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'No motorcycle license required',
        '3-day discount: 10% off',
        'Weekly discount: 15% off',
      ],
      reviews: [
        { name: 'Samuel A.', rating: 5, text: "This was an incredible experience! CJ was the best host I've ever had on any platform. Would 100% book again." },
        { name: 'Kayla R.', rating: 5, text: "The orange slingshot was absolutely stunning. So much fun \u2014 drew attention everywhere we went in Lancaster." },
        { name: 'Brian T.', rating: 5, text: "Super clean, super fast, and CJ made the whole process smooth. AutoDrive is perfect if you're nervous about manual." },
        { name: 'Deondra M.', rating: 5, text: "Best road trip vehicle I've ever driven. The sound system alone is worth it." },
      ],
    },

    slingshot_2020: {
      key: 'slingshot_2020',
      label: '2020 Polaris Slingshot S',
      rate: 180,
      img: 'gray_polaris_front.png',
      badges: ['3-Wheeler', 'Manual Transmission', "Pure Driver's Machine"],
      tagline: "Raw, manual, mechanical \u2014 the Slingshot the way driving was meant to feel.",
      specs: [
        '2020 model year',
        '5-speed manual transmission',
        '2.0L 4-Cyl \u00b7 173 hp',
        '3-wheel autocycle',
        '2 seats (driver + passenger)',
        '600 miles included per trip',
      ],
      features: [
        'Open-air cockpit with 180\u00b0 panoramic views',
        'Aggressive sport-tuned suspension',
        '7\u201d touchscreen infotainment display',
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
        '7\u201d Touchscreen infotainment display',
        'Bluetooth audio & phone integration',
        'USB charging port',
        'AM/FM/SiriusXM ready',
      ],
      included: [
        '600 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'No motorcycle license required',
        '3-day discount: 10% off',
        'Weekly discount: 15% off',
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
      rate: 203,
      img: 'Can_Am_Spyder_F3_Limited.png',
      badges: ['Premium Pick', '3-Wheeler', 'Touring Comfort'],
      tagline: 'Long-haul luxury meets open-road freedom \u2014 the Can-Am built for adventure.',
      specs: [
        '2021 model year',
        'SE6 semi-automatic transmission',
        'Rotax 1330 ACE \u00b7 115 hp',
        '3-wheel autocycle',
        '2 seats (driver + passenger)',
        '600 miles included per trip',
      ],
      features: [
        'SE6 semi-auto transmission \u2014 smooth paddle-shift',
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
        'No motorcycle license required in PA',
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
        '600 miles per trip included',
        'Insurance & protection coverage',
        'Pickup & return in Lancaster, PA',
        'Full tank of gas at pickup',
        'Pre-trip vehicle walkthrough',
        'No motorcycle license required',
        '3-day discount: 10% off',
        'Weekly discount: 15% off',
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
    { src: 'cj_night_rental.jpg',  alt: 'Night rental' },
    { src: 'cj_couple_rental.jpg', alt: 'Couple rental' },
    { src: 'cj_hopi_rental.jpg',   alt: 'Hopi rental' },
    { src: 'cj_mam_rental.jpg',    alt: 'MAM rental' },
    { src: 'cj_double_rental.jpg', alt: 'Double rental' },
    { src: 'cj_baby_driver.jpg',   alt: 'Baby Driver rental' },
  ];

  var SAVINGS = [
    { days: 7, pct: 15, label: 'Weekly discount' },
    { days: 3, pct: 10, label: '3-day discount' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function calcDays(startDate, startTime, endDate, endTime) {
    if (!startDate || !endDate) return 0;
    var start = new Date(startDate + 'T' + (startTime || '00:00'));
    var end   = new Date(endDate   + 'T' + (endTime   || '00:00'));
    var ms = end - start;
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function calcSavings(days, baseTotal) {
    for (var i = 0; i < SAVINGS.length; i++) {
      if (days >= SAVINGS[i].days) {
        return { label: SAVINGS[i].label, amount: Math.round(baseTotal * SAVINGS[i].pct / 100) };
      }
    }
    return null;
  }

  // Renders items as .vd-spec-item divs (for the 2-col grid with checkmark ::before)
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



  // ── Live price update (operates on DOM IDs in the booking sidebar) ──────────

  function updateSummary() {
    var panel = document.getElementById('vd-panel');
    var vehicleKey = panel ? panel.getAttribute('data-vehicle') : null;
    var v = vehicleKey ? VEHICLES[vehicleKey] : null;
    if (!v) return;

    var startDate = (document.getElementById('vd-start-date') || {}).value;
    var startTime = (document.getElementById('vd-start-time') || {}).value;
    var endDate   = (document.getElementById('vd-end-date')   || {}).value;
    var endTime   = (document.getElementById('vd-end-time')   || {}).value;

    var days = calcDays(startDate, startTime, endDate, endTime);
    var baseTotal = v.rate * (days || 1);
    var savings = days > 1 ? calcSavings(days, baseTotal) : null;
    var finalTotal = savings ? baseTotal - savings.amount : baseTotal;

    var rowDays    = document.getElementById('vd-row-days');
    var rowSavings = document.getElementById('vd-row-savings');
    var sumDays    = document.getElementById('vd-sum-days');
    var sumSavings = document.getElementById('vd-sum-savings');
    var sumTotal   = document.getElementById('vd-sum-total');
    var bookRate   = document.getElementById('vd-book-rate');

    if (bookRate) bookRate.textContent = '$' + v.rate;

    if (days > 0) {
      if (rowDays)    rowDays.style.display    = 'flex';
      if (sumDays)    sumDays.textContent       = days + ' day' + (days !== 1 ? 's' : '');
      if (rowSavings) rowSavings.style.display  = savings ? 'flex' : 'none';
      if (sumSavings && savings) sumSavings.textContent = '\u2212$' + savings.amount + ' (' + savings.label + ')';
      if (sumTotal)   sumTotal.textContent      = '$' + finalTotal;
    } else {
      if (rowDays)    rowDays.style.display    = 'none';
      if (rowSavings) rowSavings.style.display = 'none';
      if (sumTotal)   sumTotal.textContent     = '\u2014';
    }
  }

  // ── Panel open / close ─────────────────────────────────────────────────────

  function openPanel(vehicleKey) {
    var v = VEHICLES[vehicleKey];
    if (!v) return;

    var panel = document.getElementById('vd-panel');
    if (!panel) return;

    panel.setAttribute('data-vehicle', vehicleKey);

    panel.innerHTML =
      // Sticky header
      '<div class="vd-header">' +
        '<button class="vd-back" id="vd-back">\u2190 Back to Fleet</button>' +
        '<span class="vd-header-title">' + v.label + '</span>' +
        '<span class="vd-header-price">$' + v.rate + ' / day</span>' +
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

        // Right booking sidebar
        '<div class="vd-booking">' +
          '<div class="vd-booking-title">Reserve This Ride</div>' +
          '<div class="vd-booking-price">From <span id="vd-book-rate">$' + v.rate + '</span> / day</div>' +

          '<div class="vd-field-row">' +
            '<div class="vd-field">' +
              '<label>Start Date</label>' +
              '<input type="date" id="vd-start-date">' +
            '</div>' +
            '<div class="vd-field">' +
              '<label>Start Time</label>' +
              '<input type="time" id="vd-start-time" value="09:00">' +
            '</div>' +
          '</div>' +
          '<div class="vd-field-row">' +
            '<div class="vd-field">' +
              '<label>End Date</label>' +
              '<input type="date" id="vd-end-date">' +
            '</div>' +
            '<div class="vd-field">' +
              '<label>End Time</label>' +
              '<input type="time" id="vd-end-time" value="09:00">' +
            '</div>' +
          '</div>' +
          '<div class="vd-field">' +
            '<label>Pickup &amp; Return</label>' +
            '<input type="text" value="Lancaster, PA" readonly>' +
          '</div>' +

          '<hr class="vd-booking-divider">' +

          '<div class="vd-booking-summary">' +
            '<div class="vd-booking-row" id="vd-row-days" style="display:none">' +
              '<span class="l">Duration</span><span class="r" id="vd-sum-days">\u2014</span>' +
            '</div>' +
            '<div class="vd-booking-row saving" id="vd-row-savings" style="display:none">' +
              '<span class="l">Trip Savings</span><span class="r" id="vd-sum-savings">\u2014</span>' +
            '</div>' +
          '</div>' +

          '<div class="vd-booking-total">' +
            '<span>Estimated Total</span>' +
            '<span class="price" id="vd-sum-total">\u2014</span>' +
          '</div>' +

          '<div class="vd-inclusions-mini">' +
            '<div class="vd-inclusion">Insurance &amp; protection included</div>' +
            '<div class="vd-inclusion">600 miles included</div>' +
            '<div class="vd-inclusion">No motorcycle license required</div>' +
          '</div>' +

          '<button class="btn btn-primary vd-book-btn" id="vd-book-btn">Book This Ride &rarr;</button>' +
          '<p class="vd-booking-note">\uD83D\uDD12 Secure checkout &middot; No charge until Stripe checkout</p>' +
        '</div>' +

      '</div>';

    // Wire date inputs → live summary
    ['vd-start-date', 'vd-start-time', 'vd-end-date', 'vd-end-time'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', updateSummary);
    });

    // Back / close button
    var backBtn = document.getElementById('vd-back');
    if (backBtn) backBtn.addEventListener('click', closePanel);

    // Book This Ride → pass dates to booking modal
    var bookBtn = document.getElementById('vd-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', function () {
        var sd = (document.getElementById('vd-start-date') || {}).value;
        var st = (document.getElementById('vd-start-time') || {}).value;
        var ed = (document.getElementById('vd-end-date')   || {}).value;
        var et = (document.getElementById('vd-end-time')   || {}).value;
        closePanel();
        if (window.CJStripe) {
          window.CJStripe.openModal(vehicleKey, { startDate: sd, startTime: st, endDate: ed, endTime: et });
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
