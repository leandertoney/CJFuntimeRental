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
        { label: 'Year', value: '2022' },
        { label: 'Daily Rate', value: '$180 / day' },
        { label: 'Drivetrain', value: 'AutoDrive (no clutch)' },
        { label: 'Engine', value: '2.0L 4-Cyl \u00b7 203 hp' },
        { label: 'Seats', value: '2 (driver + passenger)' },
        { label: 'Miles Included', value: '600 mi / trip' },
      ],
      features: [
        'AutoDrive transmission \u2014 no clutch, no stall',
        'Open-air cockpit with 180\u00b0 panoramic views',
        'Premium Rockford Fosgate audio system',
        'Alpine touchscreen infotainment display',
        'LED daytime running lights & performance lighting',
        'Sporty bucket seats with 4-point harness mounts',
        'Rear-view camera standard',
        'Push-button start',
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
        'Alpine 7\u201d touchscreen with Apple CarPlay',
        'Bluetooth audio & hands-free calling',
        'Rockford Fosgate 4-speaker sound system',
        'USB charging ports (front)',
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
        { label: 'Year', value: '2020' },
        { label: 'Daily Rate', value: '$180 / day' },
        { label: 'Drivetrain', value: '5-Speed Manual' },
        { label: 'Engine', value: '2.0L 4-Cyl \u00b7 173 hp' },
        { label: 'Seats', value: '2 (driver + passenger)' },
        { label: 'Miles Included', value: '600 mi / trip' },
      ],
      features: [
        '5-speed manual transmission \u2014 real driver engagement',
        'Open-air cockpit with 180\u00b0 panoramic views',
        'Aggressive sport-tuned suspension',
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
        { label: 'Year', value: '2021' },
        { label: 'Daily Rate', value: '$203 / day' },
        { label: 'Drivetrain', value: 'SE6 Semi-Auto' },
        { label: 'Engine', value: 'Rotax 1330 ACE \u00b7 115 hp' },
        { label: 'Seats', value: '2 (driver + passenger)' },
        { label: 'Miles Included', value: '600 mi / trip' },
      ],
      features: [
        'SE6 semi-automatic transmission \u2014 smooth paddle-shift',
        'Heated grips & heated seat (driver)',
        'Premium touring windshield',
        'Integrated hard-sided storage (saddlebags)',
        'Air-ride adjustable rear suspension',
        'LED lighting throughout',
        'Reverse gear standard',
        'Large fuel tank for long-distance touring',
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

  function renderItems(items) {
    return items.map(function (item) { return '<li>' + item + '</li>'; }).join('');
  }

  function renderStars(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '\u2605';
    return '<span class="vd-stars">' + s + '</span>';
  }

  function renderReviews(reviews) {
    return reviews.map(function (r) {
      return '<div class="vd-review-card">' +
        '<div class="vd-review-header">' + renderStars(r.rating) +
        '<span class="vd-reviewer">' + r.name + '</span>' +
        '<span class="vd-verified">Verified Renter</span></div>' +
        '<p class="vd-review-text">\u201c' + r.text + '\u201d</p>' +
        '</div>';
    }).join('');
  }

  function renderSpecs(specs) {
    return specs.map(function (s) {
      return '<div class="vd-spec-item">' +
        '<span class="vd-spec-label">' + s.label + '</span>' +
        '<span class="vd-spec-value">' + s.value + '</span>' +
        '</div>';
    }).join('');
  }

  function renderBadges(badges) {
    return badges.map(function (b) { return '<span class="vd-badge">' + b + '</span>'; }).join('');
  }

  // ── Live price preview ─────────────────────────────────────────────────────

  function updatePricePreview() {
    var panel = document.getElementById('vd-panel');
    var vehicleKey = panel ? panel.getAttribute('data-vehicle') : null;
    var v = vehicleKey ? VEHICLES[vehicleKey] : null;
    if (!v) return;

    var startDate = document.getElementById('vd-start-date').value;
    var startTime = document.getElementById('vd-start-time').value;
    var endDate   = document.getElementById('vd-end-date').value;
    var endTime   = document.getElementById('vd-end-time').value;

    var days = calcDays(startDate, startTime, endDate, endTime);
    var baseTotal = v.rate * (days || 1);
    var savings = days > 1 ? calcSavings(days, baseTotal) : null;
    var finalTotal = savings ? baseTotal - savings.amount : baseTotal;

    var preview = document.getElementById('vd-price-preview');
    if (!preview) return;

    if (days > 0) {
      var html = '<span class="vd-price-days">' + days + ' day' + (days !== 1 ? 's' : '') + '</span>';
      html += '<span class="vd-price-total">$' + finalTotal + '</span>';
      if (savings) {
        html += '<span class="vd-price-savings">You save $' + savings.amount + ' \u2014 ' + savings.label + '</span>';
      }
      preview.innerHTML = html;
    } else {
      preview.innerHTML = '<span class="vd-price-rate">$' + v.rate + ' / day</span>';
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
      '<div class="vd-header">' +
        '<button class="vd-close" id="vd-close-btn" aria-label="Close">&times;</button>' +
        '<div class="vd-breadcrumb"><span>Fleet</span><span class="vd-bc-sep">\u203a</span><span>' + v.label + '</span></div>' +
      '</div>' +
      '<div class="vd-hero" style="background-image:url(\'' + v.img + '\')">' +
        '<div class="vd-hero-overlay"></div>' +
        '<div class="vd-hero-content">' +
          '<div class="vd-badges">' + renderBadges(v.badges) + '</div>' +
          '<h2 class="vd-title">' + v.label + '</h2>' +
          '<p class="vd-tagline">' + v.tagline + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="vd-body">' +
        '<div class="vd-main">' +
          '<section class="vd-section"><h3 class="vd-section-title">Vehicle Specs</h3>' +
            '<div class="vd-specs-grid">' + renderSpecs(v.specs) + '</div></section>' +
          '<section class="vd-section"><h3 class="vd-section-title">Features</h3>' +
            '<ul class="vd-list">' + renderItems(v.features) + '</ul></section>' +
          '<section class="vd-section"><h3 class="vd-section-title">Safety &amp; Protection</h3>' +
            '<ul class="vd-list">' + renderItems(v.safety) + '</ul></section>' +
          '<section class="vd-section"><h3 class="vd-section-title">Connectivity &amp; Tech</h3>' +
            '<ul class="vd-list">' + renderItems(v.connectivity) + '</ul></section>' +
          '<section class="vd-section"><h3 class="vd-section-title">Everything Included</h3>' +
            '<ul class="vd-list vd-list-check">' + renderItems(v.included) + '</ul></section>' +
          '<section class="vd-section"><h3 class="vd-section-title">Guest Reviews</h3>' +
            '<div class="vd-reviews">' + renderReviews(v.reviews) + '</div></section>' +
        '</div>' +
        '<aside class="vd-booking">' +
          '<div class="vd-booking-inner">' +
            '<p class="vd-booking-rate">$' + v.rate + ' <span>/ day</span></p>' +
            '<p class="vd-booking-label">Select your trip dates</p>' +
            '<div class="vd-field"><label>Trip Start</label>' +
              '<div class="vd-field-row">' +
                '<input type="date" id="vd-start-date" class="vd-input">' +
                '<input type="time" id="vd-start-time" class="vd-input" value="09:00">' +
              '</div></div>' +
            '<div class="vd-field"><label>Trip End</label>' +
              '<div class="vd-field-row">' +
                '<input type="date" id="vd-end-date" class="vd-input">' +
                '<input type="time" id="vd-end-time" class="vd-input" value="09:00">' +
              '</div></div>' +
            '<div id="vd-price-preview" class="vd-price-preview"><span class="vd-price-rate">$' + v.rate + ' / day</span></div>' +
            '<div class="vd-inclusions-mini">' +
              '<span>\u2713 Insurance included</span>' +
              '<span>\u2713 600 mi included</span>' +
              '<span>\u2713 Lancaster, PA pickup</span>' +
            '</div>' +
            '<button class="btn btn-primary vd-book-btn" id="vd-book-btn">Book This Ride &rarr;</button>' +
            '<p class="vd-booking-note">No motorcycle license required &middot; No hidden fees</p>' +
          '</div>' +
        '</aside>' +
      '</div>';

    // Wire date change → live price preview
    ['vd-start-date', 'vd-start-time', 'vd-end-date', 'vd-end-time'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', updatePricePreview);
    });

    // Close button
    var closeBtn = document.getElementById('vd-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Book This Ride → pass dates to booking modal
    var bookBtn = document.getElementById('vd-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', function () {
        var sd = document.getElementById('vd-start-date').value;
        var st = document.getElementById('vd-start-time').value;
        var ed = document.getElementById('vd-end-date').value;
        var et = document.getElementById('vd-end-time').value;
        closePanel();
        if (window.CJStripe) window.CJStripe.openModal(vehicleKey, { startDate: sd, startTime: st, endDate: ed, endTime: et });
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
    // Fleet card buttons → open detail panel
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
