(function () {
  'use strict';

  var cfg = null;
  var activeSection = 'sections';
  var calYear, calMonth;

  var SECTION_LABELS = {
    header:      'Header / Navigation',
    hero:        'Hero (top banner)',
    fleet:       'Fleet / Vehicles Grid',
    how:         'How It Works',
    reviews:     'Reviews Carousel',
    faq:         'FAQ Section',
    ctaSection:  'Final CTA (Book Your Ride)',
    leadCapture: 'Lead Capture (10% Off offer)'
  };

  var COPY_SECTIONS = [
    {
      key: 'hero', label: 'Hero',
      fields: [
        { key: 'headline',    label: 'Headline',         type: 'input'    },
        { key: 'subheadline', label: 'Sub-headline',     type: 'input'    },
        { key: 'ctaPrimary',  label: 'Primary CTA text', type: 'input'    },
        { key: 'ctaSecondary',label: 'Secondary CTA text',type:'input'    }
      ]
    },
    {
      key: 'fleet', label: 'Fleet Section',
      fields: [
        { key: 'headline', label: 'Headline',  type: 'input'    },
        { key: 'subtext',  label: 'Sub-text',  type: 'textarea' }
      ]
    },
    {
      key: 'how', label: 'How It Works',
      fields: [
        { key: 'headline',   label: 'Headline',        type: 'input'    },
        { key: 'subtext',    label: 'Sub-text',        type: 'input'    },
        { key: 'step1Title', label: 'Step 1 Title',    type: 'input'    },
        { key: 'step1Body',  label: 'Step 1 Body',     type: 'textarea' },
        { key: 'step2Title', label: 'Step 2 Title',    type: 'input'    },
        { key: 'step2Body',  label: 'Step 2 Body',     type: 'textarea' },
        { key: 'step3Title', label: 'Step 3 Title',    type: 'input'    },
        { key: 'step3Body',  label: 'Step 3 Body',     type: 'textarea' }
      ]
    },
    {
      key: 'reviews', label: 'Reviews',
      fields: [
        { key: 'headline',   label: 'Headline',    type: 'input' },
        { key: 'ratingLine', label: 'Rating line', type: 'input' }
      ]
    },
    {
      key: 'faq', label: 'FAQ Header',
      fields: [
        { key: 'headline', label: 'Headline', type: 'input' },
        { key: 'subtext',  label: 'Sub-text', type: 'input' }
      ]
    },
    {
      key: 'leadCapture', label: 'Lead Capture (10% Off)',
      fields: [
        { key: 'eyebrow',    label: 'Eyebrow text',  type: 'input'    },
        { key: 'headline',   label: 'Headline',      type: 'input'    },
        { key: 'body',       label: 'Body text',     type: 'textarea' },
        { key: 'buttonText', label: 'Button text',   type: 'input'    },
        { key: 'finePrint',  label: 'Fine print',    type: 'input'    }
      ]
    },
    {
      key: 'cta', label: 'Final CTA',
      fields: [
        { key: 'headline',   label: 'Headline',    type: 'input'    },
        { key: 'body',       label: 'Body text',   type: 'textarea' },
        { key: 'buttonText', label: 'Button text', type: 'input'    }
      ]
    }
  ];

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    var now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth();

    checkAuth();
    bindLoginForm();
    bindNav();
    bindSaveBtn();
    bindLogoutBtn();
  }

  // ── Auth ─────────────────────────────────────────────────────
  function checkAuth() {
    fetch('/api/auth/me')
      .then(function (r) { return r.json(); })
      .then(function (data) { if (data.loggedIn) showAdmin(); })
      .catch(function () {});
  }

  function bindLoginForm() {
    var btn = document.getElementById('login-btn');
    var pwInput = document.getElementById('login-password');

    function doLogin() {
      var pw = pwInput.value.trim();
      if (!pw) return;
      btn.disabled = true;
      btn.textContent = 'Signing in…';

      fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pw })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          showAdmin();
        } else {
          showLoginError(data.error || 'Invalid password');
          btn.disabled = false;
          btn.textContent = 'Sign In';
        }
      })
      .catch(function () {
        showLoginError('Server error — is the server running?');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      });
    }

    btn.addEventListener('click', doLogin);
    pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  }

  function showLoginError(msg) {
    var el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function bindLogoutBtn() {
    document.getElementById('logout-btn').addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST' })
        .then(function () {
          document.body.className = 'not-logged-in';
          document.getElementById('login-password').value = '';
          document.getElementById('login-error').classList.add('hidden');
          document.getElementById('login-btn').disabled = false;
          document.getElementById('login-btn').textContent = 'Sign In';
        });
    });
  }

  function showAdmin() {
    loadConfig().then(function () {
      document.body.className = 'logged-in';
      renderPanel(activeSection);
    });
  }

  // ── Config ───────────────────────────────────────────────────
  function loadConfig() {
    return fetch('/api/config')
      .then(function (r) { return r.json(); })
      .then(function (data) { cfg = data; });
  }

  function bindSaveBtn() {
    document.getElementById('save-btn').addEventListener('click', function () {
      collectFormData();
      saveConfig();
    });
  }

  function saveConfig() {
    setSaveStatus('Saving…');
    fetch('/api/config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cfg)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        setSaveStatus('✓ Saved! Changes are live.');
        setTimeout(function () { setSaveStatus(''); }, 3500);
      } else {
        setSaveStatus('Error: ' + (data.error || 'unknown'));
      }
    })
    .catch(function () { setSaveStatus('Network error — not saved.'); });
  }

  function setSaveStatus(msg) {
    document.getElementById('save-status').textContent = msg;
  }

  // ── Navigation ───────────────────────────────────────────────
  function bindNav() {
    document.querySelectorAll('.nav-link[data-section]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        collectFormData();
        activeSection = this.getAttribute('data-section');
        updateNavActive(activeSection);
        renderPanel(activeSection);
      });
    });
  }

  function updateNavActive(name) {
    document.querySelectorAll('.nav-link[data-section]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-section') === name);
    });
  }

  // ── Panel router ─────────────────────────────────────────────
  var PANEL_TITLES = {
    sections:  'Show / Hide Sections',
    pricing:   'Pricing & Availability',
    copy:      'Edit Copy',
    faq:       'FAQ',
    discounts: 'Discounts',
    calendar:  'Blocked Dates',
    leads:     'Leads'
  };

  function renderPanel(name) {
    document.querySelectorAll('.admin-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    document.getElementById('panel-title').textContent = PANEL_TITLES[name] || '';

    var map = {
      sections:  renderSectionsPanel,
      pricing:   renderPricingPanel,
      copy:      renderCopyPanel,
      faq:       renderFaqPanel,
      discounts: renderDiscountsPanel,
      calendar:  renderCalendarPanel,
      leads:     renderLeadsPanel
    };
    if (map[name]) map[name]();
  }

  // ── Sections panel ───────────────────────────────────────────
  function renderSectionsPanel() {
    var container = document.getElementById('section-toggles');

    // Ensure sectionOrder exists
    if (!cfg.sectionOrder) {
      cfg.sectionOrder = Object.keys(cfg.sections);
    }

    renderSectionItems(container);
  }

  function renderSectionItems(container) {
    var html = '';
    cfg.sectionOrder.forEach(function (key) {
      var checked = cfg.sections[key] && cfg.sections[key].visible ? 'checked' : '';
      html += '<div class="toggle-row" draggable="true" data-section-key="' + key + '">'
        + '<div class="section-drag-left">'
        +   '<span class="section-drag-handle" title="Drag to reorder">⠿</span>'
        +   '<label>' + (SECTION_LABELS[key] || key) + '</label>'
        + '</div>'
        + '<label class="toggle-switch">'
        +   '<input type="checkbox" data-binding="sections.' + key + '.visible" ' + checked + '>'
        +   '<span class="toggle-slider"></span>'
        + '</label>'
        + '</div>';
    });
    container.innerHTML = html;

    // Re-bind checkboxes directly (data-binding handled by collectFormData too)
    container.querySelectorAll('[data-binding]').forEach(function (el) {
      el.addEventListener('change', function () {
        var path = this.getAttribute('data-binding').split('.');
        var obj = cfg;
        for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
        obj[path[path.length - 1]] = this.checked;
      });
    });

    // Drag-to-reorder
    var dragSrc = null;
    var rows = container.querySelectorAll('.toggle-row[data-section-key]');
    rows.forEach(function (row) {
      row.addEventListener('dragstart', function (e) {
        dragSrc = this;
        this.style.opacity = '0.45';
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', function () {
        this.style.opacity = '';
        container.querySelectorAll('.toggle-row').forEach(function (r) {
          r.classList.remove('drag-over');
        });
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this !== dragSrc) this.classList.add('drag-over');
      });
      row.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!dragSrc || dragSrc === this) return;
        var fromKey = dragSrc.getAttribute('data-section-key');
        var toKey   = this.getAttribute('data-section-key');
        var fromIdx = cfg.sectionOrder.indexOf(fromKey);
        var toIdx   = cfg.sectionOrder.indexOf(toKey);
        cfg.sectionOrder.splice(fromIdx, 1);
        cfg.sectionOrder.splice(toIdx, 0, fromKey);
        renderSectionItems(container);
      });
    });
  }

  // ── Pricing panel ────────────────────────────────────────────
  function renderPricingPanel() {
    var container = document.getElementById('vehicle-cards');
    var html = '';
    Object.keys(cfg.vehicles).forEach(function (key) {
      var v = cfg.vehicles[key];
      var avail = v.available ? 'checked' : '';
      html += '<div class="vehicle-admin-card">'
        + '<h3>' + esc(v.name) + '</h3>'
        + '<div class="vac-row">'
        +   '<label>Available</label>'
        +   '<label class="toggle-switch">'
        +     '<input type="checkbox" data-binding="vehicles.' + key + '.available" ' + avail + '>'
        +     '<span class="toggle-slider"></span>'
        +   '</label>'
        + '</div>'
        + '<div class="vac-row">'
        +   '<label>Daily Rate</label>'
        +   '<div class="rate-input-wrap">'
        +     '<span>$</span>'
        +     '<input type="number" min="1" max="9999" data-binding="vehicles.' + key + '.ratePerDay" value="' + v.ratePerDay + '">'
        +   '</div>'
        + '</div>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  // ── Copy panel ───────────────────────────────────────────────
  function renderCopyPanel() {
    var container = document.getElementById('copy-fields');
    var html = '';
    COPY_SECTIONS.forEach(function (sec) {
      html += '<div class="copy-section" id="copy-sec-' + sec.key + '">'
        + '<div class="copy-section-header" data-copy-sec="' + sec.key + '">'
        +   '<span>' + sec.label + '</span>'
        +   '<span class="copy-section-chevron">▾</span>'
        + '</div>'
        + '<div class="copy-section-body">';

      sec.fields.forEach(function (f) {
        var val = (cfg.copy[sec.key] && cfg.copy[sec.key][f.key]) || '';
        var binding = 'copy.' + sec.key + '.' + f.key;
        html += '<div class="copy-field">'
          + '<label>' + esc(f.label) + '</label>';
        if (f.type === 'textarea') {
          html += '<textarea data-binding="' + binding + '">' + esc(val) + '</textarea>';
        } else {
          html += '<input type="text" data-binding="' + binding + '" value="' + esc(val) + '">';
        }
        html += '</div>';
      });

      html += '</div></div>';
    });
    container.innerHTML = html;

    // Bind accordion toggles
    container.querySelectorAll('.copy-section-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var sec = this.closest('.copy-section');
        sec.classList.toggle('open');
      });
    });

    // Open first by default
    var first = container.querySelector('.copy-section');
    if (first) first.classList.add('open');
  }

  // ── FAQ panel ────────────────────────────────────────────────
  function renderFaqPanel() {
    var container = document.getElementById('faq-list');
    renderFaqItems(container);
    var addBtn = document.getElementById('add-faq-btn');
    addBtn.onclick = function () {
      cfg.faqs.push({
        id:       'faq-' + Date.now(),
        question: '',
        answer:   '',
        visible:  true
      });
      renderFaqItems(container);
    };
  }

  function renderFaqItems(container) {
    var html = '';
    cfg.faqs.forEach(function (item, idx) {
      var checked = item.visible !== false ? 'checked' : '';
      html += '<div class="faq-admin-item" draggable="true" data-idx="' + idx + '">'
        + '<div class="faq-item-header">'
        +   '<span class="faq-drag-handle" title="Drag to reorder">⠿</span>'
        +   '<input type="text" class="faq-q-input" placeholder="Question…" value="' + esc(item.question) + '">'
        + '</div>'
        + '<textarea class="faq-a-input" placeholder="Answer…">' + esc(item.answer) + '</textarea>'
        + '<div class="faq-item-footer">'
        +   '<label class="faq-visible-label">'
        +     '<input type="checkbox" class="faq-vis-check" ' + checked + '> Visible'
        +   '</label>'
        +   '<button class="btn-icon-danger faq-delete-btn" data-idx="' + idx + '" title="Delete">✕</button>'
        + '</div>'
        + '</div>';
    });
    container.innerHTML = html;

    // Bind inputs to cfg.faqs
    var items = container.querySelectorAll('.faq-admin-item');
    items.forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-idx'));
      el.querySelector('.faq-q-input').addEventListener('input', function () {
        cfg.faqs[idx].question = this.value;
      });
      el.querySelector('.faq-a-input').addEventListener('input', function () {
        cfg.faqs[idx].answer = this.value;
      });
      el.querySelector('.faq-vis-check').addEventListener('change', function () {
        cfg.faqs[idx].visible = this.checked;
      });
      el.querySelector('.faq-delete-btn').addEventListener('click', function () {
        var i = parseInt(this.getAttribute('data-idx'));
        cfg.faqs.splice(i, 1);
        renderFaqItems(container);
      });
    });

    // Drag-to-reorder (HTML5 draggable)
    var dragSrc = null;
    items.forEach(function (el) {
      el.addEventListener('dragstart', function () {
        dragSrc = this;
        this.style.opacity = '0.5';
      });
      el.addEventListener('dragend', function () {
        this.style.opacity = '';
        container.querySelectorAll('.faq-admin-item').forEach(function (i) { i.classList.remove('drag-over'); });
      });
      el.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('drag-over');
      });
      el.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });
      el.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragSrc && dragSrc !== this) {
          var fromIdx = parseInt(dragSrc.getAttribute('data-idx'));
          var toIdx   = parseInt(this.getAttribute('data-idx'));
          var moved = cfg.faqs.splice(fromIdx, 1)[0];
          cfg.faqs.splice(toIdx, 0, moved);
          renderFaqItems(container);
        }
      });
    });
  }

  // ── Discounts panel ──────────────────────────────────────────
  function renderDiscountsPanel() {
    var tbody = document.getElementById('discount-rows');
    renderDiscountRows(tbody);
    document.getElementById('add-discount-btn').onclick = function () {
      cfg.discounts.push({ days: 1, pct: 5, label: 'New tier', enabled: true });
      renderDiscountRows(tbody);
    };
  }

  function renderDiscountRows(tbody) {
    var html = '';
    cfg.discounts.forEach(function (d, idx) {
      var en = d.enabled ? 'checked' : '';
      html += '<tr data-idx="' + idx + '">'
        + '<td><input type="number" min="1" max="365" class="d-days" value="' + d.days + '"></td>'
        + '<td><input type="number" min="1" max="100" class="d-pct" value="' + d.pct + '"></td>'
        + '<td><input type="text" class="d-label" value="' + esc(d.label) + '"></td>'
        + '<td>'
        +   '<label class="toggle-switch" style="display:inline-block">'
        +     '<input type="checkbox" class="d-enabled" ' + en + '>'
        +     '<span class="toggle-slider"></span>'
        +   '</label>'
        + '</td>'
        + '<td><button class="btn-icon-danger d-delete">✕</button></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('tr').forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-idx'));
      row.querySelector('.d-days').addEventListener('input',    function () { cfg.discounts[idx].days    = parseInt(this.value) || 1; });
      row.querySelector('.d-pct').addEventListener('input',     function () { cfg.discounts[idx].pct     = parseInt(this.value) || 0; });
      row.querySelector('.d-label').addEventListener('input',   function () { cfg.discounts[idx].label   = this.value; });
      row.querySelector('.d-enabled').addEventListener('change',function () { cfg.discounts[idx].enabled = this.checked; });
      row.querySelector('.d-delete').addEventListener('click',  function () {
        cfg.discounts.splice(idx, 1);
        renderDiscountRows(tbody);
      });
    });
  }

  // ── Calendar panel ───────────────────────────────────────────
  function renderCalendarPanel() {
    renderCalendar();
    renderBlockedList();
    document.getElementById('cal-prev').onclick = function () {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    };
    document.getElementById('cal-next').onclick = function () {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    };
  }

  function renderCalendar() {
    var MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
    var DAY_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    document.getElementById('cal-month-label').textContent = MONTH_NAMES[calMonth] + ' ' + calYear;

    var grid = document.getElementById('calendar-grid');
    var html = '';

    // Day-of-week headers
    DAY_LABELS.forEach(function (d) {
      html += '<div class="cal-day-label">' + d + '</div>';
    });

    var today    = new Date();
    today.setHours(0,0,0,0);
    var firstDay = new Date(calYear, calMonth, 1).getDay();
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    // Empty cells before day 1
    for (var e = 0; e < firstDay; e++) {
      html += '<div class="cal-day empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = calYear + '-'
        + String(calMonth + 1).padStart(2,'0') + '-'
        + String(d).padStart(2,'0');
      var cellDate = new Date(calYear, calMonth, d);
      var classes  = 'cal-day';

      if (cellDate < today)   classes += ' past';
      if (cellDate.getTime() === today.getTime()) classes += ' today';
      if (cfg.blockedDates.indexOf(dateStr) !== -1) classes += ' blocked';

      html += '<div class="' + classes + '" data-date="' + dateStr + '">' + d + '</div>';
    }

    grid.innerHTML = html;

    // Bind click handlers (skip past days)
    grid.querySelectorAll('.cal-day:not(.empty):not(.past)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var date = this.getAttribute('data-date');
        var idx  = cfg.blockedDates.indexOf(date);
        if (idx === -1) {
          cfg.blockedDates.push(date);
          cfg.blockedDates.sort();
        } else {
          cfg.blockedDates.splice(idx, 1);
        }
        renderCalendar();
        renderBlockedList();
      });
    });
  }

  function renderBlockedList() {
    var container = document.getElementById('blocked-list');
    if (!cfg.blockedDates.length) {
      container.innerHTML = '<span class="no-blocked">No dates blocked.</span>';
      return;
    }
    var html = '';
    cfg.blockedDates.forEach(function (date) {
      html += '<div class="blocked-chip">'
        + '<span>' + date + '</span>'
        + '<button class="blocked-chip-remove" data-date="' + date + '" title="Unblock">✕</button>'
        + '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.blocked-chip-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var date = this.getAttribute('data-date');
        var idx  = cfg.blockedDates.indexOf(date);
        if (idx !== -1) cfg.blockedDates.splice(idx, 1);
        renderCalendar();
        renderBlockedList();
      });
    });
  }

  // ── Leads panel ─────────────────────────────────────────────
  function renderLeadsPanel() {
    var tbody   = document.getElementById('leads-tbody');
    var empty   = document.getElementById('leads-empty');
    var count   = document.getElementById('leads-count');
    var expBtn  = document.getElementById('leads-export-btn');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#555">Loading…</td></tr>';
    empty.classList.add('hidden');

    fetch('/api/leads')
      .then(function (r) { return r.json(); })
      .then(function (leads) {
        count.textContent = leads.length + ' lead' + (leads.length !== 1 ? 's' : '');

        if (!leads.length) {
          tbody.innerHTML = '';
          empty.classList.remove('hidden');
          expBtn.disabled = true;
          return;
        }

        expBtn.disabled = false;
        var html = '';
        leads.forEach(function (lead, idx) {
          var d = new Date(lead.date);
          var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          var timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          html += '<tr>'
            + '<td class="lead-num">' + (idx + 1) + '</td>'
            + '<td class="lead-email">' + esc(lead.email) + '</td>'
            + '<td class="lead-source"><span class="source-badge">' + esc(lead.source || 'Website') + '</span></td>'
            + '<td class="lead-date">' + dateStr + ' <span class="lead-time">' + timeStr + '</span></td>'
            + '<td><button class="btn-icon-danger lead-delete-btn" data-idx="' + idx + '" title="Delete">✕</button></td>'
            + '</tr>';
        });
        tbody.innerHTML = html;

        // Delete buttons
        tbody.querySelectorAll('.lead-delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = this.getAttribute('data-idx');
            if (!confirm('Remove this lead?')) return;
            fetch('/api/leads/' + idx, { method: 'DELETE' })
              .then(function (r) { return r.json(); })
              .then(function (data) { if (data.ok) renderLeadsPanel(); });
          });
        });

        // Export CSV
        expBtn.onclick = function () {
          var rows = [['#', 'Email', 'Source', 'Date']];
          leads.forEach(function (l, i) {
            rows.push([i + 1, l.email, l.source || 'Website', new Date(l.date).toLocaleString()]);
          });
          var csv = rows.map(function (r) {
            return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
          }).join('\n');
          var blob = new Blob([csv], { type: 'text/csv' });
          var url  = URL.createObjectURL(blob);
          var a    = document.createElement('a');
          a.href = url;
          a.download = 'cjfr-leads-' + new Date().toISOString().slice(0,10) + '.csv';
          a.click();
          URL.revokeObjectURL(url);
        };
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#f87171">Failed to load leads.</td></tr>';
      });
  }

  // ── collectFormData ──────────────────────────────────────────
  // Harvests all data-binding inputs back into cfg before save/nav
  function collectFormData() {
    document.querySelectorAll('[data-binding]').forEach(function (el) {
      var path  = el.getAttribute('data-binding').split('.');
      var value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'number') {
        value = Number(el.value);
      } else {
        value = el.value;
      }
      // Walk path into cfg
      var obj = cfg;
      for (var i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
    });

    // FAQ and discount rows manage cfg directly via inline handlers,
    // so nothing extra needed for them here.
  }

  // ── Helpers ──────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
}());
