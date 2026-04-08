/**
 * CJ's Fun Time Rental — Booking Flow + Stripe Checkout
 *
 * Handles the 3-step booking modal:
 *   Step 1 — Vehicle selection
 *   Step 2 — Rental type (hourly / 9hr / 24hr / multi-day) + delivery options
 *   Step 3 — Order summary + Stripe checkout
 *
 * Pricing model (v2):
 *   Hourly:    $30/hr, 3-hour minimum (all vehicles)
 *   9 hours:   Slingshots $175, Can-Am $160
 *   24 hours:  Slingshots $220, Can-Am $200
 *   Multi-day: Tiered per-day rates (2-3d, 4-6d, 7+d)
 *   Delivery:  $50 each way within 30 mi of Lancaster
 *
 * Requires stripe.config.js to be loaded first.
 */

(function () {
  'use strict';

  var FACEBOOK_URL = 'https://www.facebook.com/people/CJs-Fun-Time-Rental/61575102921796/';
  var SUPABASE_FUNCTIONS = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1';

  // ── Default pricing — overridable via window.SITE_CONFIG.pricing ───────────
  var PRICING = {
    hourlyRate: 30,
    hourlyMin: 3,
    ninehrRate: { slingshot: 175, canam: 160 },
    dailyRate:  { slingshot: 220, canam: 200 },
    multiDay: [
      { minDays: 7, label: 'Weekly rate',  slingshot: 165, canam: 150, enabled: true },
      { minDays: 4, label: '4–6 day rate', slingshot: 185, canam: 170, enabled: true },
      { minDays: 2, label: '2–3 day rate', slingshot: 200, canam: 185, enabled: true }
    ],
    delivery: { enabled: true, fee: 50, maxMiles: 30, locationName: 'Lancaster, PA' }
  };

  // State
  var state = {
    vehicle: null,       // { key, label, rate, type }
    durationType: null,  // 'hourly' | '9hr' | '24hr' | 'multi'
    hours: 3,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    deliveryDropoff: false,
    deliveryPickup: false,
    promoCode: null
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getVehicleType(key) {
    // Check SITE_CONFIG first, fall back to key prefix
    if (window.SITE_CONFIG && window.SITE_CONFIG.vehicles && window.SITE_CONFIG.vehicles[key]) {
      return window.SITE_CONFIG.vehicles[key].type || (key.indexOf('canam') !== -1 ? 'canam' : 'slingshot');
    }
    return key.indexOf('canam') !== -1 ? 'canam' : 'slingshot';
  }

  function getPricing() {
    if (window.SITE_CONFIG && window.SITE_CONFIG.pricing) {
      return window.SITE_CONFIG.pricing;
    }
    return PRICING;
  }

  function calcMultiDayDays() {
    if (!state.startDate || !state.endDate) return 0;
    var start = new Date(state.startDate + 'T00:00:00');
    var end   = new Date(state.endDate   + 'T00:00:00');
    var ms = end - start;
    if (ms <= 0) return 0;
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function getMultiDayRate(type, days) {
    var p = getPricing();
    var tiers = (p.multiDay || []).filter(function (t) { return t.enabled !== false; }).sort(function (a, b) { return b.minDays - a.minDays; });
    for (var i = 0; i < tiers.length; i++) {
      if (days >= tiers[i].minDays) {
        return { perDay: tiers[i][type] || tiers[i].slingshot, label: tiers[i].label };
      }
    }
    // Fallback to 24hr rate if no tier matches (shouldn't happen for 2+ days)
    return { perDay: p.dailyRate[type] || p.dailyRate.slingshot, label: '' };
  }

  function calcPrice() {
    if (!state.vehicle || !state.durationType) return { total: 0, base: 0, delivery: 0, savings: 0, label: '', perUnit: 0 };
    var p = getPricing();
    var type = state.vehicle.type || 'slingshot';
    var base = 0;
    var label = '';
    var perUnit = 0;
    var savings = 0;
    var fullDayRate = 0;

    switch (state.durationType) {
      case 'hourly':
        perUnit = p.hourlyRate;
        base = perUnit * state.hours;
        label = state.hours + ' hour' + (state.hours !== 1 ? 's' : '') + ' × $' + perUnit + '/hr';
        // Calculate what 9hr rate would be for savings comparison
        fullDayRate = p.ninehrRate[type] || p.ninehrRate.slingshot;
        break;
      case '9hr':
        base = p.ninehrRate[type] || p.ninehrRate.slingshot;
        perUnit = base;
        label = '9-hour rental';
        break;
      case '24hr':
        base = p.dailyRate[type] || p.dailyRate.slingshot;
        perUnit = base;
        label = '24-hour rental';
        break;
      case 'multi':
        var days = calcMultiDayDays();
        if (days > 0) {
          var tier = getMultiDayRate(type, days);
          perUnit = tier.perDay;
          base = perUnit * days;
          label = days + ' day' + (days !== 1 ? 's' : '') + ' × $' + perUnit + '/day';
          // Savings vs standard 24hr rate
          var standardDaily = p.dailyRate[type] || p.dailyRate.slingshot;
          if (perUnit < standardDaily) {
            savings = (standardDaily - perUnit) * days;
          }
          if (tier.label) label += ' (' + tier.label + ')';
        }
        break;
    }

    var delivery = 0;
    if (p.delivery && p.delivery.enabled) {
      if (state.deliveryDropoff) delivery += p.delivery.fee;
      if (state.deliveryPickup)  delivery += p.delivery.fee;
    }

    return { total: base + delivery, base: base, delivery: delivery, savings: savings, label: label, perUnit: perUnit };
  }

  // ── Modal open / close ─────────────────────────────────────────────────────

  function openModal(preselectedVehicle, prefillDates) {
    var modal = $('booking-modal');
    if (!modal) return;

    // Reset delivery state
    state.deliveryDropoff = false;
    state.deliveryPickup = false;
    var dd = $('bm-delivery-dropoff');
    var dp = $('bm-delivery-pickup');
    if (dd) dd.checked = false;
    if (dp) dp.checked = false;

    if (preselectedVehicle) {
      preselectVehicle(preselectedVehicle);
      if (prefillDates && prefillDates.durationType) {
        state.durationType = prefillDates.durationType;
        state.startDate = prefillDates.startDate || null;
        state.endDate = prefillDates.endDate || null;
        state.hours = prefillDates.hours || 3;
        if (state.startDate) {
          buildSummary();
          goToStep(3);
        } else {
          goToStep(2);
        }
      } else {
        goToStep(1);
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
    [1, 2, 3].forEach(function (i) {
      var panel = $('bm-panel-' + i);
      if (panel) panel.classList.toggle('active', i === n);
      var nav = $('bm-nav-' + i);
      if (nav) nav.style.display = (i === n) ? 'flex' : 'none';
    });
    document.querySelectorAll('.bm-step-tab').forEach(function (tab) {
      var s = parseInt(tab.getAttribute('data-step'));
      tab.classList.toggle('active', s === n);
      tab.classList.toggle('done', s < n);
    });
    var scroll = document.querySelector('.bm-panel-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  // ── Vehicle selection ──────────────────────────────────────────────────────

  function preselectVehicle(key) {
    var btn = document.querySelector('.bm-vehicle-btn[data-vehicle="' + key + '"]');
    if (btn) selectVehicleBtn(btn);
  }

  window.selectVehicleBtn = selectVehicleBtn;
  function selectVehicleBtn(btn) {
    document.querySelectorAll('.bm-vehicle-btn').forEach(function (b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    state.vehicle = {
      key:   btn.getAttribute('data-vehicle'),
      label: btn.getAttribute('data-label'),
      rate:  parseInt(btn.getAttribute('data-rate'), 10),
      type:  getVehicleType(btn.getAttribute('data-vehicle'))
    };
    var nextBtn = $('bm-step1-next');
    if (nextBtn) nextBtn.disabled = false;
  }

  // ── Duration selection helpers ─────────────────────────────────────────────

  function showDurationFields(duration) {
    var hourlyWrap = $('bm-hourly-wrap');
    var singleWrap = $('bm-single-date-wrap');
    var multiWrap  = $('bm-multi-date-wrap');

    if (hourlyWrap) hourlyWrap.style.display = 'none';
    if (singleWrap) singleWrap.style.display = 'none';
    if (multiWrap)  multiWrap.style.display  = 'none';

    switch (duration) {
      case 'hourly':
        if (hourlyWrap) hourlyWrap.style.display = 'block';
        break;
      case '9hr':
      case '24hr':
        if (singleWrap) singleWrap.style.display = 'block';
        break;
      case 'multi':
        if (multiWrap) multiWrap.style.display = 'block';
        break;
    }
  }

  function updateUpsellNudge() {
    var nudge = $('bm-upsell-nudge');
    if (!nudge || !state.vehicle) return;

    var p = getPricing();
    var type = state.vehicle.type || 'slingshot';
    var hours = state.hours;
    var hourlyTotal = hours * p.hourlyRate;
    var ninehrRate = p.ninehrRate[type] || p.ninehrRate.slingshot;

    if (hourlyTotal >= ninehrRate) {
      nudge.innerHTML = '<strong>Tip:</strong> A 9-hour day is only <strong>$' + ninehrRate + '</strong> — you\'d save <strong>$' + (hourlyTotal - ninehrRate) + '</strong> by upgrading!';
      nudge.style.display = 'block';
    } else if (hours >= 5) {
      var diff = ninehrRate - hourlyTotal;
      nudge.innerHTML = '<strong>Tip:</strong> For just <strong>$' + diff + ' more</strong>, you could get a full 9-hour day ($' + ninehrRate + ')!';
      nudge.style.display = 'block';
    } else {
      nudge.style.display = 'none';
    }
  }

  function updateMultiDayInfo() {
    var info = $('bm-multi-rate-info');
    if (!info || !state.vehicle) return;
    var days = calcMultiDayDays();
    if (days > 0) {
      var type = state.vehicle.type || 'slingshot';
      var tier = getMultiDayRate(type, days);
      var p = getPricing();
      var standardDaily = p.dailyRate[type] || p.dailyRate.slingshot;
      var total = tier.perDay * days;
      var html = '<strong>$' + tier.perDay + '/day</strong> × ' + days + ' days = <strong>$' + total + '</strong>';
      if (tier.perDay < standardDaily) {
        var saved = (standardDaily - tier.perDay) * days;
        html += ' &mdash; you save <strong>$' + saved + '</strong>!';
      }
      info.innerHTML = html;
      info.style.display = 'block';
    } else {
      info.style.display = 'none';
    }
  }

  // ── Summary builder ────────────────────────────────────────────────────────

  function buildSummary() {
    if (!state.vehicle || !state.durationType) return;

    var price = calcPrice();

    $('bm-summary-vehicle-name').textContent = state.vehicle.label;
    $('bm-summary-rate').textContent = price.label;
    $('bm-summary-rental-type').textContent = {
      hourly: 'Hourly',
      '9hr': '9-Hour Day',
      '24hr': '24-Hour Rental',
      multi: 'Multi-Day'
    }[state.durationType] || '—';

    // Date display
    if (state.durationType === 'hourly') {
      var hourlyDate = $('bm-hourly-date');
      $('bm-summary-start').textContent = formatDate(hourlyDate ? hourlyDate.value : state.startDate);
      $('bm-summary-end-row').style.display = 'none';
    } else if (state.durationType === 'multi') {
      $('bm-summary-start').textContent = formatDate(state.startDate);
      $('bm-summary-end').textContent = formatDate(state.endDate);
      $('bm-summary-end-row').style.display = 'flex';
    } else {
      $('bm-summary-start').textContent = formatDate(state.startDate);
      $('bm-summary-end-row').style.display = 'none';
    }

    // Duration
    var durationText = '—';
    switch (state.durationType) {
      case 'hourly': durationText = state.hours + ' hour' + (state.hours !== 1 ? 's' : ''); break;
      case '9hr':    durationText = '9 hours'; break;
      case '24hr':   durationText = '24 hours'; break;
      case 'multi':
        var days = calcMultiDayDays();
        durationText = days > 0 ? days + ' day' + (days !== 1 ? 's' : '') : '—';
        break;
    }
    $('bm-summary-days').textContent = durationText;

    // Base price
    $('bm-summary-base').textContent = '$' + price.base;

    // Savings
    var savingsRow = $('bm-savings-row');
    if (price.savings > 0) {
      $('bm-summary-savings').textContent = '−$' + price.savings;
      savingsRow.style.display = 'flex';
    } else {
      savingsRow.style.display = 'none';
    }

    // Delivery
    var deliveryRow = $('bm-delivery-row');
    if (price.delivery > 0) {
      var dlParts = [];
      if (state.deliveryDropoff) dlParts.push('Drop-off');
      if (state.deliveryPickup)  dlParts.push('Pickup');
      $('bm-delivery-label').textContent = dlParts.join(' + ');
      $('bm-summary-delivery').textContent = '+$' + price.delivery;
      deliveryRow.style.display = 'flex';
    } else {
      deliveryRow.style.display = 'none';
    }

    // Total
    $('bm-summary-total').textContent = price.total > 0 ? '$' + price.total : '—';
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  function checkout() {
    if (!state.vehicle || !state.durationType) return;

    if (!window.STRIPE_ENABLED) {
      window.open(FACEBOOK_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    var btn = $('bm-checkout-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to checkout...'; }

    var promoInput = $('bm-promo-code');
    var promoCode = promoInput ? promoInput.value.trim().toUpperCase() : null;

    var price = calcPrice();

    // Build date string for checkout
    var startDateVal, endDateVal;
    if (state.durationType === 'hourly') {
      var hd = $('bm-hourly-date');
      startDateVal = hd ? hd.value : state.startDate;
      endDateVal = startDateVal;
    } else if (state.durationType === 'multi') {
      startDateVal = state.startDate;
      endDateVal = state.endDate;
    } else {
      startDateVal = state.startDate;
      endDateVal = startDateVal;
    }

    fetch(SUPABASE_FUNCTIONS + '/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleKey:    state.vehicle.key,
        durationType:  state.durationType,
        hours:         state.durationType === 'hourly' ? state.hours : undefined,
        days:          state.durationType === 'multi' ? calcMultiDayDays() : (state.durationType === '24hr' ? 1 : undefined),
        startDate:     formatDate(startDateVal),
        endDate:       formatDate(endDateVal),
        totalCents:    price.total * 100,
        baseCents:     price.base * 100,
        deliveryDropoff: state.deliveryDropoff,
        deliveryPickup:  state.deliveryPickup,
        deliveryFee:     price.delivery > 0 ? price.delivery * 100 : 0,
        promoCode:       promoCode || undefined
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.url) {
        window.location.href = data.url;
      } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Book & Pay Securely →'; }
        alert(data.error || 'Something went wrong. Please try again.');
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

    // Override pricing from site config if available
    if (window.SITE_CONFIG && window.SITE_CONFIG.pricing) {
      var cp = window.SITE_CONFIG.pricing;
      if (cp.hourlyRate)  PRICING.hourlyRate  = cp.hourlyRate;
      if (cp.hourlyMin)   PRICING.hourlyMin   = cp.hourlyMin;
      if (cp.ninehrRate)  PRICING.ninehrRate   = cp.ninehrRate;
      if (cp.dailyRate)   PRICING.dailyRate    = cp.dailyRate;
      if (cp.multiDay)    PRICING.multiDay     = cp.multiDay;
      if (cp.delivery)    PRICING.delivery     = cp.delivery;
    }

    // Vehicle buttons in modal
    document.querySelectorAll('.bm-vehicle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { selectVehicleBtn(this); });
    });

    // Step 1 → 2
    var s1next = $('bm-step1-next');
    if (s1next) s1next.addEventListener('click', function () { goToStep(2); });

    // Duration preset buttons
    document.querySelectorAll('.bm-duration-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.bm-duration-btn').forEach(function (b) { b.classList.remove('selected'); });
        this.classList.add('selected');
        state.durationType = this.getAttribute('data-duration');
        showDurationFields(state.durationType);
      });
    });

    // Hourly: hours selector + upsell
    var hourlyHours = $('bm-hourly-hours');
    if (hourlyHours) {
      hourlyHours.addEventListener('change', function () {
        state.hours = parseInt(this.value, 10) || 3;
        updateUpsellNudge();
      });
    }

    // Multi-day: live rate info
    var multiStart = $('bm-multi-start-date');
    var multiEnd   = $('bm-multi-end-date');
    if (multiStart) multiStart.addEventListener('change', function () { state.startDate = this.value; updateMultiDayInfo(); });
    if (multiEnd)   multiEnd.addEventListener('change', function ()   { state.endDate   = this.value; updateMultiDayInfo(); });

    // Delivery checkboxes
    var ddCheck = $('bm-delivery-dropoff');
    var dpCheck = $('bm-delivery-pickup');
    if (ddCheck) ddCheck.addEventListener('change', function () { state.deliveryDropoff = this.checked; });
    if (dpCheck) dpCheck.addEventListener('change', function () { state.deliveryPickup  = this.checked; });

    // Step 2 → back / next
    var s2back = $('bm-step2-back');
    if (s2back) s2back.addEventListener('click', function () { goToStep(1); });

    var s2next = $('bm-step2-next');
    if (s2next) s2next.addEventListener('click', function () {
      if (!state.durationType) {
        alert('Please select a rental type.');
        return;
      }

      // Validate based on duration type
      if (state.durationType === 'hourly') {
        var hourlyDate = $('bm-hourly-date');
        if (!hourlyDate || !hourlyDate.value) {
          alert('Please select a pickup date.');
          return;
        }
        state.startDate = hourlyDate.value;
        state.endDate = hourlyDate.value;
        state.startTime = ($('bm-hourly-start') || {}).value || '09:00';
        state.hours = parseInt(($('bm-hourly-hours') || {}).value, 10) || 3;

      } else if (state.durationType === '9hr' || state.durationType === '24hr') {
        var startVal = ($('bm-start-date') || {}).value;
        if (!startVal) {
          alert('Please select a pickup date.');
          return;
        }
        state.startDate = startVal;
        state.endDate = startVal;
        if (state.durationType === '9hr') {
          state.startTime = '09:00';
          state.endTime = '18:00';
        } else {
          state.startTime = '09:00';
          state.endTime = '09:00';
        }

      } else if (state.durationType === 'multi') {
        var ms = ($('bm-multi-start-date') || {}).value;
        var me = ($('bm-multi-end-date')   || {}).value;
        if (!ms || !me) {
          alert('Please select both a start and end date.');
          return;
        }
        if (new Date(me) <= new Date(ms)) {
          alert('Return date must be after pickup date.');
          return;
        }
        var days = calcMultiDayDays();
        if (days < 2) {
          alert('Multi-day rentals require at least 2 days. For a single day, choose 9-hour or 24-hour rental.');
          return;
        }
        state.startDate = ms;
        state.endDate = me;
        state.startTime = '09:00';
        state.endTime = '09:00';
      }

      // Check blocked dates
      var blocked = (window.SITE_CONFIG && window.SITE_CONFIG.blockedDates) || [];
      if (blocked.length > 0 && state.startDate) {
        var checkStart = new Date(state.startDate);
        var checkEnd   = new Date(state.endDate || state.startDate);
        for (var d = new Date(checkStart); d <= checkEnd; d.setDate(d.getDate() + 1)) {
          var iso = d.toISOString().split('T')[0];
          if (blocked.indexOf(iso) !== -1) {
            alert('Sorry, ' + iso + ' is unavailable. Please choose different dates.');
            return;
          }
        }
      }

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
