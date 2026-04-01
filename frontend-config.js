/**
 * frontend-config.js
 * Reads window.SITE_CONFIG (set by /site-config.js served by Express)
 * and applies admin-controlled settings to the live frontend.
 * Safe no-op if SITE_CONFIG is null (server unavailable).
 */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG;
  if (!cfg) return;

  document.addEventListener('DOMContentLoaded', function () {

    // ── 1. Section visibility & order ──────────────────────────
    var sectionMap = {
      header:      document.getElementById('site-header'),
      hero:        document.getElementById('hero'),
      fleet:       document.getElementById('fleet'),
      how:         document.getElementById('how'),
      reviews:     document.getElementById('reviews'),
      faq:         document.getElementById('faq'),
      ctaSection:  document.getElementById('book'),
      leadCapture: document.getElementById('win')
    };

    // Apply visibility
    if (cfg.sections) {
      Object.keys(cfg.sections).forEach(function (key) {
        var el = sectionMap[key];
        if (el && cfg.sections[key].visible === false) {
          el.style.display = 'none';
        }
      });
    }

    // Apply section order — re-insert elements before the footer in config order
    if (cfg.sectionOrder && cfg.sectionOrder.length) {
      var footer = document.querySelector('.site-footer');
      if (footer) {
        cfg.sectionOrder.forEach(function (key) {
          var el = sectionMap[key];
          if (el) footer.parentNode.insertBefore(el, footer);
        });
      }
    }

    // ── 2. Pricing & availability ───────────────────────────────
    if (cfg.vehicles) {
      Object.keys(cfg.vehicles).forEach(function (key) {
        var v = cfg.vehicles[key];

        // Fleet card price
        var detailBtn = document.querySelector('.fleet-card-book[data-vehicle-detail="' + key + '"]');
        if (detailBtn) {
          var card = detailBtn.closest('.fleet-card');
          if (card) {
            var priceEl = card.querySelector('.fleet-card-price');
            if (priceEl) priceEl.innerHTML = '$' + v.ratePerDay + '<span>/ day</span>';
            if (v.available === false) card.style.display = 'none';
          }
        }

        // Booking modal vehicle button
        var modalBtn = document.querySelector('.bm-vehicle-btn[data-vehicle="' + key + '"]');
        if (modalBtn) {
          modalBtn.setAttribute('data-rate', v.ratePerDay);
          var bvPrice = modalBtn.querySelector('.bv-price');
          if (bvPrice) bvPrice.textContent = '$' + v.ratePerDay + ' / day';
          if (v.available === false) modalBtn.style.display = 'none';
        }
      });
    }

    // ── 3. Copy injection ───────────────────────────────────────
    if (cfg.copy) {
      var c = cfg.copy;

      // Hero
      applyText('.hero-body h1',    c.hero && c.hero.headline,    true);
      applyText('.hero-body > div > p', c.hero && c.hero.subheadline, false);

      // Fleet
      applyText('#fleet .fleet-header h2', c.fleet && c.fleet.headline, true);
      applyText('#fleet .fleet-header p',  c.fleet && c.fleet.subtext,  false);

      // How It Works
      applyText('#how .how-header h2', c.how && c.how.headline, false);
      applyText('#how .how-header p',  c.how && c.how.subtext,  false);
      var howTitles = document.querySelectorAll('.how-step-title');
      var howPanels = document.querySelectorAll('.how-detail-panel');
      if (c.how) {
        if (howTitles[0]) howTitles[0].textContent = c.how.step1Title || '';
        if (howTitles[1]) howTitles[1].textContent = c.how.step2Title || '';
        if (howTitles[2]) howTitles[2].textContent = c.how.step3Title || '';
        if (howPanels[0]) {
          var t1 = howPanels[0].querySelector('.how-detail-title');
          var b1 = howPanels[0].querySelector('.how-detail-body');
          if (t1) t1.textContent = c.how.step1Title || '';
          if (b1) b1.textContent = c.how.step1Body  || '';
        }
        if (howPanels[1]) {
          var t2 = howPanels[1].querySelector('.how-detail-title');
          var b2 = howPanels[1].querySelector('.how-detail-body');
          if (t2) t2.textContent = c.how.step2Title || '';
          if (b2) b2.textContent = c.how.step2Body  || '';
        }
        if (howPanels[2]) {
          var t3 = howPanels[2].querySelector('.how-detail-title');
          var b3 = howPanels[2].querySelector('.how-detail-body');
          if (t3) t3.textContent = c.how.step3Title || '';
          if (b3) b3.textContent = c.how.step3Body  || '';
        }
      }

      // Reviews
      applyText('#reviews .reviews-header h2', c.reviews && c.reviews.headline,   false);
      applyText('#reviews .reviews-header p',  c.reviews && c.reviews.ratingLine, false);

      // FAQ header
      applyText('.faq-left h2', c.faq && c.faq.headline, true);
      applyText('.faq-left p',  c.faq && c.faq.subtext,  false);

      // Lead capture
      if (c.leadCapture) {
        applyText('.lead-eyebrow',  c.leadCapture.eyebrow,    false);
        applyText('#win h2',        c.leadCapture.headline,   true);
        applyText('#win > .container > p.reveal', c.leadCapture.body, false);
        applyText('#lead-submit',   c.leadCapture.buttonText, false);
        applyText('.lead-fine',     c.leadCapture.finePrint,  false);
      }

      // Final CTA
      if (c.cta) {
        applyText('.cta-section h2',      c.cta.headline,   true);
        applyText('.cta-section > .container > p.reveal', c.cta.body, false);
      }
    }

    // ── 4. FAQ rebuild ──────────────────────────────────────────
    if (cfg.faqs && cfg.faqs.length) {
      var faqList = document.querySelector('.faq-list');
      if (faqList) {
        var faqHtml = '';
        cfg.faqs.forEach(function (item) {
          if (item.visible === false) return;
          faqHtml += '<div class="faq-item">'
            + '<button class="faq-question"><span>' + escHtml(item.question) + '</span><span class="faq-icon">+</span></button>'
            + '<div class="faq-answer"><p>' + escHtml(item.answer) + '</p></div>'
            + '</div>';
        });
        faqList.innerHTML = faqHtml;

        // Re-bind accordion
        faqList.querySelectorAll('.faq-question').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var item = this.parentElement;
            var isOpen = item.classList.contains('open');
            faqList.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
            if (!isOpen) item.classList.add('open');
          });
        });
      }
    }

    // ── 5. Discounts → stripe-checkout.js ─────────────────────
    if (cfg.discounts) {
      window.CJFR_SAVINGS = cfg.discounts
        .filter(function (d) { return d.enabled !== false; })
        .map(function (d) { return { days: d.days, pct: d.pct, label: d.label }; })
        .sort(function (a, b) { return b.days - a.days; });
    }

    // ── 6. Blocked dates ───────────────────────────────────────
    if (cfg.blockedDates && cfg.blockedDates.length) {
      window.CJFR_BLOCKED_DATES = cfg.blockedDates;
      document.querySelectorAll('input[type="date"]').forEach(function (input) {
        input.addEventListener('change', function () {
          if (window.CJFR_BLOCKED_DATES.indexOf(this.value) !== -1) {
            alert('That date is unavailable. Please choose a different date.');
            this.value = '';
          }
        });
      });
    }

  });

  // ── Helpers ───────────────────────────────────────────────────
  function applyText(selector, text, asHtml) {
    if (text === undefined || text === null) return;
    var el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) return;
    if (asHtml) el.innerHTML = text;
    else el.textContent = text;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

}());
