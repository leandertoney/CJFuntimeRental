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
    hourlyRate: 30,
    hourlyMin: 3,
    hourlyMax: 9,           // max selectable hours; above this it's a full day
    hourlyCap: 180,         // hourly total never exceeds this (= the 9hr rate)
    tenhrRate: { slingshot: 180, canam: 180 },
    dailyRate:  { slingshot: 250, canam: 250 },
    multiDay: [
      { minDays: 7, label: 'Weekly rate',  slingshot: 190, canam: 190, enabled: true },
      { minDays: 4, label: '4–6 day rate', slingshot: 210, canam: 210, enabled: true },
      { minDays: 2, label: '2–3 day rate', slingshot: 220, canam: 220, enabled: true }
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

  // One message for every reason a date is closed. The customer needs to know
  // the vehicle is not available; they do not need to know it is on a Turo
  // rental or that the owner is on vacation, and telling them when someone
  // else has it booked is nobody's business either.
  var UNAVAILABLE_MSG = 'This vehicle is not available on those dates. Please choose different dates.';

  // Does a booking or block row belong to the vehicle on this page?
  // `bookings.vehicle` holds a display NAME ("2016 Polaris Slingshot") while
  // vehicleKey is a KEY ("slingshot_2020"), so the old comparison never matched
  // and booked dates were never greyed out. vehicle_key is authoritative when
  // present; older rows only have the name.
  function rowMatchesVehicle(row, vehicleKey) {
    if (row.vehicle_key) return row.vehicle_key === vehicleKey;
    var name = row.vehicle || '';
    if (!name) return false;
    var v = (window.SITE_CONFIG && window.SITE_CONFIG.vehicles && window.SITE_CONFIG.vehicles[vehicleKey]) || {};
    return name === v.name || name === v.label || name === vehicleKey;
  }

  // Every date this vehicle cannot be rented, as {from,to} ranges the date
  // picker can grey out. Same three sources the bottom-of-form check uses, so
  // the calendar and the validation can never disagree.
  function unavailableRanges(vehicleKey) {
    var out = [], i;
    for (i = 0; i < existingBookings.length; i++) {
      if (!rowMatchesVehicle(existingBookings[i], vehicleKey)) continue;
      out.push({ from: existingBookings[i].start_date, to: existingBookings[i].end_date || existingBookings[i].start_date });
    }
    for (i = 0; i < vehicleBlocks.length; i++) {
      if (vehicleBlocks[i].vehicle_key !== vehicleKey) continue;
      out.push({ from: vehicleBlocks[i].start_date, to: vehicleBlocks[i].end_date || vehicleBlocks[i].start_date });
    }
    if (window.CJFR_BLOCKED_DATES && window.CJFR_BLOCKED_DATES.length) {
      for (i = 0; i < window.CJFR_BLOCKED_DATES.length; i++) {
        out.push({ from: window.CJFR_BLOCKED_DATES[i], to: window.CJFR_BLOCKED_DATES[i] });
      }
    }
    return out;
  }

  // Local calendar date, never toISOString(): that resolves in UTC and rolls
  // the day over in the evening Eastern.
  function localDateStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function isDateRangeAvailable(startDate, endDate, vehicleKey) {
    if (!startDate) return { available: true };

    var reqStart = new Date(startDate + 'T00:00:00');
    var reqEnd = new Date((endDate || startDate) + 'T23:59:59');

    var ranges = unavailableRanges(vehicleKey);
    for (var i = 0; i < ranges.length; i++) {
      var rStart = new Date(ranges[i].from + 'T00:00:00');
      var rEnd = new Date(ranges[i].to + 'T23:59:59');
      if (reqStart <= rEnd && reqEnd >= rStart) {
        return { available: false, message: UNAVAILABLE_MSG };
      }
    }
    return { available: true };
  }

  // ── Pricing Calculation ──────────────────────────────────────────────────

  // Overlay stored values on defaults, ignoring the zeros/blanks that a
  // partially-saved config produces. Booleans pass through as-is so the
  // owner can still deliberately switch something off.
  function mergeRates(defaults, stored) {
    var out = {}, k;
    for (k in defaults) if (Object.prototype.hasOwnProperty.call(defaults, k)) out[k] = defaults[k];
    for (k in stored) {
      if (!Object.prototype.hasOwnProperty.call(stored, k)) continue;
      var v = stored[k];
      if (typeof v === 'boolean') { out[k] = v; continue; }
      if (typeof v === 'number' && v > 0) { out[k] = v; continue; }
      if (typeof v === 'string' && v !== '') { out[k] = v; continue; }
      if (v && typeof v === 'object') { out[k] = mergeRates(defaults[k] || {}, v); }
    }
    return out;
  }

  function calcPrice() {
    var type = state.vehicleType || 'slingshot';
    var basePrice = 0;
    var days = 0;

    if (state.durationType === 'hourly') {
      var hours = state.hours || PRICING.hourlyMin;
      // Cap the hourly total at the 9-hour rate: no 3-9hr duration bills above $180.
      // Anything longer than hourlyMax is a full day and is not selectable as hourly.
      basePrice = Math.min(PRICING.hourlyRate * hours, PRICING.hourlyCap);

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
      if (cp.hourlyMax)   PRICING.hourlyMax   = cp.hourlyMax;
      if (cp.hourlyCap)   PRICING.hourlyCap   = cp.hourlyCap;
      if (cp.tenhrRate)   PRICING.tenhrRate   = mergeRates(PRICING.tenhrRate, cp.tenhrRate);
      else if (cp.ninehrRate) PRICING.tenhrRate = mergeRates(PRICING.tenhrRate, cp.ninehrRate); // Legacy
      if (cp.dailyRate)   PRICING.dailyRate    = mergeRates(PRICING.dailyRate, cp.dailyRate);
      if (cp.multiDay)    PRICING.multiDay     = cp.multiDay;
      // Merge per key, never wholesale. These are objects, so `if (cp.x)` is
      // always true and a config carrying zeros used to REPLACE the defaults
      // outright. That is how a zeroed delivery block silenced the $50 fee and
      // hid the delivery section entirely, with no `|| 50` guard to catch it.
      if (cp.delivery)    PRICING.delivery     = mergeRates(PRICING.delivery, cp.delivery);
    }

    // Fetch bookings
    fetchExistingBookings(vehicleKey);

    // Build widget HTML
    var idRequirementNote = state.vehicleType === 'canam'
      ? '🪪 Motorcycle (M)–endorsed driver\'s license required'
      : '🪪 Valid photo ID required';

    var html = '<div class="bw-container">'
      + '<div class="bw-header">'
      + '<div class="bw-price-display" id="bw-price-display">Pick your dates</div>'
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
      + '<span class="bw-btn-label">☀️ ≤ 9 Hours</span>'
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

    // Grey out unavailable days in the calendar. Runs after the widget markup
    // exists and after fetchExistingBookings() has populated the two arrays.
    initDatePickers();

    // If the visitor arrived from a promo link, ask the server whether the code
    // is good and show the discounted price alongside the original.
    loadPromoFromUrl();
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
          // Keep state in sync with the input. state.startDate used to be set
          // only inside showDateFields(), which runs when a DURATION is chosen,
          // so changing just the date left the old value behind. That was
          // invisible until the promo preview started reading these dates to
          // decide whether a weekday-only discount applies, at which point a
          // Friday could still show a discounted price.
          state.startDate = this.value;
          if (state.durationType !== 'multi') state.endDate = this.value;
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
        if (this.value) state.endDate = this.value;
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

  // Build the hourly <option> list from config so the labels can never drift
  // from calcPrice(). Runs 3..hourlyMax (9); anything longer is a full day.
  function hourlyOptionsHtml() {
    var html = '';
    for (var h = PRICING.hourlyMin; h <= PRICING.hourlyMax; h++) {
      var price = Math.min(PRICING.hourlyRate * h, PRICING.hourlyCap);
      html += '<option value="' + h + '">' + h + ' hours — $' + price + '</option>';
    }
    return html;
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
        + hourlyOptionsHtml()
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
      if (priceDisplay) priceDisplay.textContent = 'Pick your dates';
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
      var depNote = '';
      if (depCfg.enabled !== false) {
        depNote = ' + $' + (Number(depCfg.amount) || 100) + ' refundable deposit';
      }

      // Someone arriving from a discount email needs to SEE the discount. Until
      // now the widget showed the full price with no sign the code had done
      // anything, so the only way to find out was to reach checkout. Show the
      // old price struck through next to the new one.
      //
      // Display only. The real discount is computed and enforced server-side in
      // supabase/functions/checkout/index.ts; nothing here changes what is
      // charged, and the promo is re-validated there.
      var promo = pendingPromo();
      if (promo && promo.percentOff > 0 && promoAppliesToDates(promo)) {
        var full = pricing.total;
        var off  = full - (full - Math.round(full * promo.percentOff) / 100);
        priceDisplay.innerHTML =
          '<span class="bw-price-was">' + formatCurrency(full * 100) + '</span> ' +
          '<span class="bw-price-now">' + formatCurrency((full - off) * 100) + '</span>' +
          '<span class="bw-price-note">' + promo.percentOff + '% off with ' + promo.code + depNote + '</span>';
      } else {
        priceDisplay.textContent = priceText + depNote;
      }
    }

    if (ctaBtn) {
      ctaBtn.disabled = false;
      ctaBtn.textContent = 'Continue to Checkout';
    }
  }


  // ── Promo preview ─────────────────────────────────────────────────────────
  // The widget does not decide whether a code is valid; it asks the checkout
  // function, which is the same code path that enforces the discount at
  // payment. This is purely so the price the customer sees matches the price
  // they will be charged.
  var promoState = null;

  function pendingPromo() { return promoState; }

  // Mirrors the weekday rule the server enforces, so we never show a discounted
  // price for dates the server would refuse.
  function promoAppliesToDates(promo) {
    if (!promo.weekdays || !promo.weekdays.length) return true;
    if (!state.startDate) return false;
    var parts = String(state.startDate).split('-').map(Number);
    var endParts = String(state.endDate || state.startDate).split('-').map(Number);
    var cur = new Date(parts[0], parts[1] - 1, parts[2]);
    var end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    var guard = 0;
    while (cur <= end && guard++ < 400) {
      if (promo.weekdays.indexOf(cur.getDay()) === -1) return false;
      cur.setDate(cur.getDate() + 1);
    }
    return true;
  }

  function loadPromoFromUrl() {
    var code;
    try { code = new URLSearchParams(window.location.search).get('promo'); }
    catch (e) { return; }
    if (!code) return;
    var api = (window.CJFR_FUNCTIONS_URL || 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1') + '/checkout';
    fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        validatePromoOnly: true, promoCode: code,
        vehicleKey: state.vehicleKey,
        // Deliberately no dates: this asks "is the code real and what are its
        // rules", before the visitor has picked a day. Sending today's date
        // would make a valid code look invalid whenever today is excluded.
        durationType: state.durationType || '24hr'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          promoState = { code: d.code, percentOff: d.percentOff, weekdays: d.weekdays || null };
          updatePricing();
        }
      })
      .catch(function () { /* preview only: never block booking */ });
  }


  // ── Date picker ───────────────────────────────────────────────────────────
  // Replaces <input type="date"> with flatpickr so unavailable days are GREYED
  // OUT in the calendar itself. Previously a customer picked a date, scrolled
  // to the bottom of the form, and only then learned the vehicle was taken.
  //
  // disableMobile:true is essential. flatpickr otherwise detects a phone and
  // hands back the native <input type="date">, which is the iOS wheel that
  // shows no availability at all, so the whole feature would silently do
  // nothing on the devices most of this traffic uses.
  var pickupFp = null, dropoffFp = null;

  function initDatePickers() {
    if (typeof window.flatpickr !== 'function') return;   // vendor script missing: keep native input
    var pickupInput = $('bw-pickup-date');
    var dropoffInput = $('bw-dropoff-date');
    if (!pickupInput) return;

    var disabled = unavailableRanges(state.vehicleKey);

    if (pickupFp) { pickupFp.destroy(); pickupFp = null; }
    if (dropoffFp) { dropoffFp.destroy(); dropoffFp = null; }

    var common = {
      dateFormat: 'Y-m-d',        // existing handlers read input.value in this format
      minDate: 'today',
      disable: disabled,
      disableMobile: true,
      showMonths: 1
    };

    pickupFp = window.flatpickr(pickupInput, Object.assign({}, common, {
      onChange: function (dates, str) {
        if (!dropoffFp || !str) return;
        // A multi-day rental must not be allowed to span a closed day, which
        // would otherwise only fail at the bottom of the form. Cap the return
        // date at the day before the next unavailable range.
        dropoffFp.set('minDate', str);
        var after = nextUnavailableAfter(str, disabled);
        dropoffFp.set('maxDate', after || null);
      }
    }));

    if (dropoffInput) {
      dropoffFp = window.flatpickr(dropoffInput, Object.assign({}, common, {}));
    }
  }

  // The last selectable day for a rental starting on startStr: the day before
  // the next unavailable range begins, or null when nothing blocks it.
  function nextUnavailableAfter(startStr, ranges) {
    var start = new Date(startStr + 'T00:00:00');
    var best = null;
    for (var i = 0; i < ranges.length; i++) {
      var from = new Date(ranges[i].from + 'T00:00:00');
      if (from > start && (!best || from < best)) best = from;
    }
    if (!best) return null;
    best.setDate(best.getDate() - 1);
    return localDateStr(best);
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
      // Carried from a ?promo= link so a code emailed to a lead survives the
      // hop to checkout.html, which is where it is actually applied. This is
      // display/plumbing only: the code is validated and the discount computed
      // server-side, so nothing here affects price math.
      promoCode: (function () {
        try { return new URLSearchParams(window.location.search).get('promo') || null; }
        catch (e) { return null; }
      })(),
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
