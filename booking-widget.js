/**
 * CJ Funtime Rental — Booking Widget
 *
 * Reusable booking widget for vehicle detail pages (Airbnb/Turo style)
 * Replaces the modal-based booking flow with an embedded form
 *
 * Usage:
 *   <div id="booking-widget" data-vehicle-key="slingshot_2022"></div>
 *   <script src="/booking-widget.js"></script>
 */

(function () {
  'use strict';

  var SUPABASE_FUNCTIONS = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1';

  // Default pricing — overridable via window.SITE_CONFIG.pricing
  var PRICING = {
    hourlyRate: 35,
    hourlyMin: 3,
    tenhrRate: { slingshot: 180, canam: 180 },
    dailyRate:  { slingshot: 250, canam: 250 },
    multiDay: [
      { minDays: 7, label: 'Weekly rate',  slingshot: 190, canam: 190, enabled: true },
      { minDays: 4, label: '4–6 day rate', slingshot: 210, canam: 210, enabled: true },
      { minDays: 2, label: '2–3 day rate', slingshot: 225, canam: 225, enabled: true }
    ],
    delivery: { enabled: true, fee: 50, maxMiles: 30, locationName: 'Lancaster, PA' }
  };

  // State
  var state = {
    vehicleKey: null,
    vehicleType: null,  // 'slingshot' or 'canam'
    durationType: null,  // 'hourly' | '10hr' | '24hr' | 'multi'
    hours: 3,
    startDate: null,
    endDate: null,
    startTime: null,
    pickupTime: null,
    deliveryDropoff: false,
    deliveryPickup: false
  };

  // Cache for existing bookings
  var existingBookings = [];
  var vehicleBlocks = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatCurrency(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  // Get vehicle type from key
  function getVehicleType(key) {
    if (!key) return 'slingshot';
    var k = key.toLowerCase();
    if (k.includes('canam') || k.includes('spyder')) return 'canam';
    return 'slingshot';
  }

  // ── Availability Checking ────────────────────────────────────────────────

  function fetchExistingBookings(vehicleKey) {
    if (window.SITE_CONFIG && window.SITE_CONFIG.bookings) {
      existingBookings = window.SITE_CONFIG.bookings.filter(function(b) {
        return b.vehicle === vehicleKey ||
               b.vehicle.toLowerCase().includes(vehicleKey.toLowerCase()) ||
               vehicleKey.toLowerCase().includes(b.vehicle.toLowerCase());
      });
      console.log('[BookingWidget] Loaded ' + existingBookings.length + ' bookings for ' + vehicleKey);
    }

    if (window.SITE_CONFIG && window.SITE_CONFIG.vehicleBlocks) {
      vehicleBlocks = window.SITE_CONFIG.vehicleBlocks.filter(function(b) {
        return b.vehicle_key === vehicleKey || vehicleKey.includes(b.vehicle_key);
      });
      console.log('[BookingWidget] Loaded ' + vehicleBlocks.length + ' vehicle blocks for ' + vehicleKey);
    }

    return Promise.resolve();
  }

  function isDateRangeAvailable(startDate, endDate, vehicleKey) {
    if (!startDate) return { available: true };

    var reqStart = new Date(startDate + 'T00:00:00');
    var reqEnd = new Date((endDate || startDate) + 'T23:59:59');

    // Check existing bookings
    for (var i = 0; i < existingBookings.length; i++) {
      var booking = existingBookings[i];
      if (booking.vehicle !== vehicleKey && !vehicleKey.includes(booking.vehicle)) continue;

      var bStart = new Date(booking.start_date + 'T00:00:00');
      var bEnd = new Date(booking.end_date + 'T23:59:59');

      if (reqStart <= bEnd && reqEnd >= bStart) {
        return {
          available: false,
          message: 'This vehicle is already booked from ' + formatDate(booking.start_date) +
                   ' to ' + formatDate(booking.end_date) + '. Please choose different dates.'
        };
      }
    }

    // Check vehicle-specific blocks
    for (var j = 0; j < vehicleBlocks.length; j++) {
      var block = vehicleBlocks[j];
      if (block.vehicle_key !== vehicleKey && !vehicleKey.includes(block.vehicle_key)) continue;

      var blockStart = new Date(block.start_date + 'T00:00:00');
      var blockEnd = new Date(block.end_date + 'T23:59:59');

      if (reqStart <= blockEnd && reqEnd >= blockStart) {
        var reasonMsg = block.reason ? ' (' + block.reason + ')' : '';
        return {
          available: false,
          message: 'This vehicle is unavailable from ' + formatDate(block.start_date) +
                   ' to ' + formatDate(block.end_date) + reasonMsg +
                   '. Please choose different dates or try another vehicle.'
        };
      }
    }

    // Check global blocked dates
    if (window.CJFR_BLOCKED_DATES && window.CJFR_BLOCKED_DATES.length) {
      var current = new Date(reqStart);
      while (current <= reqEnd) {
        var dateStr = current.toISOString().split('T')[0];
        if (window.CJFR_BLOCKED_DATES.indexOf(dateStr) !== -1) {
          return {
            available: false,
            message: 'The date ' + formatDate(dateStr) + ' is unavailable. Please choose different dates.'
          };
        }
        current.setDate(current.getDate() + 1);
      }
    }

    return { available: true };
  }

  // ── Pricing Calculation ──────────────────────────────────────────────────

  function calcPrice() {
    var type = state.vehicleType || 'slingshot';
    var basePrice = 0;
    var days = 0;

    if (state.durationType === 'hourly') {
      var hours = state.hours || PRICING.hourlyMin;
      basePrice = PRICING.hourlyRate * hours;

    } else if (state.durationType === '10hr') {
      basePrice = PRICING.tenhrRate[type] || 180;

    } else if (state.durationType === '24hr') {
      basePrice = PRICING.dailyRate[type] || 250;

    } else if (state.durationType === 'multi') {
      if (!state.startDate || !state.endDate) return { basePrice: 0, total: 0, days: 0 };

      var start = new Date(state.startDate);
      var end = new Date(state.endDate);
      days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Find matching tier
      var tier = null;
      for (var i = 0; i < PRICING.multiDay.length; i++) {
        var t = PRICING.multiDay[i];
        if (t.enabled && days >= t.minDays) {
          tier = t;
          break;
        }
      }

      if (tier) {
        basePrice = tier[type] * days;
      } else {
        basePrice = PRICING.dailyRate[type] * days;
      }
    }

    var deliveryFee = 0;
    if (state.deliveryDropoff) deliveryFee += PRICING.delivery.fee;
    if (state.deliveryPickup) deliveryFee += PRICING.delivery.fee;

    var total = basePrice + deliveryFee;

    return {
      basePrice: basePrice,
      deliveryFee: deliveryFee,
      total: total,
      days: days
    };
  }

  // ── UI Rendering ─────────────────────────────────────────────────────────

  function renderWidget(containerId, vehicleKey) {
    var container = $(containerId);
    if (!container) {
      console.error('[BookingWidget] Container not found:', containerId);
      return;
    }

    state.vehicleKey = vehicleKey;
    state.vehicleType = getVehicleType(vehicleKey);

    // Load pricing from config if available
    if (window.SITE_CONFIG && window.SITE_CONFIG.pricing) {
      var cp = window.SITE_CONFIG.pricing;
      if (cp.hourlyRate)  PRICING.hourlyRate  = cp.hourlyRate;
      if (cp.hourlyMin)   PRICING.hourlyMin   = cp.hourlyMin;
      if (cp.tenhrRate)   PRICING.tenhrRate   = cp.tenhrRate;
      else if (cp.ninehrRate) PRICING.tenhrRate = cp.ninehrRate; // Legacy
      if (cp.dailyRate)   PRICING.dailyRate    = cp.dailyRate;
      if (cp.multiDay)    PRICING.multiDay     = cp.multiDay;
      if (cp.delivery)    PRICING.delivery     = cp.delivery;
    }

    // Fetch bookings
    fetchExistingBookings(vehicleKey);

    // Build widget HTML
    var html = '<div class="bw-container">'
      + '<div class="bw-header">'
      + '<div class="bw-price-display" id="bw-price-display">Select rental type to see price</div>'
      + '</div>'

      // Duration type selector
      + '<div class="bw-section">'
      + '<label class="bw-label">Rental Type</label>'
      + '<div class="bw-duration-btns" id="bw-duration-btns">'
      + '<button type="button" class="bw-duration-btn" data-duration="hourly">'
      + '<span class="bw-btn-label">Hourly</span>'
      + '<span class="bw-btn-sub">$35/hr · 3hr min</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="10hr">'
      + '<span class="bw-btn-label">10 Hours</span>'
      + '<span class="bw-btn-sub">$180 full day</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="24hr">'
      + '<span class="bw-btn-label">24 Hours</span>'
      + '<span class="bw-btn-sub">$250 overnight</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="multi">'
      + '<span class="bw-btn-label">Multi-Day</span>'
      + '<span class="bw-btn-sub">Discounted rates</span>'
      + '</button>'
      + '</div>'
      + '</div>'

      // Date fields (shown conditionally)
      + '<div id="bw-date-fields"></div>'

      // Delivery options
      + '<div class="bw-section" id="bw-delivery-section" style="display:none;">'
      + '<label class="bw-label">Delivery Options</label>'
      + '<div class="bw-delivery-options">'
      + '<label class="bw-checkbox">'
      + '<input type="checkbox" id="bw-delivery-dropoff"> Drop-off at my location <strong>+$50</strong>'
      + '</label>'
      + '<label class="bw-checkbox">'
      + '<input type="checkbox" id="bw-delivery-pickup"> Pick up from my location <strong>+$50</strong>'
      + '</label>'
      + '</div>'
      + '</div>'

      // Error message
      + '<div id="bw-error" class="bw-error" style="display:none;"></div>'

      // CTA button
      + '<button type="button" class="bw-cta" id="bw-cta" disabled>Select rental type to continue</button>'

      + '</div>';

    container.innerHTML = html;

    // Bind event listeners
    bindEvents();
  }

  function bindEvents() {
    // Duration type buttons
    document.querySelectorAll('.bw-duration-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.bw-duration-btn').forEach(function(b) { b.classList.remove('selected'); });
        this.classList.add('selected');
        state.durationType = this.getAttribute('data-duration');
        showDateFields(state.durationType);
        updatePricing();
      });
    });

    // Delivery checkboxes
    var ddCheck = $('bw-delivery-dropoff');
    var dpCheck = $('bw-delivery-pickup');
    if (ddCheck) ddCheck.addEventListener('change', function() {
      state.deliveryDropoff = this.checked;
      updatePricing();
    });
    if (dpCheck) dpCheck.addEventListener('change', function() {
      state.deliveryPickup = this.checked;
      updatePricing();
    });

    // CTA button
    var ctaBtn = $('bw-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', function() {
        proceedToCheckout();
      });
    }
  }

  function showDateFields(durationType) {
    var container = $('bw-date-fields');
    if (!container) return;

    var html = '';

    if (durationType === 'hourly') {
      html = '<div class="bw-section">'
        + '<label class="bw-label">Pickup Date</label>'
        + '<input type="date" class="bw-input" id="bw-hourly-date">'
        + '</div>'
        + '<div class="bw-row">'
        + '<div class="bw-field">'
        + '<label class="bw-label">Start Time</label>'
        + '<input type="time" class="bw-input" id="bw-hourly-start" value="09:00">'
        + '</div>'
        + '<div class="bw-field">'
        + '<label class="bw-label">Hours</label>'
        + '<select class="bw-input" id="bw-hourly-hours">'
        + '<option value="3">3 hours — $105</option>'
        + '<option value="4">4 hours — $140</option>'
        + '<option value="5">5 hours — $175</option>'
        + '<option value="6">6 hours — $210</option>'
        + '<option value="7">7 hours — $245</option>'
        + '<option value="8">8 hours — $280</option>'
        + '</select>'
        + '</div>'
        + '</div>';

    } else if (durationType === '10hr' || durationType === '24hr') {
      html = '<div class="bw-section">'
        + '<label class="bw-label">Pickup Date</label>'
        + '<input type="date" class="bw-input" id="bw-single-date">'
        + '</div>'
        + '<div class="bw-section">'
        + '<label class="bw-label">Preferred Pickup Time</label>'
        + '<select class="bw-input" id="bw-pickup-time">'
        + '<option value="08:00">8:00 AM</option>'
        + '<option value="08:30">8:30 AM</option>'
        + '<option value="09:00" selected>9:00 AM</option>'
        + '<option value="09:30">9:30 AM</option>'
        + '<option value="10:00">10:00 AM</option>'
        + '<option value="10:30">10:30 AM</option>'
        + '<option value="11:00">11:00 AM</option>'
        + '<option value="11:30">11:30 AM</option>'
        + '<option value="12:00">12:00 PM</option>'
        + '</select>'
        + '</div>';

    } else if (durationType === 'multi') {
      html = '<div class="bw-row">'
        + '<div class="bw-field">'
        + '<label class="bw-label">Start Date</label>'
        + '<input type="date" class="bw-input" id="bw-multi-start">'
        + '</div>'
        + '<div class="bw-field">'
        + '<label class="bw-label">End Date</label>'
        + '<input type="date" class="bw-input" id="bw-multi-end">'
        + '</div>'
        + '</div>'
        + '<div class="bw-section">'
        + '<label class="bw-label">Preferred Pickup Time</label>'
        + '<select class="bw-input" id="bw-pickup-time">'
        + '<option value="08:00">8:00 AM</option>'
        + '<option value="08:30">8:30 AM</option>'
        + '<option value="09:00" selected>9:00 AM</option>'
        + '<option value="10:00">10:00 AM</option>'
        + '<option value="11:00">11:00 AM</option>'
        + '</select>'
        + '</div>';
    }

    container.innerHTML = html;

    // Bind date change events
    if (durationType === 'hourly') {
      var hourlyDate = $('bw-hourly-date');
      var hourlyHours = $('bw-hourly-hours');
      var hourlyStart = $('bw-hourly-start');
      if (hourlyDate) hourlyDate.addEventListener('change', function() {
        state.startDate = this.value;
        state.endDate = this.value;
        updatePricing();
      });
      if (hourlyHours) hourlyHours.addEventListener('change', function() {
        state.hours = parseInt(this.value, 10);
        updatePricing();
      });
      if (hourlyStart) hourlyStart.addEventListener('change', function() {
        state.startTime = this.value;
      });

    } else if (durationType === '10hr' || durationType === '24hr') {
      var singleDate = $('bw-single-date');
      var pickupTime = $('bw-pickup-time');
      if (singleDate) singleDate.addEventListener('change', function() {
        state.startDate = this.value;
        state.endDate = this.value;
        updatePricing();
      });
      if (pickupTime) pickupTime.addEventListener('change', function() {
        state.pickupTime = this.value;
      });

    } else if (durationType === 'multi') {
      var multiStart = $('bw-multi-start');
      var multiEnd = $('bw-multi-end');
      var pickupTime = $('bw-pickup-time');
      if (multiStart) multiStart.addEventListener('change', function() {
        state.startDate = this.value;
        updatePricing();
      });
      if (multiEnd) multiEnd.addEventListener('change', function() {
        state.endDate = this.value;
        updatePricing();
      });
      if (pickupTime) pickupTime.addEventListener('change', function() {
        state.pickupTime = this.value;
      });
    }

    // Show delivery section
    var deliverySection = $('bw-delivery-section');
    if (deliverySection) deliverySection.style.display = 'block';
  }

  function updatePricing() {
    var priceDisplay = $('bw-price-display');
    var ctaBtn = $('bw-cta');
    var errorDiv = $('bw-error');

    if (!state.durationType) {
      if (priceDisplay) priceDisplay.textContent = 'Select rental type to see price';
      if (ctaBtn) {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Select rental type to continue';
      }
      return;
    }

    if (!state.startDate) {
      if (priceDisplay) priceDisplay.textContent = 'Select dates to see price';
      if (ctaBtn) {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Select dates to continue';
      }
      return;
    }

    // Check availability
    var availability = isDateRangeAvailable(state.startDate, state.endDate, state.vehicleKey);
    if (!availability.available) {
      if (errorDiv) {
        errorDiv.textContent = availability.message;
        errorDiv.style.display = 'block';
      }
      if (priceDisplay) priceDisplay.textContent = 'Dates unavailable';
      if (ctaBtn) {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Select different dates';
      }
      return;
    }

    // Hide error
    if (errorDiv) errorDiv.style.display = 'none';

    // Calculate price
    var pricing = calcPrice();

    if (priceDisplay) {
      var priceText = formatCurrency(pricing.total * 100);
      if (state.durationType === 'multi' && pricing.days > 0) {
        priceText += ' total · ' + pricing.days + ' days';
      }
      priceDisplay.textContent = priceText;
    }

    if (ctaBtn) {
      ctaBtn.disabled = false;
      ctaBtn.textContent = 'Continue to Checkout';
    }
  }

  function proceedToCheckout() {
    if (!state.durationType || !state.startDate) {
      alert('Please select rental type and dates.');
      return;
    }

    // Check availability one more time
    var availability = isDateRangeAvailable(state.startDate, state.endDate, state.vehicleKey);
    if (!availability.available) {
      alert(availability.message);
      return;
    }

    // Build booking data
    var pricing = calcPrice();
    var bookingData = {
      vehicleKey: state.vehicleKey,
      vehicleType: state.vehicleType,
      durationType: state.durationType,
      hours: state.hours,
      startDate: state.startDate,
      endDate: state.endDate || state.startDate,
      startTime: state.startTime || '09:00',
      pickupTime: state.pickupTime || '09:00',
      deliveryDropoff: state.deliveryDropoff,
      deliveryPickup: state.deliveryPickup,
      basePrice: pricing.basePrice,
      deliveryFee: pricing.deliveryFee,
      total: pricing.total,
      days: pricing.days
    };

    // Store in sessionStorage
    sessionStorage.setItem('cjfr_booking_data', JSON.stringify(bookingData));

    // Redirect to checkout page
    window.location.href = '/checkout.html';
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.BookingWidget = {
    init: function(containerId, vehicleKey) {
      renderWidget(containerId, vehicleKey);
    }
  };

  // Auto-initialize if widget container found
  document.addEventListener('DOMContentLoaded', function() {
    var widget = document.getElementById('booking-widget');
    if (widget) {
      var vehicleKey = widget.getAttribute('data-vehicle-key');
      if (vehicleKey) {
        window.BookingWidget.init('booking-widget', vehicleKey);
      }
    }
  });

})();
