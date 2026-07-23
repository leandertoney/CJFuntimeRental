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

  // Get today's date in ISO format (YYYY-MM-DD)
  function getTodayISO() {
    var today = new Date();
    var year = today.getFullYear();
    var month = ('0' + (today.getMonth() + 1)).slice(-2);
    var day = ('0' + today.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
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
    var idRequirementNote = state.vehicleType === 'canam'
      ? '🪪 Motorcycle (M)–endorsed driver\'s license required'
      : '🪪 Valid photo ID required';

    var html = '<div class="bw-container">'
      + '<div class="bw-header">'
      + '<div class="bw-price-display" id="bw-price-display">Pick your dates to see availability</div>'
      + '</div>'

      // Up-front ID disclosure — no surprises at pickup
      + '<div class="bw-id-note">' + idRequirementNote + '</div>'

      // Date selection first
      + '<div class="bw-section">'
      + '<label class="bw-label">Pickup Date</label>'
      + '<input type="date" class="bw-date-input" id="bw-pickup-date" min="' + getTodayISO() + '">'
      + '</div>'

      + '<div class="bw-section">'
      + '<label class="bw-label">Drop-off Date <span style="color:#888;font-weight:400;">(Optional)</span></label>'
      + '<input type="date" class="bw-date-input" id="bw-dropoff-date" min="' + getTodayISO() + '">'
      + '<div class="bw-hint">Leave blank for same-day rental</div>'
      + '</div>'

      // Duration type selector (shown after dates)
      + '<div class="bw-section" id="bw-duration-section" style="display:none;">'
      + '<label class="bw-label">How long do you need it?</label>'
      + '<div class="bw-duration-btns" id="bw-duration-btns">'
      + '<button type="button" class="bw-duration-btn" data-duration="hourly">'
      + '<span class="bw-btn-label">⏱️ Hourly</span>'
      + '<span class="bw-btn-sub">$30/hr · 3hr min</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="10hr">'
      + '<span class="bw-btn-label">☀️ ≤ 10 Hours</span>'
      + '<span class="bw-btn-sub">$180 full day</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="24hr">'
      + '<span class="bw-btn-label">🌙 ≤ 24 Hours</span>'
      + '<span class="bw-btn-sub">$250 overnight</span>'
      + '</button>'
      + '<button type="button" class="bw-duration-btn" data-duration="multi">'
      + '<span class="bw-btn-label">📅 Multi-Day</span>'
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

    // Restore previous booking state if exists
    restoreBookingState();
  }

  function restoreBookingState() {
    var savedData = sessionStorage.getItem('cjfr_booking_data');
    if (!savedData) return;

    try {
      var data = JSON.parse(savedData);

      // Check if data is for current vehicle
      if (data.vehicleKey !== state.vehicleKey) return;

      // Check if data is stale (older than 24 hours)
      if (data.createdAt) {
        var age = Date.now() - data.createdAt;
        var maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (age > maxAge) {
          // Data is stale, clear it
          sessionStorage.removeItem('cjfr_booking_data');
          return;
        }
      }

      console.log('[BookingWidget] Restoring previous booking state');

      // Restore pickup date
      var pickupDateInput = $('bw-pickup-date');
      if (pickupDateInput && data.startDate) {
        pickupDateInput.value = data.startDate;
        state.startDate = data.startDate;
      }

      // Restore drop-off date (for multi-day)
      var dropoffDateInput = $('bw-dropoff-date');
      if (dropoffDateInput && data.endDate && data.endDate !== data.startDate) {
        dropoffDateInput.value = data.endDate;
        state.endDate = data.endDate;
      }

      // Show duration section if date is set
      var durationSection = $('bw-duration-section');
      if (pickupDateInput && pickupDateInput.value && durationSection) {
        durationSection.style.display = 'block';
      }

      // Restore duration selection
      if (data.durationType) {
        state.durationType = data.durationType;

        // Highlight the selected duration button
        var durationBtns = document.querySelectorAll('.bw-duration-btn');
        durationBtns.forEach(function(btn) {
          if (btn.getAttribute('data-duration') === data.durationType) {
            btn.classList.add('selected');
          }
        });

        // Show appropriate date/time fields
        showDateFields(data.durationType);

        // Restore time/hours based on duration type
        if (data.durationType === 'hourly') {
          if (data.hours) {
            state.hours = data.hours;
            var hoursSelect = $('bw-hourly-hours');
            if (hoursSelect) hoursSelect.value = data.hours;
          }
          if (data.startTime) {
            state.startTime = data.startTime;
            var startTimeInput = $('bw-hourly-start');
            if (startTimeInput) startTimeInput.value = data.startTime;
          }
        } else if (data.durationType === '10hr' || data.durationType === '24hr') {
          if (data.pickupTime) {
            state.pickupTime = data.pickupTime;
            var pickupTimeSelect = $('bw-pickup-time');
            if (pickupTimeSelect) pickupTimeSelect.value = data.pickupTime;
          }
        } else if (data.durationType === 'multi') {
          if (data.pickupTime) {
            state.pickupTime = data.pickupTime;
            var pickupTimeSelect = $('bw-pickup-time');
            if (pickupTimeSelect) pickupTimeSelect.value = data.pickupTime;
          }
        }

        // Restore delivery options
        if (data.deliveryDropoff) {
          state.deliveryDropoff = true;
          var ddCheck = $('bw-delivery-dropoff');
          if (ddCheck) ddCheck.checked = true;
        }
        if (data.deliveryPickup) {
          state.deliveryPickup = true;
          var dpCheck = $('bw-delivery-pickup');
          if (dpCheck) dpCheck.checked = true;
        }

        // Update pricing display
        updatePricing();
      }

    } catch (e) {
      console.error('[BookingWidget] Failed to restore booking state:', e);
      sessionStorage.removeItem('cjfr_booking_data');
    }
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

    // Date inputs - show duration section when pickup date is selected
    var pickupDateInput = $('bw-pickup-date');
    var dropoffDateInput = $('bw-dropoff-date');
    var durationSection = $('bw-duration-section');

    if (pickupDateInput) {
      pickupDateInput.addEventListener('change', function() {
        if (this.value) {
          // Show duration section when date is picked
          if (durationSection) durationSection.style.display = 'block';
          updatePricing();
        } else {
          if (durationSection) durationSection.style.display = 'none';
        }
      });
    }

    if (dropoffDateInput) {
      dropoffDateInput.addEventListener('change', function() {
        updatePricing();
      });
    }

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
      // Only show time and hours - dates already selected at top
      html = '<div class="bw-row">'
        + '<div class="bw-field">'
        + '<label class="bw-label">Start Time</label>'
        + '<input type="time" class="bw-input" id="bw-hourly-start" value="09:00">'
        + '</div>'
        + '<div class="bw-field">'
        + '<label class="bw-label">Hours</label>'
        + '<select class="bw-input" id="bw-hourly-hours">'
        + '<option value="3">3 hours — $90</option>'
        + '<option value="4">4 hours — $120</option>'
        + '<option value="5">5 hours — $150</option>'
        + '<option value="6">6 hours — $180</option>'
        + '<option value="7">7 hours — $180</option>'
        + '<option value="8">8 hours — $180</option>'
        + '<option value="9">9 hours — $180</option>'
        + '<option value="10">10 hours — $180</option>'
        + '</select>'
        + '</div>'
        + '</div>';

    } else if (durationType === '10hr' || durationType === '24hr') {
      // Only show pickup time - date already selected at top
      html = '<div class="bw-section">'
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
      // Only show pickup time - dates already selected at top
      html = '<div class="bw-section">'
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

    // Read dates from top inputs
    var topPickupDate = $('bw-pickup-date');
    var topDropoffDate = $('bw-dropoff-date');

    // Set state dates from top inputs
    if (topPickupDate && topPickupDate.value) {
      state.startDate = topPickupDate.value;

      // For single-day rentals, use same date for start and end
      if (durationType === 'hourly' || durationType === '10hr' || durationType === '24hr') {
        state.endDate = topPickupDate.value;
      }
      // For multi-day, use dropoff date if provided
      else if (durationType === 'multi') {
        state.endDate = (topDropoffDate && topDropoffDate.value) ? topDropoffDate.value : topPickupDate.value;
      }

      // Update pricing immediately with the dates from top inputs
      updatePricing();
    }

    // Bind time/hours change events
    if (durationType === 'hourly') {
      var hourlyHours = $('bw-hourly-hours');
      var hourlyStart = $('bw-hourly-start');

      if (hourlyHours) hourlyHours.addEventListener('change', function() {
        state.hours = parseInt(this.value, 10);
        updatePricing();
      });
      if (hourlyStart) hourlyStart.addEventListener('change', function() {
        state.startTime = this.value;
      });

    } else if (durationType === '10hr' || durationType === '24hr') {
      var pickupTime = $('bw-pickup-time');

      if (pickupTime) pickupTime.addEventListener('change', function() {
        state.pickupTime = this.value;
      });

    } else if (durationType === 'multi') {
      var pickupTime = $('bw-pickup-time');

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

    // Check if dates are selected
    var pickupInput = $('bw-pickup-date');
    var hasPickupDate = pickupInput && pickupInput.value;

    if (!hasPickupDate) {
      if (priceDisplay) priceDisplay.textContent = 'Pick your dates to see availability';
      if (ctaBtn) {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Select dates to continue';
      }
      return;
    }

    if (!state.durationType) {
      if (priceDisplay) priceDisplay.textContent = 'Select how long you need it';
      if (ctaBtn) {
        ctaBtn.disabled = true;
        ctaBtn.textContent = 'Select duration to continue';
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
      // Refundable deposit note (config: SITE_CONFIG.pricing.deposit)
      var depCfg = (window.SITE_CONFIG && window.SITE_CONFIG.pricing && window.SITE_CONFIG.pricing.deposit) || {};
      if (depCfg.enabled !== false) {
        priceText += ' + $' + (Number(depCfg.amount) || 100) + ' refundable deposit';
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
      days: pricing.days,
      createdAt: Date.now()  // Add timestamp for staleness detection
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
