/**
 * CJ's Fun Time Rental — Booking Flow + Stripe Checkout
 *
 * Handles the 3-step booking modal:
 *   Step 1 — Vehicle selection
 *   Step 2 — Trip dates / times / location
 *   Step 3 — Order summary + Stripe checkout
 *
 * Requires stripe.config.js to be loaded first.
 */

(function () {
  'use strict';

  var FACEBOOK_URL = 'https://www.facebook.com/people/CJs-Fun-Time-Rental/61575102921796/';

  // Savings thresholds — overridable via admin config (window.CJFR_SAVINGS)
  var SAVINGS = window.CJFR_SAVINGS || [
    { days: 7, pct: 15, label: 'Weekly discount' },
    { days: 3, pct: 10, label: '3-day discount' },
  ];

  var SUPABASE_FUNCTIONS = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1';

  // State
  var state = {
    vehicle: null,   // { key, label, rate }
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    promoCode: null
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function formatDate(dateStr, timeStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T' + (timeStr || '00:00'));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function calcDays() {
    if (!state.startDate || !state.endDate) return 0;
    var start = new Date(state.startDate + 'T' + (state.startTime || '00:00'));
    var end   = new Date(state.endDate   + 'T' + (state.endTime   || '00:00'));
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

  // ── Modal open / close ─────────────────────────────────────────────────────

  function openModal(preselectedVehicle, prefillDates) {
    var modal = $('booking-modal');
    if (!modal) return;

    if (preselectedVehicle) {
      // If dates were pre-filled from vehicle detail panel, skip to step 2 or 3
      if (prefillDates && (prefillDates.startDate || prefillDates.endDate)) {
        state.startDate = prefillDates.startDate || null;
        state.startTime = prefillDates.startTime || null;
        state.endDate   = prefillDates.endDate   || null;
        state.endTime   = prefillDates.endTime   || null;

        // Pre-fill the date inputs
        if ($('bm-start-date')) $('bm-start-date').value = state.startDate || '';
        if ($('bm-start-time')) $('bm-start-time').value = state.startTime || '09:00';
        if ($('bm-end-date'))   $('bm-end-date').value   = state.endDate   || '';
        if ($('bm-end-time'))   $('bm-end-time').value   = state.endTime   || '09:00';

        preselectVehicle(preselectedVehicle);
        if (state.startDate && state.endDate) {
          buildSummary();
          goToStep(3);
        } else {
          goToStep(2);
        }
      } else {
        goToStep(1);
        preselectVehicle(preselectedVehicle);
      }
    } else {
      goToStep(1);
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var modal = $('booking-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  function goToStep(n) {
    // Panels
    [1, 2, 3].forEach(function (i) {
      var panel = $('bm-panel-' + i);
      if (panel) panel.classList.toggle('active', i === n);
      // Show/hide pinned nav row for this step
      var nav = $('bm-nav-' + i);
      if (nav) nav.style.display = (i === n) ? 'flex' : 'none';
    });
    // Tabs
    document.querySelectorAll('.bm-step-tab').forEach(function (tab) {
      var s = parseInt(tab.getAttribute('data-step'));
      tab.classList.toggle('active', s === n);
      tab.classList.toggle('done', s < n);
    });
    // Scroll scrollable panel area to top
    var scroll = document.querySelector('.bm-panel-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  // ── Vehicle selection ──────────────────────────────────────────────────────

  function preselectVehicle(key) {
    var btn = document.querySelector('.bm-vehicle-btn[data-vehicle="' + key + '"]');
    if (btn) selectVehicleBtn(btn);
  }

  function selectVehicleBtn(btn) {
    document.querySelectorAll('.bm-vehicle-btn').forEach(function (b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    state.vehicle = {
      key:   btn.getAttribute('data-vehicle'),
      label: btn.getAttribute('data-label'),
      rate:  parseInt(btn.getAttribute('data-rate'), 10),
    };
    var nextBtn = $('bm-step1-next');
    if (nextBtn) nextBtn.disabled = false;
  }

  // ── Summary builder ────────────────────────────────────────────────────────

  function buildSummary() {
    if (!state.vehicle) return;
    var days     = calcDays();
    var baseTotal = state.vehicle.rate * (days || 1);
    var savings   = days > 1 ? calcSavings(days, baseTotal) : null;
    var finalTotal = savings ? baseTotal - savings.amount : baseTotal;

    $('bm-summary-vehicle-name').textContent = state.vehicle.label;
    $('bm-summary-rate').textContent         = '$' + state.vehicle.rate + ' / day';
    $('bm-summary-start').textContent        = formatDate(state.startDate, state.startTime);
    $('bm-summary-end').textContent          = formatDate(state.endDate,   state.endTime);
    $('bm-summary-days').textContent         = days ? days + (days === 1 ? ' day' : ' days') : '—';

    var savingsRow = $('bm-savings-row');
    if (savings) {
      $('bm-summary-savings').textContent = '−$' + savings.amount + ' (' + savings.label + ')';
      savingsRow.style.display = 'flex';
    } else {
      savingsRow.style.display = 'none';
    }

    $('bm-summary-total').textContent = days ? '$' + finalTotal : '$' + state.vehicle.rate + ' / day';
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  function checkout() {
    if (!state.vehicle) return;

    if (!window.STRIPE_ENABLED) {
      window.open(FACEBOOK_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    var btn = $('bm-checkout-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to checkout...'; }

    var promoInput = $('bm-promo-code');
    var promoCode = promoInput ? promoInput.value.trim().toUpperCase() : null;

    var days = calcDays();
    var startFormatted = formatDate(state.startDate, state.startTime);
    var endFormatted   = formatDate(state.endDate,   state.endTime);

    fetch(SUPABASE_FUNCTIONS + '/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleKey: state.vehicle.key,
        days:       days || 1,
        startDate:  startFormatted,
        endDate:    endFormatted,
        promoCode:  promoCode || undefined
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
    .then(function (res) {
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Book & Pay Securely →'; }
        alert(res.data.error || 'Something went wrong. Please try again.');
      }
    })
    .catch(function (err) {
      console.error('[Checkout]', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Book & Pay Securely →'; }
      alert('Something went wrong starting checkout. Please try again.');
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {

    // Vehicle buttons in modal
    document.querySelectorAll('.bm-vehicle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { selectVehicleBtn(this); });
    });

    // Step 1 → 2
    var s1next = $('bm-step1-next');
    if (s1next) s1next.addEventListener('click', function () { goToStep(2); });

    // Step 2 → back / next
    var s2back = $('bm-step2-back');
    if (s2back) s2back.addEventListener('click', function () { goToStep(1); });

    var s2next = $('bm-step2-next');
    if (s2next) s2next.addEventListener('click', function () {
      var startVal = $('bm-start-date').value;
      var endVal   = $('bm-end-date').value;

      if (!startVal || !endVal) {
        alert('Please select both a start and end date.');
        return;
      }
      if (new Date(endVal) <= new Date(startVal)) {
        alert('Return date must be after pickup date.');
        return;
      }

      // Check blocked dates from site config
      var blocked = (window.SITE_CONFIG && window.SITE_CONFIG.blockedDates) || [];
      var start = new Date(startVal);
      var end   = new Date(endVal);
      for (var d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        var iso = d.toISOString().split('T')[0];
        if (blocked.indexOf(iso) !== -1) {
          alert('Sorry, ' + iso + ' is unavailable. Please choose different dates.');
          return;
        }
      }

      state.startDate = startVal;
      state.startTime = $('bm-start-time').value;
      state.endDate   = endVal;
      state.endTime   = $('bm-end-time').value;
      buildSummary();
      goToStep(3);
    });

    // Step 3 → back / checkout
    var s3back = $('bm-step3-back');
    if (s3back) s3back.addEventListener('click', function () { goToStep(2); });

    var checkoutBtn = $('bm-checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);

    // Promo code toggle
    var promoToggle = $('bm-promo-toggle');
    var promoField  = $('bm-promo-field');
    if (promoToggle && promoField) {
      promoToggle.addEventListener('click', function () {
        var open = promoField.style.display !== 'none';
        promoField.style.display = open ? 'none' : 'block';
        if (!open) { var inp = $('bm-promo-code'); if (inp) inp.focus(); }
      });
    }

    // Close button
    var closeBtn = $('bm-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Backdrop click
    var modal = $('booking-modal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
    });

    // Fleet card "Book This Ride" buttons — open modal pre-selecting vehicle
    document.querySelectorAll('[data-stripe-vehicle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(this.getAttribute('data-stripe-vehicle'));
      });
    });

    // Generic "Book Now" buttons — open modal on step 1
    document.querySelectorAll('[data-stripe-book]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(null);
      });
    });

  });

  // Expose for external use
  window.CJStripe = { openModal: openModal, closeModal: closeModal };

}());
