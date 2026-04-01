/**
 * CJ's Fun Time Rental — Stripe Checkout Handler
 *
 * Wires up "Book with Card" buttons to Stripe Payment Links.
 * Falls back to Facebook booking when STRIPE_ENABLED is false.
 *
 * Requires stripe.config.js to be loaded first.
 */

(function () {
  'use strict';

  var FACEBOOK_URL = 'https://www.facebook.com/people/CJs-Fun-Time-Rental/61575102921796/';

  /**
   * Redirect to the appropriate payment destination for a given vehicle key.
   * @param {string} vehicleKey - one of the keys in STRIPE_PAYMENT_LINKS
   */
  function bookVehicle(vehicleKey) {
    if (!window.STRIPE_ENABLED) {
      window.open(FACEBOOK_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    var link = window.STRIPE_PAYMENT_LINKS && window.STRIPE_PAYMENT_LINKS[vehicleKey];

    if (!link || link.indexOf('REPLACE') !== -1) {
      console.warn('[Stripe] Payment link not configured for: ' + vehicleKey + '. Falling back to Facebook.');
      window.open(FACEBOOK_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    // Redirect to Stripe Payment Link
    window.location.href = link;
  }

  /**
   * Generic "book now" — used for CTAs that are not vehicle-specific.
   * Opens booking modal if available, otherwise goes straight to the
   * first available payment link or Facebook.
   */
  function bookNow() {
    var modal = document.getElementById('booking-modal');
    if (modal) {
      openModal(modal);
      return;
    }
    // No modal — fall back directly
    bookVehicle('slingshot_2022');
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────

  function openModal(modal) {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first interactive element
    var first = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) setTimeout(function () { first.focus(); }, 50);
  }

  function closeModal(modal) {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {

    // Wire up vehicle-specific book buttons (fleet cards)
    document.querySelectorAll('[data-stripe-vehicle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        bookVehicle(this.getAttribute('data-stripe-vehicle'));
      });
    });

    // Wire up generic book-now buttons
    document.querySelectorAll('[data-stripe-book]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        bookNow();
      });
    });

    // Modal close button
    document.querySelectorAll('[data-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var modal = document.getElementById('booking-modal');
        if (modal) closeModal(modal);
      });
    });

    // Close modal on backdrop click
    var modal = document.getElementById('booking-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal(modal);
      });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('booking-modal');
        if (m && m.classList.contains('open')) closeModal(m);
      }
    });
  });

  // Expose for inline onclick use if needed
  window.CJStripe = { bookVehicle: bookVehicle, bookNow: bookNow };

}());
