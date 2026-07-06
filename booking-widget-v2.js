/**
 * CJ Funtime Rental — Simplified Booking Widget
 * Step 1: Pick date → Check availability
 * Step 2: Pick rental type (10hrs, 24hrs, multi-day)
 * Step 3: Pick pickup time
 * Step 4: Show price → Book
 */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1';

  var state = {
    step: 1, // 1: date, 2: rental type, 3: time, 4: summary
    vehicleKey: null,
    vehicleType: null, // 'slingshot' or 'canam'
    startDate: null,
    rentalType: null, // '10hr', '24hr', 'multi'
    days: 1,
    pickupTime: '9:00 AM',
    returnTime: null, // auto-calculated
    price: 0
  };

  var pricing = {
    tenhr: { slingshot: 180, canam: 180 },
    daily: { slingshot: 250, canam: 250 },
    multiDay: [
      { minDays: 7, rate: 190 },
      { minDays: 4, rate: 210 },
      { minDays: 2, rate: 225 }
    ]
  };

  function init() {
    var widgets = document.querySelectorAll('[data-booking-widget]');
    widgets.forEach(function(el) {
      state.vehicleKey = el.dataset.vehicleKey || 'slingshot_2022';
      state.vehicleType = el.dataset.vehicleType || 'slingshot';
      render(el);
    });
  }

  function render(container) {
    var html = '<div class="booking-widget">';

    if (state.step === 1) {
      html += renderStep1();
    } else if (state.step === 2) {
      html += renderStep2();
    } else if (state.step === 3) {
      html += renderStep3();
    } else if (state.step === 4) {
      html += renderStep4();
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
  }

  function renderStep1() {
    return `
      <div class="bw-step">
        <h3>When do you want it?</h3>
        <p class="bw-hint">Select your rental date</p>
        <input type="date" id="bw-date-input" class="bw-date-input"
               min="${getTodayISO()}"
               value="${state.startDate || ''}">
        <button class="btn-primary bw-next" id="bw-check-availability" disabled>
          Check Availability
        </button>
      </div>
    `;
  }

  function renderStep2() {
    var type = state.vehicleType;
    return `
      <div class="bw-step">
        <button class="bw-back">← Back</button>
        <h3>How long do you need it?</h3>
        <p class="bw-selected-date">📅 ${formatDate(state.startDate)}</p>

        <div class="bw-rental-types">
          <label class="bw-rental-card">
            <input type="radio" name="rental-type" value="10hr">
            <div class="bw-rental-content">
              <div class="bw-rental-title">10 Hours</div>
              <div class="bw-rental-price">$${pricing.tenhr[type]}</div>
              <div class="bw-rental-desc">Perfect for a day trip</div>
            </div>
          </label>

          <label class="bw-rental-card">
            <input type="radio" name="rental-type" value="24hr">
            <div class="bw-rental-content">
              <div class="bw-rental-title">24 Hours</div>
              <div class="bw-rental-price">$${pricing.daily[type]}</div>
              <div class="bw-rental-desc">Full day rental</div>
            </div>
          </label>

          <label class="bw-rental-card">
            <input type="radio" name="rental-type" value="multi">
            <div class="bw-rental-content">
              <div class="bw-rental-title">Multi-Day</div>
              <div class="bw-rental-price">From $${pricing.multiDay[2].rate}/day</div>
              <div class="bw-rental-desc">2+ days, discounted rates</div>
            </div>
          </label>
        </div>

        <button class="btn-primary bw-next" id="bw-continue-time" disabled>
          Continue
        </button>
      </div>
    `;
  }

  function renderStep3() {
    return `
      <div class="bw-step">
        <button class="bw-back">← Back</button>
        <h3>What time works for you?</h3>
        <p class="bw-selected-date">📅 ${formatDate(state.startDate)} • ${getRentalTypeLabel()}</p>

        <div class="bw-time-picker">
          <label>Pickup Time</label>
          <select id="bw-pickup-time" class="bw-select">
            ${generateTimeOptions()}
          </select>

          <div class="bw-time-calc">
            <div class="bw-time-row">
              <span>Pickup:</span>
              <strong>${state.startDate} at ${state.pickupTime}</strong>
            </div>
            <div class="bw-time-row">
              <span>Return:</span>
              <strong>${calculateReturnTime()}</strong>
            </div>
          </div>
        </div>

        <button class="btn-primary bw-next" id="bw-continue-summary">
          Continue to Summary
        </button>
      </div>
    `;
  }

  function renderStep4() {
    var total = calculatePrice();
    return `
      <div class="bw-step">
        <button class="bw-back">← Back</button>
        <h3>Ready to book?</h3>

        <div class="bw-summary">
          <div class="bw-summary-row">
            <span>Date:</span>
            <strong>${formatDate(state.startDate)}</strong>
          </div>
          <div class="bw-summary-row">
            <span>Duration:</span>
            <strong>${getRentalTypeLabel()}</strong>
          </div>
          <div class="bw-summary-row">
            <span>Pickup:</span>
            <strong>${state.pickupTime}</strong>
          </div>
          <div class="bw-summary-row">
            <span>Return:</span>
            <strong>${calculateReturnTime()}</strong>
          </div>
          <div class="bw-summary-row bw-summary-total">
            <span>Total:</span>
            <strong>$${total}</strong>
          </div>
        </div>

        <button class="btn-primary bw-book-now" id="bw-book-now">
          Book Now — $${total}
        </button>
      </div>
    `;
  }

  function bindEvents(container) {
    // Date input
    var dateInput = container.querySelector('#bw-date-input');
    if (dateInput) {
      dateInput.addEventListener('change', function() {
        state.startDate = this.value;
        var btn = container.querySelector('#bw-check-availability');
        btn.disabled = !state.startDate;
      });

      var checkBtn = container.querySelector('#bw-check-availability');
      if (checkBtn) {
        checkBtn.addEventListener('click', function() {
          // TODO: Check availability API
          state.step = 2;
          render(container);
        });
      }
    }

    // Rental type selection
    var rentalInputs = container.querySelectorAll('input[name="rental-type"]');
    rentalInputs.forEach(function(input) {
      input.addEventListener('change', function() {
        state.rentalType = this.value;
        var btn = container.querySelector('#bw-continue-time');
        btn.disabled = false;
      });
    });

    var continueTimeBtn = container.querySelector('#bw-continue-time');
    if (continueTimeBtn) {
      continueTimeBtn.addEventListener('click', function() {
        state.step = 3;
        render(container);
      });
    }

    // Time picker
    var timeSelect = container.querySelector('#bw-pickup-time');
    if (timeSelect) {
      timeSelect.addEventListener('change', function() {
        state.pickupTime = this.value;
        render(container);
      });
    }

    var summaryBtn = container.querySelector('#bw-continue-summary');
    if (summaryBtn) {
      summaryBtn.addEventListener('click', function() {
        state.step = 4;
        render(container);
      });
    }

    // Back buttons
    var backBtns = container.querySelectorAll('.bw-back');
    backBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.step = Math.max(1, state.step - 1);
        render(container);
      });
    });

    // Book now
    var bookBtn = container.querySelector('#bw-book-now');
    if (bookBtn) {
      bookBtn.addEventListener('click', function() {
        createCheckoutSession();
      });
    }
  }

  // Helpers
  function getTodayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDate(isoDate) {
    var d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function generateTimeOptions() {
    var times = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
    return times.map(function(t) {
      return '<option value="' + t + '"' + (t === state.pickupTime ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
  }

  function getRentalTypeLabel() {
    if (state.rentalType === '10hr') return '10 Hours';
    if (state.rentalType === '24hr') return '24 Hours';
    if (state.rentalType === 'multi') return state.days + ' Days';
    return '';
  }

  function calculateReturnTime() {
    if (!state.startDate || !state.pickupTime) return 'TBD';

    var pickup = new Date(state.startDate + 'T' + convertTo24Hour(state.pickupTime));
    var hours = 0;

    if (state.rentalType === '10hr') hours = 10;
    else if (state.rentalType === '24hr') hours = 24;
    else if (state.rentalType === 'multi') hours = state.days * 24;

    pickup.setHours(pickup.getHours() + hours);

    var dateStr = pickup.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var timeStr = pickup.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return dateStr + ' at ' + timeStr;
  }

  function convertTo24Hour(time12h) {
    var parts = time12h.match(/(\d+):(\d+)\s*(AM|PM)/i);
    var hours = parseInt(parts[1]);
    var minutes = parts[2];
    var period = parts[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return ('0' + hours).slice(-2) + ':' + minutes + ':00';
  }

  function calculatePrice() {
    var type = state.vehicleType;
    if (state.rentalType === '10hr') return pricing.tenhr[type];
    if (state.rentalType === '24hr') return pricing.daily[type];
    if (state.rentalType === 'multi') {
      // Find applicable multi-day rate
      var rate = pricing.daily[type];
      for (var i = 0; i < pricing.multiDay.length; i++) {
        if (state.days >= pricing.multiDay[i].minDays) {
          rate = pricing.multiDay[i].rate;
          break;
        }
      }
      return rate * state.days;
    }
    return 0;
  }

  function createCheckoutSession() {
    console.log('Creating checkout session...', state);
    // TODO: Call Stripe checkout API
    alert('Checkout not yet implemented in this prototype. State: ' + JSON.stringify(state, null, 2));
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
