(function () {
  'use strict';

  var ADMIN_API     = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/admin';
  var SUPABASE_URL  = 'https://yzdtevrwystezhbmgcwn.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZHRldnJ3eXN0ZXpoYm1nY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MDQxNjksImV4cCI6MjA1OTQ4MDE2OX0.KzX9rl6JLxkEiCLHIzHCmSHPVnJFlbQkWfHJi1p1JJU';

  var _supabase = null;
  function getSupabase() {
    if (!_supabase) _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return _supabase;
  }

  function adminHeaders(extra) {
    var token = _currentToken || '';
    return Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, extra || {});
  }

  var _currentToken = null;

  var cfg = null;
  var activeSection = 'overview';
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
    bindSidebarToggle();
    initChat();
  }

  function bindSidebarToggle() {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.add('collapsed');
    sidebar.addEventListener('mouseenter', function () {
      sidebar.classList.remove('collapsed');
    });
    sidebar.addEventListener('mouseleave', function () {
      sidebar.classList.add('collapsed');
    });
  }

  // ── Auth ─────────────────────────────────────────────────────
  function checkAuth() {
    getSupabase().auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session && session.access_token) {
        _currentToken = session.access_token;
        showAdmin();
      }
    });
  }

  function bindLoginForm() {
    var btn      = document.getElementById('login-btn');
    var emailIn  = document.getElementById('login-email');
    var pwInput  = document.getElementById('login-password');

    function doLogin() {
      var email = emailIn.value.trim();
      var pw    = pwInput.value.trim();
      if (!email || !pw) return;
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      document.getElementById('login-error').classList.add('hidden');

      getSupabase().auth.signInWithPassword({ email: email, password: pw })
        .then(function (res) {
          if (res.error) {
            showLoginError(res.error.message || 'Invalid email or password');
            btn.disabled = false;
            btn.textContent = 'Sign In';
            return;
          }
          _currentToken = res.data.session.access_token;
          showAdmin();
        })
        .catch(function () {
          showLoginError('Network error — check your connection.');
          btn.disabled = false;
          btn.textContent = 'Sign In';
        });
    }

    btn.addEventListener('click', doLogin);
    pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    emailIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') pwInput.focus(); });

    // Forgot password
    document.getElementById('forgot-link').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('reset-form').classList.remove('hidden');
      var resetEmail = document.getElementById('reset-email');
      resetEmail.value = emailIn.value;
      resetEmail.focus();
    });

    document.getElementById('back-to-login').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('reset-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    });

    document.getElementById('reset-btn').addEventListener('click', function () {
      var email = document.getElementById('reset-email').value.trim();
      var statusEl = document.getElementById('reset-status');
      if (!email) return;
      this.disabled = true;
      this.textContent = 'Sending…';
      var self = this;
      getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: 'https://cjfuntimerentals.com/admin'
      }).then(function (res) {
        if (res.error) {
          statusEl.textContent = res.error.message;
          statusEl.style.color = '#f87171';
        } else {
          statusEl.textContent = 'Reset link sent! Check your email.';
          statusEl.style.color = '#4ade80';
        }
        statusEl.classList.remove('hidden');
        self.disabled = false;
        self.textContent = 'Send Reset Link';
      });
    });
  }

  function showLoginError(msg) {
    var el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function bindLogoutBtn() {
    document.getElementById('logout-btn').addEventListener('click', function () {
      getSupabase().auth.signOut().then(function () {
        _currentToken = null;
        document.body.className = 'not-logged-in';
        document.getElementById('login-email').value = '';
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
    return fetch(ADMIN_API + '/config', { headers: adminHeaders() })
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
    fetch(ADMIN_API + '/config', {
      method:  'POST',
      headers: adminHeaders(),
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
    overview:  'Overview',
    sections:  'Show / Hide Sections',
    pricing:   'Pricing & Availability',
    copy:      'Edit Copy',
    faq:       'FAQ',
    discounts: 'Discounts',
    calendar:  'Blocked Dates',
    bookings:  'Bookings',
    leads:     'Leads'
  };

  function renderPanel(name) {
    document.querySelectorAll('.admin-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    document.getElementById('panel-title').textContent = PANEL_TITLES[name] || '';

    var map = {
      overview:  renderOverviewPanel,
      sections:  renderSectionsPanel,
      pricing:   renderPricingPanel,
      copy:      renderCopyPanel,
      faq:       renderFaqPanel,
      discounts: renderDiscountsPanel,
      calendar:  renderCalendarPanel,
      bookings:  renderBookingsPanel,
      leads:     renderLeadsPanel
    };
    if (map[name]) map[name]();
  }

  // ── Overview panel ───────────────────────────────────────────
  function renderOverviewPanel() {
    var container = document.getElementById('overview-content');
    container.innerHTML = '<div class="overview-loading">Loading...</div>';

    Promise.all([
      fetch(ADMIN_API + '/bookings', { headers: adminHeaders() }).then(function (r) { return r.json(); }),
      fetch(ADMIN_API + '/leads',    { headers: adminHeaders() }).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var bookings = results[0];
      var leads    = results[1];
      container.innerHTML = buildOverviewHTML(bookings, leads);
    }).catch(function () {
      container.innerHTML = '<div class="overview-loading">Could not load data.</div>';
    });
  }

  function buildOverviewHTML(bookings, leads) {
    var now       = new Date();
    var todayStr  = now.toISOString().split('T')[0];

    // ── Booking stats ────────────────────────────────────────────
    var totalRevenue    = 0;
    var thisMonthRev    = 0;
    var activeNow       = [];
    var upcoming        = [];
    var recentBookings  = bookings.slice(0, 5);

    var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    bookings.forEach(function (b) {
      totalRevenue += b.total || 0;
      if ((b.createdAt || '').startsWith(thisMonth)) thisMonthRev += b.total || 0;
      if (b.startDate <= todayStr && b.endDate >= todayStr) activeNow.push(b);
      if (b.startDate > todayStr) upcoming.push(b);
    });

    // sort upcoming by soonest first
    upcoming.sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });

    // ── Vehicle availability ─────────────────────────────────────
    var vehicles    = cfg.vehicles || {};
    var vKeys       = Object.keys(vehicles);
    var availCount  = vKeys.filter(function (k) { return vehicles[k].available; }).length;

    // ── Leads stats ──────────────────────────────────────────────
    var leadsThisMonth = leads.filter(function (l) {
      return (l.date || '').startsWith(thisMonth);
    }).length;

    // ── Blocked dates ────────────────────────────────────────────
    var blocked        = (cfg.blockedDates || []).filter(function (d) { return d >= todayStr; });

    // ── HTML ─────────────────────────────────────────────────────
    var html = '';

    // Stat cards row
    html += '<div class="ov-cards">';
    html += ovCard('Total Revenue',  '$' + totalRevenue.toLocaleString(), 'All time', 'green');
    html += ovCard('This Month',     '$' + thisMonthRev.toLocaleString(), now.toLocaleString('default', { month: 'long' }), 'orange');
    html += ovCard('Total Bookings', bookings.length,                     'All time', 'blue');
    html += ovCard('Leads',          leads.length,                        leadsThisMonth + ' this month', 'purple');
    html += ovCard('Vehicles',       availCount + ' / ' + vKeys.length,  'Available now', availCount > 0 ? 'green' : 'red');
    html += ovCard('Upcoming',       upcoming.length,                     'Future bookings', 'blue');
    html += '</div>';

    // Row 1: Active + Upcoming side by side
    html += '<div class="ov-grid">';

    html += '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Active Rentals Right Now</h3>';
    if (activeNow.length === 0) {
      html += '<div class="ov-empty">No rentals active today.</div>';
    } else {
      html += '<div class="ov-list">';
      activeNow.forEach(function (b) { html += ovBookingRow(b); });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Upcoming Bookings</h3>';
    if (upcoming.length === 0) {
      html += '<div class="ov-empty">No upcoming bookings yet.</div>';
    } else {
      html += '<div class="ov-list">';
      upcoming.slice(0, 5).forEach(function (b) { html += ovBookingRow(b); });
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // ov-grid

    // Row 2: Recent Bookings + Recent Leads side by side
    html += '<div class="ov-grid">';

    html += '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Recent Bookings</h3>';
    if (recentBookings.length === 0) {
      html += '<div class="ov-empty">No bookings yet — they\'ll appear here after customers check out.</div>';
    } else {
      html += '<div class="ov-list">';
      recentBookings.forEach(function (b) { html += ovBookingRow(b); });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Recent Leads</h3>';
    if (leads.length === 0) {
      html += '<div class="ov-empty">No leads yet.</div>';
    } else {
      html += '<div class="ov-list">';
      leads.slice(0, 5).forEach(function (l) {
        var d = l.date ? new Date(l.date).toLocaleDateString() : '—';
        html += '<div class="ov-row">'
          + '<div class="ov-row-main">' + esc(l.email) + '</div>'
          + '<div class="ov-row-meta">' + esc(l.source || 'Website') + ' &middot; ' + d + '</div>'
          + (l.promoCode ? '<div class="ov-badge ov-badge-promo">' + esc(l.promoCode) + '</div>' : '')
          + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // ov-grid

    return html;
  }

  function ovCard(label, value, sub, color) {
    return '<div class="ov-card ov-card-' + color + '">'
      + '<div class="ov-card-value">' + value + '</div>'
      + '<div class="ov-card-label">' + label + '</div>'
      + '<div class="ov-card-sub">' + sub + '</div>'
      + '</div>';
  }

  function ovBookingRow(b, type) {
    var dateRange = b.startDate + (b.endDate && b.endDate !== b.startDate ? ' → ' + b.endDate : '');
    return '<div class="ov-row">'
      + '<div class="ov-row-main">' + esc(b.name || b.email) + '</div>'
      + '<div class="ov-row-vehicle">' + esc(b.vehicle) + '</div>'
      + '<div class="ov-row-meta">' + dateRange + ' &middot; ' + b.days + 'd</div>'
      + '<div class="ov-badge ov-badge-revenue">$' + (b.total || 0).toLocaleString() + '</div>'
      + '</div>';
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

  // ── Bookings panel ──────────────────────────────────────────
  function renderBookingsPanel() {
    var tbody  = document.getElementById('bookings-tbody');
    var empty  = document.getElementById('bookings-empty');
    var count  = document.getElementById('bookings-count');
    var expBtn = document.getElementById('bookings-export-btn');

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#555">Loading…</td></tr>';
    empty.classList.add('hidden');

    fetch(ADMIN_API + '/bookings', { headers: adminHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (bookings) {
        count.textContent = bookings.length + ' booking' + (bookings.length !== 1 ? 's' : '');

        if (!bookings.length) {
          tbody.innerHTML = '';
          empty.classList.remove('hidden');
          expBtn.disabled = true;
          return;
        }

        expBtn.disabled = false;
        var html = '';
        bookings.forEach(function (b, idx) {
          var d = new Date(b.created_at);
          var statusClass = b.status === 'confirmed' ? 'status-confirmed' : 'status-pending';
          html += '<tr>'
            + '<td class="lead-num">' + (idx + 1) + '</td>'
            + '<td class="lead-email"><strong>' + esc(b.name || '—') + '</strong><br><span style="color:#555;font-size:11px;">' + esc(b.email) + '</span></td>'
            + '<td>' + esc(b.vehicle || '—') + '</td>'
            + '<td>' + esc(b.start_date || '—') + '</td>'
            + '<td>' + esc(b.end_date || '—') + '</td>'
            + '<td style="text-align:center;">' + (b.days || '—') + '</td>'
            + '<td style="color:#4ade80;font-weight:600;">$' + (b.total || 0).toLocaleString() + '</td>'
            + '<td><span class="source-badge ' + statusClass + '">' + esc(b.status || 'confirmed') + '</span></td>'
            + '</tr>';
        });
        tbody.innerHTML = html;

        expBtn.onclick = function () {
          var rows = [['#', 'Name', 'Email', 'Phone', 'Vehicle', 'Pick-up', 'Return', 'Days', 'Total', 'Status', 'Booked On']];
          bookings.forEach(function (b, i) {
            rows.push([
              i + 1, b.name || '', b.email, b.phone || '',
              b.vehicle, b.start_date, b.end_date, b.days,
              '$' + (b.total || 0), b.status,
              new Date(b.created_at).toLocaleString()
            ]);
          });
          var csv = rows.map(function (r) {
            return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
          }).join('\n');
          var blob = new Blob([csv], { type: 'text/csv' });
          var url  = URL.createObjectURL(blob);
          var a    = document.createElement('a');
          a.href = url;
          a.download = 'cjfr-bookings-' + new Date().toISOString().slice(0, 10) + '.csv';
          a.click();
          URL.revokeObjectURL(url);
        };
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#f87171">Failed to load bookings.</td></tr>';
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

    fetch(ADMIN_API + '/leads', { headers: adminHeaders() })
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
          var d = new Date(lead.created_at || lead.date);
          var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          var timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          html += '<tr>'
            + '<td class="lead-num">' + (idx + 1) + '</td>'
            + '<td class="lead-email">' + esc(lead.email) + '</td>'
            + '<td class="lead-source"><span class="source-badge">' + esc(lead.source || 'Website') + '</span></td>'
            + '<td class="lead-date">' + dateStr + ' <span class="lead-time">' + timeStr + '</span></td>'
            + '<td><button class="btn-icon-danger lead-delete-btn" data-id="' + esc(lead.id) + '" title="Delete">✕</button></td>'
            + '</tr>';
        });
        tbody.innerHTML = html;

        // Delete buttons
        tbody.querySelectorAll('.lead-delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            if (!confirm('Remove this lead?')) return;
            fetch(ADMIN_API + '/leads/' + id, { method: 'DELETE', headers: adminHeaders() })
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

  // ── AI Chat Widget ───────────────────────────────────────────
  var CHAT_DEFAULT_CHIPS = [
    'Show me all leads',
    'What are my current prices?',
    'How many vehicles are available?',
    'Show me my discount tiers'
  ];

  function initChat() {
    var widget    = document.getElementById('chat-widget');
    var trigger   = document.getElementById('chat-trigger');
    var iconOpen  = document.getElementById('chat-icon-open');
    var iconClose = document.getElementById('chat-icon-close');
    var messages   = document.getElementById('chat-messages');
    var input      = document.getElementById('chat-input');
    var sendBtn    = document.getElementById('chat-send');
    var fixedChips = document.getElementById('chat-fixed-chips');

    var isOpen    = false;
    var isWaiting = false;

    appendAssistantMessage("Hey! I'm your CJ Assistant. I help you manage your rentals — prices, leads, promos, and more. Just tap a button or tell me what you need!", [
      "What are my current prices?",
      "Show me my leads",
      "I want to change a price"
    ]);
    scrollToBottom();

    // Wire up fixed bottom chips
    fixedChips.querySelectorAll('.chat-fixed-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (isWaiting) return;
        input.value = this.getAttribute('data-prompt');
        sendMessage();
      });
    });

    trigger.addEventListener('click', function () {
      isOpen = !isOpen;
      widget.classList.toggle('open', isOpen);
      iconOpen.classList.toggle('hidden', isOpen);
      iconClose.classList.toggle('hidden', !isOpen);
      if (isOpen) setTimeout(function () { input.focus(); }, 240);
    });

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    function setChipsDisabled(disabled) {
      messages.querySelectorAll('.chat-inline-chip').forEach(function (c) {
        c.disabled = disabled;
      });
      fixedChips.querySelectorAll('.chat-fixed-chip').forEach(function (c) {
        c.disabled = disabled;
      });
    }

    function sendMessage() {
      var text = input.value.trim();
      if (!text || isWaiting) return;

      isWaiting = true;
      sendBtn.disabled = true;
      setChipsDisabled(true);

      appendUserMessage(text);
      input.value = '';
      input.style.height = 'auto';

      var typingEl = appendTyping();
      scrollToBottom();

      fetch(ADMIN_API + '/chat', {
        method:  'POST',
        headers: adminHeaders(),
        body:    JSON.stringify({ message: text })
      })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        removeTyping(typingEl);
        appendAssistantMessage(data.reply || 'Done.', data.suggestions || []);
        scrollToBottom();
      })
      .catch(function () {
        removeTyping(typingEl);
        appendAssistantMessage('Something went wrong. Please try again.', []);
        scrollToBottom();
      })
      .finally(function () {
        isWaiting = false;
        sendBtn.disabled = false;
        setChipsDisabled(false);
        input.focus();
      });
    }

    function appendUserMessage(text) {
      var div = document.createElement('div');
      div.className = 'chat-msg user';
      var bubble = document.createElement('div');
      bubble.className = 'chat-msg-bubble';
      bubble.textContent = text;
      div.appendChild(bubble);
      messages.appendChild(div);
      scrollToBottom();
    }

    function appendAssistantMessage(text, chips) {
      var div = document.createElement('div');
      div.className = 'chat-msg assistant';

      var bubble = document.createElement('div');
      bubble.className = 'chat-msg-bubble';
      // Render line breaks; text is plain (no markdown) so safe to set innerHTML with only \n converted
      bubble.innerHTML = esc(text).replace(/\n/g, '<br>');
      div.appendChild(bubble);

      if (chips && chips.length) {
        var chipsRow = document.createElement('div');
        chipsRow.className = 'chat-inline-chips';
        chips.forEach(function (chipText) {
          var btn = document.createElement('button');
          btn.className = 'chat-inline-chip';
          btn.textContent = chipText;
          btn.addEventListener('click', function () {
            if (isWaiting) return;
            input.value = chipText;
            sendMessage();
          });
          chipsRow.appendChild(btn);
        });
        div.appendChild(chipsRow);
      }

      messages.appendChild(div);
      scrollToBottom();
    }

    function appendTyping() {
      var div = document.createElement('div');
      div.className = 'chat-msg assistant chat-typing';
      div.innerHTML = '<div class="chat-msg-bubble">'
        + '<span class="chat-typing-dot"></span>'
        + '<span class="chat-typing-dot"></span>'
        + '<span class="chat-typing-dot"></span>'
        + '</div>';
      messages.appendChild(div);
      return div;
    }

    function removeTyping(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function scrollToBottom() {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
