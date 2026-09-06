(function () {
  'use strict';

  var ADMIN_API = 'https://yzdtevrwystezhbmgcwn.supabase.co/functions/v1/admin';
  var _token = localStorage.getItem('admin_token') || '';

  function adminHeaders(extra) {
    var h = { 'Content-Type': 'application/json' };
    if (_token) h['Authorization'] = 'Bearer ' + _token;
    return Object.assign(h, extra || {});
  }

  function apiFetch(url, opts) {
    return fetch(url, Object.assign({}, opts || {},
      { headers: adminHeaders((opts || {}).headers) }))
      .then(function(response) {
        // Handle 401 authentication errors professionally
        if (response.status === 401) {
          showToast('error', 'Session Expired', 'Please log in again to continue.');
          setTimeout(function() {
            localStorage.removeItem('admin_token');
            window.location.reload();
          }, 2000);
          throw new Error('Authentication required');
        }
        return response;
      });
  }

  // Toast Notification System (Airbnb/Turo Style)
  var toastContainer = null;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(type, title, message) {
    var container = ensureToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var icons = {
      success: '✓',
      error: '✕',
      warning: '!',
      info: 'i'
    };

    toast.innerHTML = '<div class="toast-icon">' + (icons[type] || 'i') + '</div>' +
      '<div class="toast-content">' +
      '<div class="toast-title">' + title + '</div>' +
      (message ? '<div class="toast-message">' + message + '</div>' : '') +
      '</div>' +
      '<button class="toast-close" aria-label="Close">×</button>';

    container.appendChild(toast);

    var closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', function() {
      removeToast(toast);
    });

    // Auto-remove after 5 seconds
    setTimeout(function() {
      if (toast.parentElement) {
        removeToast(toast);
      }
    }, 5000);
  }

  function removeToast(toast) {
    toast.classList.add('exiting');
    setTimeout(function() {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  // Loading Overlay
  var loadingOverlay = null;

  function showLoading() {
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.appendChild(loadingOverlay);
    }
  }

  function hideLoading() {
    if (loadingOverlay && loadingOverlay.parentElement) {
      loadingOverlay.parentElement.removeChild(loadingOverlay);
      loadingOverlay = null;
    }
  }

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
    bindChangePassword();
    bindSidebarToggle();
    initChat();
  }

  function bindSidebarToggle() {
    var sidebar = document.getElementById('sidebar');
    var btn     = document.getElementById('sidebar-collapse');

    // Deliberate click, not hover. Hover-expand meant the sidebar opened
    // whenever the pointer crossed it on the way somewhere else.
    var collapsed = false;
    try { collapsed = localStorage.getItem('cjfr_admin_sidebar_collapsed') === '1'; } catch (e) {}
    setSidebarCollapsed(collapsed);

    // Each nav item carries its own text as a tooltip for the collapsed rail.
    document.querySelectorAll('#sidebar .nav-link[data-section]').forEach(function (link) {
      var label = (link.textContent || '').trim();
      if (label) link.setAttribute('data-label', label);
    });

    if (btn) {
      btn.addEventListener('click', function () {
        setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
      });
    }
  }

  function setSidebarCollapsed(collapsed) {
    var sidebar = document.getElementById('sidebar');
    var btn     = document.getElementById('sidebar-collapse');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', collapsed);
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      btn.setAttribute('title',      collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    try { localStorage.setItem('cjfr_admin_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }

  // ── Auth ─────────────────────────────────────────────────────
  function checkAuth() {
    if (!_token) return;
    apiFetch(ADMIN_API + '/me')
      .then(function (r) { return r.json(); })
      .then(function (data) { if (data.loggedIn) showAdmin(); })
      .catch(function () {});
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

      fetch(ADMIN_API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pw })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.token) {
            _token = data.token;
            localStorage.setItem('admin_token', _token);
            showAdmin();
          } else {
            showLoginError(data.error || 'Invalid email or password');
            btn.disabled = false;
            btn.textContent = 'Sign In';
          }
        })
        .catch(function () {
          showLoginError('Network error — check your connection.');
          btn.disabled = false;
          btn.textContent = 'Sign In';
        });
    }

    btn.addEventListener('click', doLogin);
    emailIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') pwInput.focus(); });
    pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    // Password visibility toggle
    var pwToggle = document.getElementById('pw-toggle');
    var eyeShow  = document.getElementById('pw-eye-show');
    var eyeHide  = document.getElementById('pw-eye-hide');
    pwToggle.addEventListener('click', function () {
      var showing = pwInput.type === 'text';
      pwInput.type = showing ? 'password' : 'text';
      eyeShow.classList.toggle('hidden', !showing);
      eyeHide.classList.toggle('hidden', showing);
    });

    // Forgot password
    document.getElementById('forgot-link').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('reset-form').classList.remove('hidden');
    });

    document.getElementById('back-to-login').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('reset-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    });

    document.getElementById('reset-btn').addEventListener('click', function () {
      var statusEl = document.getElementById('reset-status');
      statusEl.textContent = 'Contact your administrator to reset your password.';
      statusEl.style.color = 'var(--success)';
      statusEl.classList.remove('hidden');
    });
  }

  function showLoginError(msg) {
    var el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function bindLogoutBtn() {
    document.getElementById('logout-btn').addEventListener('click', function () {
      _token = '';
      localStorage.removeItem('admin_token');
      document.body.className = 'not-logged-in';
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').classList.add('hidden');
      document.getElementById('login-btn').disabled = false;
      document.getElementById('login-btn').textContent = 'Sign In';
    });
  }

  function bindChangePassword() {
    var modal    = document.getElementById('change-pw-modal');
    var errEl    = document.getElementById('cp-error');
    var okEl     = document.getElementById('cp-success');

    document.getElementById('change-pw-link').addEventListener('click', function (e) {
      e.preventDefault();
      errEl.classList.add('hidden');
      okEl.classList.add('hidden');
      document.getElementById('cp-current').value = '';
      document.getElementById('cp-new').value = '';
      document.getElementById('cp-confirm').value = '';
      modal.classList.remove('hidden');
    });

    document.getElementById('cp-cancel').addEventListener('click', function () {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.add('hidden');
    });

    document.getElementById('cp-save').addEventListener('click', function () {
      var current = document.getElementById('cp-current').value;
      var next    = document.getElementById('cp-new').value;
      var confirm = document.getElementById('cp-confirm').value;
      errEl.classList.add('hidden');
      okEl.classList.add('hidden');

      if (!current || !next || !confirm) {
        errEl.textContent = 'All fields are required.';
        return errEl.classList.remove('hidden');
      }
      if (next !== confirm) {
        errEl.textContent = 'New passwords do not match.';
        return errEl.classList.remove('hidden');
      }
      if (next.length < 8) {
        errEl.textContent = 'Password must be at least 8 characters.';
        return errEl.classList.remove('hidden');
      }

      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Updating…';

      apiFetch(ADMIN_API + '/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            okEl.textContent = 'Password updated successfully.';
            okEl.classList.remove('hidden');
            document.getElementById('cp-current').value = '';
            document.getElementById('cp-new').value = '';
            document.getElementById('cp-confirm').value = '';
            setTimeout(function () { modal.classList.add('hidden'); }, 1500);
          } else {
            errEl.textContent = data.error || 'Could not update password.';
            errEl.classList.remove('hidden');
          }
        })
        .catch(function () {
          errEl.textContent = 'Network error.';
          errEl.classList.remove('hidden');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Update Password';
        });
    });
  }

  function showAdmin() {
    // Fetch user info and show name in sidebar
    apiFetch(ADMIN_API + '/me')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var el = document.getElementById('sidebar-user-name');
        if (el && data.name) el.textContent = data.name;
        if (data.name) {
          // /me resolves after the first render, so re-title once it lands.
          adminName = String(data.name).trim().split(/\s+/)[0];
          if (activeSection === 'overview') setPanelTitle('overview');
        }
      });
    loadConfig().then(function () {
      document.body.className = 'logged-in';
      renderPanel(activeSection);
    });
  }

  // ── Config ───────────────────────────────────────────────────
  function loadConfig() {
    return apiFetch(ADMIN_API + '/config')
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
    apiFetch(ADMIN_API + '/config', {
      method: 'POST',
      body:   JSON.stringify(cfg)
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
    bindSetupGroup();
    bindEmptyStateCtas();
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

  // Empty-state buttons reuse the nav path so there is one way to switch panels.
  function bindEmptyStateCtas() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.ov-empty-cta, .ov-card-link');
      if (!btn) return;
      e.preventDefault();

      // Attention rows jump straight to the booking they are about.
      var bookingId = btn.getAttribute('data-booking-goto');
      if (bookingId) return gotoBooking(bookingId);

      var target = btn.getAttribute('data-goto');
      if (!target) return;
      collectFormData();
      activeSection = target;
      updateNavActive(target);
      renderPanel(target);
    });
  }

  // Open the Bookings panel and the detail modal for one booking. The panel
  // fetches its own data, so wait for the row to exist rather than guessing.
  function gotoBooking(bookingId) {
    collectFormData();
    activeSection = 'bookings';
    updateNavActive('bookings');

    // Bookings is paginated, so the target row may not be on the page the
    // panel would open by default. Find which page holds it first, otherwise
    // the wait below would spin against a row that is never drawn.
    apiFetch(ADMIN_API + '/bookings')
      .then(function (r) { return r.json(); })
      .then(function (all) {
        var idx = (all || []).findIndex(function (b) { return b.id === bookingId; });
        if (idx >= 0) listPage.bookings = Math.floor(idx / ROWS_PER_PAGE) + 1;
      })
      .catch(function () { /* fall back to whatever page is current */ })
      .then(function () {
        renderPanel('bookings');
        var tries = 0;
        (function open() {
          var row = document.querySelector('[data-booking-id="' + bookingId + '"]');
          if (row) return row.click();
          if (++tries < 40) setTimeout(open, 100);
        })();
      });
  }

  function updateNavActive(name) {
    document.querySelectorAll('.nav-link[data-section]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-section') === name);
    });
    // If the active panel lives inside Setup, open the group. Otherwise a
    // deep link or a reload would land on a panel whose nav item is hidden,
    // which reads as the sidebar losing your place.
    var group = document.getElementById('nav-setup');
    if (group && group.querySelector('.nav-link[data-section="' + name + '"]')) {
      setSetupOpen(true);
    }
  }

  function setSetupOpen(open) {
    var group  = document.getElementById('nav-setup');
    var toggle = document.getElementById('nav-setup-toggle');
    if (!group || !toggle) return;
    group.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { localStorage.setItem('cjfr_admin_setup_open', open ? '1' : '0'); } catch (e) {}
  }

  function bindSetupGroup() {
    var toggle = document.getElementById('nav-setup-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      setSetupOpen(this.getAttribute('aria-expanded') !== 'true');
    });
    // Remember the choice, so someone who works in Setup all day is not
    // reopening it on every load.
    var remembered = null;
    try { remembered = localStorage.getItem('cjfr_admin_setup_open'); } catch (e) {}
    if (remembered === '1') setSetupOpen(true);
  }

  // ── Panel router ─────────────────────────────────────────────
  var PANEL_TITLES = {
    overview:  'Dashboard',
    sections:  'Show / Hide Sections',
    pricing:   'Pricing & Availability',
    copy:      'Edit Copy',
    faq:       'FAQ',
    emails:    'Email Templates',
    discounts: 'Discounts',
    calendar:  'Calendar',
    bookings:  'Bookings',
    leads:     'Leads',
    tours:     'Tour Requests',
    analytics: 'Analytics'
  };

  var adminName = '';

  // The dashboard greets whoever is signed in. Every other panel keeps its
  // plain label, and the greeting falls back to a bare "Good morning" until
  // /me resolves so the heading never flashes an empty name.
  function setPanelTitle(name) {
    var el = document.getElementById('panel-title');
    if (!el) return;
    if (name === 'overview') {
      el.textContent = greeting() + (adminName ? ', ' + adminName : '');
    } else {
      el.textContent = PANEL_TITLES[name] || '';
    }
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Panels that edit site config are the only ones "Save & Publish" applies to.
  // On a read-only panel the button implies unsaved work that does not exist.
  var SAVEABLE = ['sections','pricing','copy','faq','emails','discounts'];

  function renderPanel(name) {
    document.querySelectorAll('.admin-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    setPanelTitle(name);

    var saveBtn = document.getElementById('save-btn');
    var saveMsg = document.getElementById('save-status');
    if (saveBtn) saveBtn.hidden = SAVEABLE.indexOf(name) === -1;
    if (saveMsg && SAVEABLE.indexOf(name) === -1) saveMsg.textContent = '';

    var map = {
      overview:  renderOverviewPanel,
      sections:  renderSectionsPanel,
      pricing:   renderPricingPanel,
      copy:      renderCopyPanel,
      faq:       renderFaqPanel,
      emails:    renderEmailsPanel,
      discounts: renderDiscountsPanel,
      calendar:  renderCalendarPanel,
      bookings:  renderBookingsPanel,
      leads:     renderLeadsPanel,
      tours:     renderTourRequestsPanel,
      analytics: renderAnalyticsPanel
    };
    if (map[name]) map[name]();
  }

  // ── Notification badges ──────────────────────────────────────
  function updateNotificationBadges(bookings, leads) {
    var now = new Date();
    var todayStr = localDateStr(now);
    var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Count active rentals (happening today)
    var activeCount = bookings.filter(function (b) {
      return b.startDate <= todayStr && b.endDate >= todayStr;
    }).length;

    // Count new leads from last 7 days
    var newLeadsCount = leads.filter(function (l) {
      var leadDate = (l.created_at || l.date || '').split('T')[0];
      return leadDate >= sevenDaysAgo;
    }).length;

    // Update bookings badge
    var bookingsBadge = document.getElementById('bookings-badge');
    if (activeCount > 0) {
      bookingsBadge.textContent = activeCount;
      bookingsBadge.style.display = '';
    } else {
      bookingsBadge.style.display = 'none';
    }

    // Update leads badge
    var leadsBadge = document.getElementById('leads-badge');
    if (newLeadsCount > 0) {
      leadsBadge.textContent = newLeadsCount;
      leadsBadge.style.display = '';
    } else {
      leadsBadge.style.display = 'none';
    }
  }

  // Tour requests still needing action. Unlike leads this is NOT a 7-day
  // window: an unactioned tour request stays outstanding until Chris marks it
  // paid or closed, because it represents a booking nobody has answered yet.
  function updateTourBadge(tours) {
    var badge = document.getElementById('tours-badge');
    if (!badge) return;
    var open = (tours || []).filter(function (t) {
      var s = t.status || 'new';
      return s !== 'paid' && s !== 'closed';
    }).length;
    if (open > 0) {
      badge.textContent = open;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // ── Overview panel ───────────────────────────────────────────
  function renderOverviewPanel() {
    var container = document.getElementById('overview-content');
    container.innerHTML = '<div class="overview-loading">Loading...</div>';

    Promise.all([
      apiFetch(ADMIN_API + '/bookings').then(function (r) { return r.json(); }),
      apiFetch(ADMIN_API + '/leads').then(function (r) { return r.json(); }),
      // Tour requests must not be able to break the overview: this panel
      // predates them, so a failure here degrades to an empty badge.
      apiFetch(ADMIN_API + '/tour-requests').then(function (r) { return r.json(); }).catch(function () { return []; })
    ]).then(function (results) {
      var bookings = results[0];
      var leads    = results[1];
      var tours    = Array.isArray(results[2]) ? results[2] : [];
      updateNotificationBadges(bookings, leads);
      updateTourBadge(tours);
      container.innerHTML = buildOverviewHTML(bookings, leads, tours);
    }).catch(function () {
      container.innerHTML = '<div class="overview-loading">Could not load data.</div>';
    });
  }

  function buildOverviewHTML(bookings, leads, tours) {
    var now       = new Date();
    var todayStr  = localDateStr(now);

    // ── Booking stats ────────────────────────────────────────────
    var totalRevenue    = 0;
    var thisMonthRev    = 0;
    var activeNow       = [];
    var upcoming        = [];

    var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    // Same month last year is meaningless with one season of data, so the
    // comparison is the month just gone. A plain fact, not a trend claim.
    var prev      = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevMonth = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    var prevMonthRev = 0;
    var prevMonthName = prev.toLocaleString('default', { month: 'long' });

    bookings.forEach(function (b) {
      totalRevenue += b.total || 0;
      if ((b.createdAt || '').startsWith(thisMonth)) thisMonthRev += b.total || 0;
      if ((b.createdAt || '').startsWith(prevMonth)) prevMonthRev += b.total || 0;

      // Active rentals: happening today (start <= today AND end >= today)
      if (b.startDate <= todayStr && b.endDate >= todayStr) {
        activeNow.push(b);
      }
      // Upcoming bookings: starts in the future AND hasn't ended yet
      else if (b.startDate > todayStr && b.endDate >= todayStr) {
        upcoming.push(b);
      }
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
    // This month leads, because that is the number Chris actually checks.
    // All time sits underneath it rather than competing as a second hero.
    html += '<div class="ov-cards">';
    html += '<button type="button" class="ov-card ov-card-hero ov-card-link" data-goto="analytics">'
         +    '<div class="ov-card-label">' + now.toLocaleString('default', { month: 'long' }) + ' Revenue</div>'
         +    '<div class="ov-card-value">$' + thisMonthRev.toLocaleString() + '</div>'
         +    '<div class="ov-card-sub">$' + prevMonthRev.toLocaleString() + ' in ' + prevMonthName
         +      ' &middot; $' + totalRevenue.toLocaleString() + ' all time</div>'
         +  '</button>';
    html += ovCard('Total Bookings', bookings.length,                    'All time',
                   null, 'bookings');
    html += ovCard('Upcoming',       upcoming.length,                    'Future bookings',
                   null, 'bookings');
    html += ovCard('Leads',          leads.length,                       leadsThisMonth + ' this month',
                   null, 'leads');
    // Vehicles keeps semantic colour: none available is a real problem.
    html += ovCard('Vehicles',       availCount + ' / ' + vKeys.length, 'Available now',
                   availCount > 0 ? 'green' : 'red', 'pricing');
    html += '</div>';

    // Row 1: Active Rentals (full width, prominent)
    html += buildAttentionHTML(bookings, leads, tours, todayStr);

    // Tint only when a rental is genuinely out. An orange alarm panel over
    // "nothing happening" trained the eye to ignore the colour.
    html += '<div class="ov-section' + (activeNow.length ? ' ov-section-prominent' : '') + '">';
    html += '<h3 class="ov-section-title">Active Rentals Right Now</h3>';
    if (activeNow.length === 0) {
      html += ovEmpty('Nothing out on the road today.',
                      'Blocked Dates', 'calendar', 'Manage availability');
    } else {
      html += '<div class="ov-list">';
      activeNow.forEach(function (b) { html += ovBookingRow(b); });
      html += '</div>';
    }
    html += '</div>';

    // Row 2: Upcoming Bookings (full width)
    html += '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Upcoming Bookings</h3>';
    if (upcoming.length === 0) {
      html += ovEmpty('No upcoming bookings on the books.',
                      'Bookings', 'bookings', 'View all bookings');
    } else {
      html += '<div class="ov-list">';
      upcoming.slice(0, 8).forEach(function (b) { html += ovBookingRow(b); });
      html += '</div>';
    }
    html += '</div>';

    return html;
  }

  // ── Needs your attention ─────────────────────────────────────
  // Deterministic checks over booking workflow state, not predictions: ten
  // bookings is far too little to forecast anything, but these fields are a
  // state machine and money genuinely gets stranded in it.
  //
  // Deliberately NOT flagged:
  //   - post-rental review emails, which a cron sends ~24h after return
  //     (migration 20260408000002_followup_cron), so a "missing" one here
  //     would fire during the window the automation still owns;
  //   - anything older than STALE_DAYS, so early owner test bookings age out.
  var ATTN_STALE_DAYS = 45;
  var OWNER_EMAILS = ['leandertoney@gmail.com', 'chrisjohnson839@gmail.com'];

  function buildAttentionHTML(bookings, leads, tours, todayStr) {
    var items = [];
    var cutoff = shiftDate(todayStr, -ATTN_STALE_DAYS);

    bookings.forEach(function (b) {
      if (OWNER_EMAILS.indexOf((b.email || '').toLowerCase()) !== -1) return;

      var start = b.startDate || b.start_date;
      var end   = b.endDate   || b.end_date;

      // 1. Money sitting in Stripe after the vehicle is back.
      if (b.deposit_cents && !b.deposit_refunded_at && end && end < todayStr && end >= cutoff) {
        items.push({
          urgency: 'high',
          text: '$' + (b.deposit_cents / 100).toFixed(0) + ' deposit still held for '
              + esc(b.name || b.email || 'a customer'),
          meta: 'Returned ' + relativeDays(end, todayStr),
          bookingId: b.id,
          cta: 'Refund deposit'
        });
      }

      // 2. Pre-pickup blockers: no ID on file, or an unverified Can-Am licence.
      if (start && start >= todayStr) {
        if ((b.id_upload_status || 'pending') !== 'received') {
          items.push({
            urgency: 'high',
            text: 'No ID uploaded yet for ' + esc(b.name || b.email || 'a customer'),
            meta: 'Picks up ' + relativeDays(start, todayStr),
            bookingId: b.id,
            cta: 'Open booking'
          });
        }
        if (b.requires_canam_license_check && !b.canam_license_verified) {
          items.push({
            urgency: 'high',
            text: "Can-Am licence not verified for " + esc(b.name || b.email || 'a customer'),
            meta: 'Motorcycle endorsement required. Picks up ' + relativeDays(start, todayStr),
            bookingId: b.id,
            cta: 'Open booking'
          });
        }
      }
    });

    // 3. Tour requests nobody has actioned. Same definition of open as the
    // sidebar badge: anything not yet paid or closed. V1 tour payment is a
    // manual Stripe link, so these sit until a human sends one.
    (tours || []).forEach(function (t) {
      var status = t.status || 'new';
      if (status === 'paid' || status === 'closed') return;
      var when = (t.created_at || '').slice(0, 10);
      var route = TOUR_ROUTES[t.route] || t.route || 'a tour';
      var bits  = [route];
      if (t.group_size) bits.push(t.group_size + ' guests');
      if (t.preferred_date) bits.push(t.preferred_date);
      items.push({
        urgency: 'high',
        text: 'Tour request from ' + esc(t.name || t.email || 'someone'),
        meta: bits.join(' \u00b7 ')
            + (when ? ' \u00b7 asked ' + relativeDays(when, todayStr) : ''),
        section: 'tours',
        cta: 'Open request'
      });
    });

    // 4. Leads who never converted. One row, not one per lead.
    var bookedEmails = {};
    bookings.forEach(function (b) { bookedEmails[(b.email || '').toLowerCase()] = 1; });
    var unconverted = (leads || []).filter(function (l) {
      return !bookedEmails[(l.email || '').toLowerCase()];
    }).length;
    if (unconverted > 0) {
      items.push({
        urgency: 'low',
        text: unconverted + ' lead' + (unconverted === 1 ? '' : 's') + ' never booked',
        meta: 'Signed up for the discount and did not come back',
        section: 'leads',
        cta: 'View leads'
      });
    }

    var order = { high: 0, low: 1 };
    items.sort(function (a, b) { return order[a.urgency] - order[b.urgency]; });

    var html = '<div class="ov-section">';
    html += '<h3 class="ov-section-title">Needs Your Attention</h3>';
    if (!items.length) {
      html += '<div class="ov-empty"><span class="ov-empty-msg">'
           +  'Nothing needs you right now.</span></div>';
    } else {
      html += '<div class="attn-list">';
      items.forEach(function (it) {
        var target = it.bookingId
          ? ' data-booking-goto="' + esc(it.bookingId) + '"'
          : ' data-goto="' + it.section + '"';
        html += '<div class="attn-row attn-' + it.urgency + '">'
             +    '<span class="attn-dot" aria-hidden="true"></span>'
             +    '<div class="attn-body">'
             +      '<div class="attn-text">' + it.text + '</div>'
             +      '<div class="attn-meta">' + esc(it.meta) + '</div>'
             +    '</div>'
             +    '<button type="button" class="ov-empty-cta"' + target + '>'
             +      esc(it.cta) + '</button>'
             +  '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function shiftDate(dateStr, deltaDays) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    return localDateStr(d);
  }

  function relativeDays(dateStr, todayStr) {
    var a = new Date(dateStr  + 'T12:00:00');
    var b = new Date(todayStr + 'T12:00:00');
    var n = Math.round((a - b) / 86400000);
    if (n === 0)  return 'today';
    if (n === 1)  return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? 'in ' + n + ' days' : n * -1 + ' days ago';
  }

  // Local calendar date. toISOString() is UTC, which after ~8pm Eastern
  // rolls the dashboard to tomorrow and makes a rental that ends today
  // look already returned.
  function localDateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-'
         + String(d.getMonth() + 1).padStart(2, '0') + '-'
         + String(d.getDate()).padStart(2, '0');
  }

  function ovEmpty(message, _unused, section, cta) {
    return '<div class="ov-empty">'
      + '<span class="ov-empty-msg">' + esc(message) + '</span>'
      + '<button type="button" class="ov-empty-cta" data-goto="' + section + '">'
      + esc(cta) + '</button>'
      + '</div>';
  }

  function ovCard(label, value, sub, color, goto) {
    var tag  = goto ? 'button' : 'div';
    var attr = goto ? ' type="button" data-goto="' + goto + '"' : '';
    return '<' + tag + ' class="ov-card' + (color ? ' ov-card-' + color : '')
      + (goto ? ' ov-card-link' : '') + '"' + attr + '>'
      + '<div class="ov-card-value">' + value + '</div>'
      + '<div class="ov-card-label">' + label + '</div>'
      + '<div class="ov-card-sub">' + sub + '</div>'
      + '</' + tag + '>';
  }

  function ovBookingRow(b, type) {
    var dateRange = b.startDate + (b.endDate && b.endDate !== b.startDate ? ' → ' + b.endDate : '');
    return '<div class="ov-row">'
      + '<div class="ov-row-main">' + esc(b.name || b.email) + '</div>'
      + '<div class="ov-row-vehicle">' + esc(bookingVehicleName(b)) + '</div>'
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
    // Populate base rate fields from cfg.pricing
    var p = cfg.pricing || {};
    var el;

    el = document.getElementById('admin-hourly-rate');
    if (el) el.value = p.hourlyRate || 30;
    el = document.getElementById('admin-hourly-min');
    if (el) el.value = p.hourlyMin || 3;

    el = document.getElementById('admin-10hr-slingshot');
    if (el) el.value = (p.tenhrRate && p.tenhrRate.slingshot) || 180;
    el = document.getElementById('admin-10hr-canam');
    if (el) el.value = (p.tenhrRate && p.tenhrRate.canam) || 180;

    el = document.getElementById('admin-24hr-slingshot');
    if (el) el.value = (p.dailyRate && p.dailyRate.slingshot) || 250;
    el = document.getElementById('admin-24hr-canam');
    if (el) el.value = (p.dailyRate && p.dailyRate.canam) || 250;

    var del = p.delivery || {};
    el = document.getElementById('admin-delivery-enabled');
    if (el) el.checked = del.enabled !== false;
    el = document.getElementById('admin-delivery-fee');
    if (el) el.value = del.fee || 50;
    el = document.getElementById('admin-delivery-miles');
    if (el) el.value = del.maxMiles || 30;

    // Vehicle availability cards
    var container = document.getElementById('vehicle-cards');
    var html = '';
    Object.keys(cfg.vehicles).forEach(function (key) {
      var v = cfg.vehicles[key];
      var avail = v.available ? 'checked' : '';
      var vtype = v.type || (key.indexOf('canam') !== -1 ? 'canam' : 'slingshot');
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
        +   '<label>Type</label>'
        +   '<span style="font-size:13px;color:var(--text-3);text-transform:capitalize">' + esc(vtype) + '</span>'
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

  // ── Email Templates panel ─────────────────────────────────────
  function renderEmailsPanel() {
    var container = document.getElementById('email-templates-container');
    var templates = cfg.email_templates || {};

    var EMAIL_CONFIGS = [
      {
        key: 'booking_confirmation',
        label: 'Booking Confirmation',
        description: 'Sent immediately after customer completes payment',
        variables: ['firstName', 'vehicleName', 'startDate', 'endDate', 'days', 'daysPlural', 'total', 'savingsLine']
      },
      {
        key: 'owner_alert',
        label: 'Owner Booking Alert',
        description: 'Sent to business owner when new booking is received',
        variables: ['name', 'email', 'phone', 'vehicleName', 'startDate', 'endDate', 'days', 'daysPlural', 'total']
      },
      {
        key: 'welcome',
        label: 'Welcome Email',
        description: 'Sent immediately after booking with preparation tips',
        variables: ['firstName', 'vehicleName', 'startDate', 'endDate']
      },
      {
        key: 'pickup_reminder',
        label: 'Pickup Reminder',
        description: 'Sent 48 hours before rental start time',
        variables: ['firstName', 'vehicleName', 'pickupLocation', 'pickupAddress', 'pickupTime', 'fuelLevel', 'pickupInstructions']
      },
      {
        key: 'return_instructions',
        label: 'Return Instructions',
        description: 'Sent 24 hours before rental end time',
        variables: ['firstName', 'vehicleName', 'returnLocation', 'returnAddress', 'returnTime', 'fuelLevel', 'returnInstructions', 'keyDropInstructions']
      },
      {
        key: 'mid_rental_checkin',
        label: 'Mid-Rental Check-in',
        description: 'Sent on day 2 of multi-day rentals',
        variables: ['firstName', 'vehicleName', 'endDate']
      }
    ];

    var html = '';
    EMAIL_CONFIGS.forEach(function (emailCfg) {
      var tpl = templates[emailCfg.key] || { enabled: true, subject: '', body: '' };
      var checked = tpl.enabled !== false ? 'checked' : '';
      var disabled = tpl.enabled === false ? 'disabled' : '';

      html += '<div class="email-template-card">'
        + '<div class="email-template-header">'
        +   '<div>'
        +     '<h4>' + emailCfg.label + '</h4>'
        +     '<p class="email-template-desc">' + emailCfg.description + '</p>'
        +   '</div>'
        +   '<label class="email-enabled-toggle">'
        +     '<input type="checkbox" class="email-enabled-check" data-key="' + emailCfg.key + '" ' + checked + '>'
        +     '<span>Enabled</span>'
        +   '</label>'
        + '</div>'
        + '<div class="email-template-fields">'
        +   '<div class="email-field">'
        +     '<label>Subject Line</label>'
        +     '<input type="text" class="email-subject-input" data-key="' + emailCfg.key + '" '
        +       'placeholder="Enter email subject..." value="' + esc(tpl.subject || '') + '" ' + disabled + '>'
        +   '</div>'
        +   '<div class="email-field">'
        +     '<label>Email Body</label>'
        +     '<textarea class="email-body-input" data-key="' + emailCfg.key + '" '
        +       'placeholder="Enter email content..." rows="12" ' + disabled + '>' + esc(tpl.body || '') + '</textarea>'
        +   '</div>'
        +   '<div class="email-variables">'
        +     '<strong>Available Variables:</strong> '
        +     emailCfg.variables.map(function (v) { return '<code>{{' + v + '}}</code>'; }).join(' ')
        +   '</div>'
        + '</div>'
        + '</div>';
    });

    container.innerHTML = html;

    // Bind enabled toggles
    container.querySelectorAll('.email-enabled-check').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var key = this.getAttribute('data-key');
        if (!cfg.email_templates[key]) cfg.email_templates[key] = {};
        cfg.email_templates[key].enabled = this.checked;

        // Enable/disable inputs
        var card = this.closest('.email-template-card');
        var subjectInput = card.querySelector('.email-subject-input');
        var bodyInput = card.querySelector('.email-body-input');
        if (this.checked) {
          subjectInput.removeAttribute('disabled');
          bodyInput.removeAttribute('disabled');
        } else {
          subjectInput.setAttribute('disabled', '');
          bodyInput.setAttribute('disabled', '');
        }
      });
    });

    // Bind subject inputs
    container.querySelectorAll('.email-subject-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var key = this.getAttribute('data-key');
        if (!cfg.email_templates[key]) cfg.email_templates[key] = {};
        cfg.email_templates[key].subject = this.value;
      });
    });

    // Bind body textareas
    container.querySelectorAll('.email-body-input').forEach(function (textarea) {
      textarea.addEventListener('input', function () {
        var key = this.getAttribute('data-key');
        if (!cfg.email_templates[key]) cfg.email_templates[key] = {};
        cfg.email_templates[key].body = this.value;
      });
    });
  }

  // ── Multi-Day Tiers panel ─────────────────────────────────────
  function renderDiscountsPanel() {
    // Multi-day tiers are now stored in cfg.pricing.multiDay
    if (!cfg.pricing) cfg.pricing = {};
    if (!cfg.pricing.multiDay) cfg.pricing.multiDay = [];

    var tbody = document.getElementById('discount-rows');
    renderDiscountRows(tbody);
    document.getElementById('add-discount-btn').onclick = function () {
      cfg.pricing.multiDay.push({ minDays: 2, slingshot: 200, canam: 185, label: 'New tier', enabled: true });
      renderDiscountRows(tbody);
    };
  }

  function renderDiscountRows(tbody) {
    var tiers = cfg.pricing.multiDay || [];
    var html = '';
    tiers.forEach(function (d, idx) {
      var en = d.enabled ? 'checked' : '';
      html += '<tr data-idx="' + idx + '">'
        + '<td><input type="number" min="1" max="365" class="d-days" value="' + d.minDays + '"></td>'
        + '<td><div class="rate-input-wrap" style="width:100px"><span>$</span><input type="number" min="1" max="9999" class="d-slingshot" value="' + (d.slingshot || 0) + '"></div></td>'
        + '<td><div class="rate-input-wrap" style="width:100px"><span>$</span><input type="number" min="1" max="9999" class="d-canam" value="' + (d.canam || 0) + '"></div></td>'
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
      row.querySelector('.d-days').addEventListener('input',       function () { cfg.pricing.multiDay[idx].minDays   = parseInt(this.value) || 1; });
      row.querySelector('.d-slingshot').addEventListener('input',  function () { cfg.pricing.multiDay[idx].slingshot = parseInt(this.value) || 0; });
      row.querySelector('.d-canam').addEventListener('input',      function () { cfg.pricing.multiDay[idx].canam     = parseInt(this.value) || 0; });
      row.querySelector('.d-label').addEventListener('input',      function () { cfg.pricing.multiDay[idx].label     = this.value; });
      row.querySelector('.d-enabled').addEventListener('change',   function () { cfg.pricing.multiDay[idx].enabled   = this.checked; });
      row.querySelector('.d-delete').addEventListener('click',     function () {
        cfg.pricing.multiDay.splice(idx, 1);
        renderDiscountRows(tbody);
      });
    });
  }

  // ── Calendar panel ───────────────────────────────────────────
  function renderCalendarPanel() {
    // Initialize per-vehicle blocks section
    renderVehicleBlocksPanel();
    bindCalDisclosures();

    // Bookings drive the money/availability figures in each cell. Render at
    // once so the grid appears immediately, then again when they land.
    renderCalendar();
    renderBlockedList();
    apiFetch(ADMIN_API + '/bookings')
      .then(function (r) { return r.json(); })
      .then(function (rows) { calBookings = Array.isArray(rows) ? rows : []; renderCalendar(); })
      .catch(function () { calBookings = []; });

    var todayBtn = document.getElementById('cal-today');
    if (todayBtn) todayBtn.onclick = function () {
      var n = new Date();
      calYear = n.getFullYear(); calMonth = n.getMonth();
      calWeekStart = startOfWeek(n);
      renderCalendar();
    };
    document.getElementById('cal-prev').onclick = function () { stepCalendar(-1); };
    document.getElementById('cal-next').onclick = function () { stepCalendar(1); };

    document.querySelectorAll('.cal-view-btn').forEach(function (btn) {
      btn.onclick = function () {
        calView = this.getAttribute('data-view');
        document.querySelectorAll('.cal-view-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-view') === calView);
        });
        if (calView === 'week' && !calWeekStart) calWeekStart = startOfWeek(new Date());
        renderCalendar();
      };
    });
  }

  // ── Per-Vehicle Blocking ─────────────────────────────────────────────────
  var vehicleBlocks = [];

  function vehicleDisplayName(v, key) {
    var base = (v && v.name) || key;
    return (v && v.color) ? base + ' — ' + v.color : base;
  }

  // Display name for a BOOKING's vehicle.
  //
  // Two fleet vehicles share the exact display name "2016 Polaris Slingshot"
  // (slingshot_2020 = gray, slingshot_2016_red = red), so the stored
  // booking.vehicle name alone cannot tell them apart. Resolve through
  // vehicle_key, which is the customer's actual selection, and append the
  // color so the owner knows which physical car to hand over.
  //
  // Bookings created before 2026-07-15 have vehicle_key = NULL; those fall
  // back to the stored name unchanged.
  function bookingVehicleName(b) {
    if (!b) return '—';
    var stored = b.vehicle || '';
    var key    = b.vehicle_key;
    if (!key) return stored || '—';
    var v = cfg && cfg.vehicles && cfg.vehicles[key];
    if (!v) return stored || key;
    var base = v.name || stored || key;
    return v.color ? base + ' (' + v.color + ')' : base;
  }

  function renderVehicleBlocksPanel() {
    // Populate vehicle dropdown
    var vehSelect = document.getElementById('vblock-vehicle');
    var html = '<option value="">Select vehicle...</option>';
    Object.keys(cfg.vehicles || {}).forEach(function (key) {
      var v = cfg.vehicles[key];
      html += '<option value="' + key + '">' + vehicleDisplayName(v, key) + '</option>';
    });
    vehSelect.innerHTML = html;

    // Load existing blocks
    loadVehicleBlocks();

    // Bind add button
    document.getElementById('vblock-add-btn').onclick = function () {
      var vehicle = document.getElementById('vblock-vehicle').value;
      var start = document.getElementById('vblock-start').value;
      var end = document.getElementById('vblock-end').value;
      var reason = document.getElementById('vblock-reason').value;

      if (!vehicle || !start || !end) {
        alert('Please select a vehicle and enter start/end dates');
        return;
      }

      if (start > end) {
        alert('End date must be after start date');
        return;
      }

      addVehicleBlock(vehicle, start, end, reason);
    };
  }

  function loadVehicleBlocks() {
    apiFetch(ADMIN_API + '/vehicle-blocks')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        vehicleBlocks = data.blocks || [];
        renderVehicleBlocksList();
      })
      .catch(function (err) {
        console.error('Failed to load vehicle blocks:', err);
      });
  }

  function renderVehicleBlocksList() {
    var container = document.getElementById('vehicle-blocks-list');

    if (!vehicleBlocks.length) {
      container.innerHTML = '<p class="vblock-empty">No per-vehicle blocks yet. Add one above to block a specific vehicle while leaving others bookable.</p>';
      return;
    }

    // Group by vehicle
    var grouped = {};
    vehicleBlocks.forEach(function (block) {
      if (!grouped[block.vehicle_key]) grouped[block.vehicle_key] = [];
      grouped[block.vehicle_key].push(block);
    });

    // Which vehicle a block belongs to must be obvious at ANY scroll position,
    // including on a phone. Two independent mechanisms, deliberately redundant:
    //   1. .vblock-group-header is sticky, so the vehicle name stays pinned
    //      while its rows scroll past.
    //   2. every row also carries .vblock-row-vehicle with the same name, so
    //      the answer is on-screen even if sticky ever stops working.
    var html = '';
    Object.keys(grouped).forEach(function (vkey) {
      var vname = vehicleDisplayName(cfg.vehicles && cfg.vehicles[vkey], vkey);
      var rows  = grouped[vkey];

      html += '<div class="vblock-group">';
      html += '<div class="vblock-group-header">'
        + '<span class="vblock-group-name">' + esc(vname) + '</span>'
        + '<span class="vblock-group-count">' + rows.length + ' block' + (rows.length !== 1 ? 's' : '') + '</span>'
        + '</div>';
      html += '<div class="vblock-rows">';

      rows.forEach(function (block) {
        html += '<div class="vblock-row">';
        html +=   '<div class="vblock-row-main">';
        html +=     '<span class="vblock-row-vehicle">' + esc(vname) + '</span>';
        html +=     '<span class="vblock-row-dates">' + esc(block.start_date)
          + '<span class="vblock-row-sep">to</span>' + esc(block.end_date) + '</span>';
        if (block.reason) {
          html +=   '<span class="vblock-row-reason">' + esc(block.reason) + '</span>';
        }
        html +=   '</div>';
        html +=   '<button class="vblock-delete" data-id="' + esc(block.id) + '">Remove</button>';
        html += '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html;

    // Bind delete buttons
    container.querySelectorAll('.vblock-delete').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-id');
        if (confirm('Remove this block?')) {
          deleteVehicleBlock(id);
        }
      };
    });
  }

  function addVehicleBlock(vehicleKey, startDate, endDate, reason) {
    apiFetch(ADMIN_API + '/vehicle-blocks', {
      method: 'POST',
      body: JSON.stringify({
        vehicle_key: vehicleKey,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        // Clear form
        document.getElementById('vblock-vehicle').value = '';
        document.getElementById('vblock-start').value = '';
        document.getElementById('vblock-end').value = '';
        document.getElementById('vblock-reason').value = '';
        // Reload list
        loadVehicleBlocks();
      } else {
        alert('Failed to add block: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(function (err) {
      alert('Failed to add block: ' + err.message);
    });
  }

  function deleteVehicleBlock(id) {
    apiFetch(ADMIN_API + '/vehicle-blocks/' + id, {
      method: 'DELETE'
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        loadVehicleBlocks();
      } else {
        alert('Failed to delete block: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(function (err) {
      alert('Failed to delete block: ' + err.message);
    });
  }

  function bindCalDisclosures() {
    document.querySelectorAll('.cal-disclosure').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var body = document.getElementById(this.getAttribute('data-target'));
        if (!body) return;
        var open = body.hidden;
        body.hidden = !open;
        this.setAttribute('aria-expanded', open ? 'true' : 'false');
        this.classList.toggle('open', open);
      });
    });
  }

  // Legend plus the one number worth acting on: idle vehicle-days ahead.
  // Nothing here is predicted. Ten bookings cannot support a forecast, so
  // this counts what is genuinely on the books and what is genuinely empty.
  function renderCalLegend() {
    var host = document.getElementById('calendar-legend');
    if (!host) return;

    var todayStr    = localDateStr(new Date());
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var fleetSize   = Object.keys((cfg && cfg.vehicles) || {}).length || 4;
    var idleDays = 0, bookedDays = 0, monthRev = 0, idleWeekend = 0;

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = calYear + '-' + String(calMonth + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      if (ds < todayStr) continue;
      if (cfg && cfg.blockedDates && cfg.blockedDates.indexOf(ds) !== -1) continue;
      var onDay = (calBookings || []).filter(function (b) {
        var st = b.startDate || b.start_date, en = b.endDate || b.end_date;
        return st && en && st <= ds && en >= ds;
      });
      monthRev += onDay.reduce(function (t, b) { return t + (b.total || 0); }, 0);
      if (onDay.length) bookedDays++;
      else {
        idleDays++;
        var dow = new Date(calYear, calMonth, d).getDay();
        if (dow === 0 || dow === 5 || dow === 6) idleWeekend++;
      }
    }

    var html = '<div class="cal-key">'
      + '<span class="cal-key-item"><i class="k-booked"></i>Booked</span>'
      + '<span class="cal-key-item"><i class="k-idle"></i>Open</span>'
      + '<span class="cal-key-item"><i class="k-blocked"></i>Blocked</span>'
      + '<span class="cal-key-item"><i class="k-holiday"></i>Holiday</span>'
      + '</div>';

    if (idleDays > 0) {
      html += '<div class="cal-summary">'
        + '<strong>' + idleDays + '</strong> open day' + (idleDays === 1 ? '' : 's')
        + ' left this month'
        + (idleWeekend ? ', <strong>' + idleWeekend + '</strong> of them Fri to Sun' : '')
        + ' &middot; ' + bookedDays + ' booked &middot; $' + monthRev.toLocaleString() + ' still to come'
        + '</div>';
    }
    host.innerHTML = html;
  }

  // US holidays that plausibly drive rentals. Fixed-date ones plus the
  // floating Monday/Thursday holidays, computed per year rather than listed,
  // so this does not quietly expire.
  function holidaysFor(year) {
    function nthDow(month, dow, n) {           // n-th <dow> of month
      var d = new Date(year, month, 1);
      var count = 0;
      while (d.getMonth() === month) {
        if (d.getDay() === dow && ++count === n) return fmtLocal(d);
        d.setDate(d.getDate() + 1);
      }
      return null;
    }
    function lastDow(month, dow) {
      var d = new Date(year, month + 1, 0);
      while (d.getDay() !== dow) d.setDate(d.getDate() - 1);
      return fmtLocal(d);
    }
    var h = {};
    h[year + '-01-01'] = "New Year's Day";
    h[lastDow(4, 1)]   = 'Memorial Day';
    h[year + '-06-19'] = 'Juneteenth';
    h[year + '-07-04'] = 'Independence Day';
    h[nthDow(8, 1, 1)] = 'Labor Day';
    h[nthDow(9, 1, 2)] = 'Columbus Day';
    h[year + '-11-11'] = 'Veterans Day';
    h[nthDow(10, 4, 4)] = 'Thanksgiving';
    h[year + '-12-25'] = 'Christmas';
    h[year + '-12-31'] = "New Year's Eve";
    return h;
  }

  function fmtLocal(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  // Bookings for the calendar. Cached per panel visit so paging months does
  // not refetch, and a failure degrades to a plain block calendar rather than
  // breaking availability management.
  var calBookings = null;
  var calView     = 'month';   // 'month' | 'week'
  var calWeekStart = null;     // Sunday of the visible week, in week view

  function bookingsOn(dateStr) {
    return (calBookings || []).filter(function (b) {
      var st = b.startDate || b.start_date, en = b.endDate || b.end_date;
      return st && en && st <= dateStr && en >= dateStr;
    });
  }

  function renderCalendar() {
    if (calView === 'week') return renderCalendarWeek();
    return renderCalendarMonth();
  }

  // Seven days across, tall enough to name who has which vehicle. This is the
  // day-to-day operations view: month answers "how full am I", week answers
  // "what is happening and who do I hand keys to".
  function renderCalendarWeek() {
    var DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var start = calWeekStart ? new Date(calWeekStart) : startOfWeek(new Date(calYear, calMonth, 1));
    calWeekStart = new Date(start);

    var end = new Date(start); end.setDate(end.getDate() + 6);
    var fmt = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    document.getElementById('cal-month-label').textContent = fmt(start) + ' \u2013 ' + fmt(end) + ', ' + end.getFullYear();

    var grid = document.getElementById('calendar-grid');
    grid.className = 'calendar-grid calendar-grid-big calendar-grid-week';

    var todayStr = localDateStr(new Date());
    var holidays = holidaysFor(start.getFullYear());
    var fleetSize = Object.keys((cfg && cfg.vehicles) || {}).length || 4;
    var html = '';
    DAY_LABELS.forEach(function (d) { html += '<div class="cal-day-label">' + d + '</div>'; });

    for (var i = 0; i < 7; i++) {
      var cur = new Date(start); cur.setDate(cur.getDate() + i);
      var ds  = localDateStr(cur);
      var cls = 'cal-day';
      if (ds < todayStr) cls += ' past';
      if (ds === todayStr) cls += ' today';
      var blocked = cfg && cfg.blockedDates && cfg.blockedDates.indexOf(ds) !== -1;
      if (blocked) cls += ' blocked';
      var onDay = bookingsOn(ds);
      if (onDay.length) cls += ' has-bookings';
      else if (ds >= todayStr && !blocked) cls += ' idle';
      if (holidays[ds]) cls += ' holiday';

      var body = '<span class="cal-num">' + cur.getDate() + '</span>';
      if (holidays[ds]) body += '<span class="cal-holiday">' + esc(holidays[ds]) + '</span>';
      if (blocked) body += '<span class="cal-out">blocked</span>';
      onDay.forEach(function (b) {
        body += '<button type="button" class="cal-booking" data-booking-goto="' + esc(b.id) + '">'
             +    '<b>' + esc(b.name || b.email || 'Booking') + '</b>'
             +    '<span>' + esc(bookingVehicleName(b)) + '</span>'
             +    '<span>$' + (b.total || 0).toLocaleString()
             +      (b.pickup_time ? ' &middot; ' + esc(b.pickup_time) : '') + '</span>'
             +  '</button>';
      });
      if (!onDay.length && !blocked && ds >= todayStr) {
        body += '<span class="cal-free">' + fleetSize + ' free</span>';
      }
      html += '<div class="' + cls + '" data-date="' + ds + '">' + body + '</div>';
    }

    grid.innerHTML = html;
    renderCalLegend();
    bindCalDayClicks(grid);
  }

  function stepCalendar(dir) {
    if (calView === 'week') {
      var w = calWeekStart ? new Date(calWeekStart) : startOfWeek(new Date());
      w.setDate(w.getDate() + dir * 7);
      calWeekStart = w;
      calYear = w.getFullYear(); calMonth = w.getMonth();
    } else {
      calMonth += dir;
      if (calMonth < 0)  { calMonth = 11; calYear--; }
      if (calMonth > 11) { calMonth = 0;  calYear++; }
    }
    renderCalendar();
  }

  function startOfWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  function renderCalendarMonth() {
    var MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
    var DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    document.getElementById('cal-month-label').textContent = MONTH_NAMES[calMonth] + ' ' + calYear;

    var grid = document.getElementById('calendar-grid');
    grid.className = 'calendar-grid calendar-grid-big';
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

    var holidays   = holidaysFor(calYear);
    var fleetSize  = Object.keys((cfg && cfg.vehicles) || {}).length || 4;

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = calYear + '-'
        + String(calMonth + 1).padStart(2,'0') + '-'
        + String(d).padStart(2,'0');
      var cellDate = new Date(calYear, calMonth, d);
      var classes  = 'cal-day';
      var isPast   = cellDate < today;

      if (isPast) classes += ' past';
      if (cellDate.getTime() === today.getTime()) classes += ' today';
      var isBlocked = cfg && cfg.blockedDates && cfg.blockedDates.indexOf(dateStr) !== -1;
      if (isBlocked) classes += ' blocked';

      // What is actually happening that day.
      var onDay = (calBookings || []).filter(function (b) {
        var st = b.startDate || b.start_date, en = b.endDate || b.end_date;
        return st && en && st <= dateStr && en >= dateStr;
      });
      var revenue = onDay.reduce(function (sum, b) { return sum + (b.total || 0); }, 0);
      var free    = Math.max(0, fleetSize - onDay.length);
      var holiday = holidays[dateStr];

      if (onDay.length) classes += ' has-bookings';
      else if (!isPast && !isBlocked) classes += ' idle';
      if (holiday) classes += ' holiday';

      var body = '<span class="cal-num">' + d + '</span>';
      if (holiday) body += '<span class="cal-holiday" title="' + esc(holiday) + '">' + esc(holiday) + '</span>';
      if (onDay.length) {
        body += '<span class="cal-rev">$' + revenue.toLocaleString() + '</span>';
        body += '<span class="cal-out">' + onDay.length + ' out &middot; ' + free + ' free</span>';
      } else if (!isPast && !isBlocked) {
        body += '<span class="cal-free">' + free + ' free</span>';
      } else if (isBlocked) {
        body += '<span class="cal-out">blocked</span>';
      }

      html += '<div class="' + classes + '" data-date="' + dateStr + '">' + body + '</div>';
    }

    grid.innerHTML = html;
    renderCalLegend();
    bindCalDayClicks(grid);
  }

  // Clicking a day blocks or unblocks the fleet; clicking a booking inside a
  // day opens that booking instead, so the two do not fight each other.
  function bindCalDayClicks(grid) {
    grid.querySelectorAll('.cal-booking[data-booking-goto]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        gotoBooking(this.getAttribute('data-booking-goto'));
      });
    });

    grid.querySelectorAll('.cal-day:not(.empty):not(.past)').forEach(function (cell) {
      cell.addEventListener('click', function () {
        if (!cfg || !cfg.blockedDates) return;
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

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">Loading…</td></tr>';
    empty.classList.add('hidden');

    apiFetch(ADMIN_API + '/bookings')
      .then(function (r) { return r.json(); })
      .then(function (bookings) {
        var pg = paginate('bookings', bookings, renderBookingsPanel);
        count.textContent = pg.countLabel('booking');

        if (!bookings.length) {
          tbody.innerHTML = '';
          empty.classList.remove('hidden');
          expBtn.disabled = true;
          return;
        }

        expBtn.disabled = false;
        var html = '';
        pg.rows.forEach(function (b, i) {
          var idx = pg.offset + i;
          var d = new Date(b.created_at);
          var statusClass = b.status === 'confirmed' ? 'status-confirmed' : 'status-pending';

          // Build delivery badges
          var deliveryBadges = '';
          if (b.delivery_dropoff) {
            deliveryBadges += '<span class="source-badge" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line);margin-left:4px;font-size:10px;">🚚 Delivery</span>';
          }
          if (b.delivery_pickup) {
            deliveryBadges += '<span class="source-badge" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line);margin-left:4px;font-size:10px;">🚚 Pickup</span>';
          }
          // Deposit badge
          if (b.deposit_cents > 0) {
            if (b.deposit_refunded_at) {
              deliveryBadges += '<span class="source-badge" style="background:var(--surface-3);color:var(--text-2);border-color:var(--border-strong);margin-left:4px;font-size:10px;">💵 Deposit refunded</span>';
            } else {
              deliveryBadges += '<span class="source-badge" style="background:var(--success-soft);color:var(--success);border-color:var(--success-line);margin-left:4px;font-size:10px;">💵 Deposit held</span>';
            }
          }
          // Additional driver badge (free, no price impact)
          if (b.additional_driver_name) {
            if (b.driver2_id_upload_status === 'received') {
              deliveryBadges += '<span class="source-badge" style="background:var(--surface-3);color:var(--text-2);border-color:var(--border-strong);margin-left:4px;font-size:10px;">👥 2 drivers</span>';
            } else {
              deliveryBadges += '<span class="source-badge" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line);margin-left:4px;font-size:10px;">👥 2nd driver ID pending</span>';
            }
          }
          // Can-Am manual M-endorsement check badge.
          // Covers BOTH drivers: the warning stays lit until every driver who
          // needs an M-endorsement check has been confirmed, so an unverified
          // second driver cannot be missed from the list view.
          var canamNeeded = b.requires_canam_license_check || b.driver2_requires_canam_license_check;
          if (canamNeeded) {
            var primaryOk = !b.requires_canam_license_check || b.canam_license_verified;
            var secondOk  = !b.driver2_requires_canam_license_check || b.driver2_canam_license_verified;
            if (primaryOk && secondOk) {
              deliveryBadges += '<span class="source-badge" style="background:var(--success-soft);color:var(--success);border-color:var(--success-line);margin-left:4px;font-size:10px;">✓ M verified</span>';
            } else {
              var whoLabel = (!primaryOk && !secondOk) ? 'both drivers'
                           : (!secondOk ? '2nd driver' : '');
              deliveryBadges += '<span class="source-badge" style="background:var(--danger-soft);color:var(--danger);border-color:var(--danger-line);margin-left:4px;font-size:10px;">⚠️ Verify M endorsement'
                + (whoLabel ? ' (' + whoLabel + ')' : '') + '</span>';
            }
          }

          html += '<tr data-booking-id="' + esc(b.id) + '">'
            + '<td class="lead-num">' + (idx + 1) + '</td>'
            + '<td class="lead-email"><strong>' + esc(b.name || '—') + '</strong><br><span style="color:var(--text-3);font-size:11px;">' + esc(b.email) + '</span></td>'
            + '<td>' + esc(bookingVehicleName(b)) + deliveryBadges + '</td>'
            + '<td>' + esc(b.start_date || '—') + '</td>'
            + '<td>' + esc(b.end_date || '—') + '</td>'
            + '<td style="text-align:center;">' + (b.days || '—') + '</td>'
            + '<td style="color:var(--success);font-weight:600;">$' + (b.total || 0).toLocaleString() + '</td>'
            + '<td><span class="source-badge ' + statusClass + '">' + esc(b.status || 'confirmed') + '</span></td>'
            + '</tr>';
        });
        tbody.innerHTML = html;

        // Bind row click handlers to open booking detail modal
        tbody.querySelectorAll('tr').forEach(function (row) {
          row.addEventListener('click', function () {
            var bookingId = this.getAttribute('data-booking-id');
            var booking = bookings.find(function (b) { return b.id === bookingId; });
            if (booking) openBookingDetailModal(booking);
          });
        });

        expBtn.onclick = function () {
          var rows = [['#', 'Name', 'Email', 'Phone', 'Vehicle', 'Pick-up', 'Return', 'Days', 'Total', 'Status', 'Booked On']];
          bookings.forEach(function (b, i) {
            rows.push([
              i + 1, b.name || '', b.email, b.phone || '',
              bookingVehicleName(b), b.start_date, b.end_date, b.days,
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--danger)">Failed to load bookings.</td></tr>';
      });
  }

  // ── Leads panel ─────────────────────────────────────────────
  // 25 rows a page, never infinite scroll: these lists are scanned and acted
  // on, and a row deleted from page 3 must not silently move everything up.
  var ROWS_PER_PAGE = 25;
  var listPage = { leads: 1, bookings: 1, tours: 1 };

  // Slice one page out of a list and render its pager. Returns the rows to
  // draw plus the offset, so row numbering stays continuous across pages.
  // Every list panel re-fetches on page change, so `rerender` is the panel's
  // own render function.
  function paginate(key, rows, rerender) {
    var totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    // A deletion can empty the last page; step back rather than show nothing.
    if (listPage[key] > totalPages) listPage[key] = totalPages;
    var page   = listPage[key];
    var offset = (page - 1) * ROWS_PER_PAGE;

    renderPager(key, page, totalPages, rerender);

    return {
      rows: rows.slice(offset, offset + ROWS_PER_PAGE),
      offset: offset,
      // "Showing 1-25 of 52 leads" once there is more than one page.
      countLabel: function (noun) {
        var plural = noun + (rows.length !== 1 ? 's' : '');
        if (rows.length <= ROWS_PER_PAGE) return rows.length + ' ' + plural;
        return 'Showing ' + (offset + 1) + '-' + Math.min(offset + ROWS_PER_PAGE, rows.length)
             + ' of ' + rows.length + ' ' + plural;
      }
    };
  }

  function renderPager(key, page, totalPages, rerender) {
    var host = document.getElementById(key + '-pager');
    if (!host) return;
    if (totalPages <= 1) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;

    host.innerHTML =
        '<button type="button" class="pager-btn" data-page="' + (page - 1) + '"'
      + (page === 1 ? ' disabled' : '') + '>Previous</button>'
      + '<span class="pager-status">Page ' + page + ' of ' + totalPages + '</span>'
      + '<button type="button" class="pager-btn" data-page="' + (page + 1) + '"'
      + (page === totalPages ? ' disabled' : '') + '>Next</button>';

    host.querySelectorAll('.pager-btn[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (this.disabled) return;
        listPage[key] = parseInt(this.getAttribute('data-page'), 10);
        rerender();
        var panel = document.getElementById('panel-' + (key === 'tours' ? 'tours' : key));
        if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });
  }

  function renderLeadsPanel() {
    var tbody   = document.getElementById('leads-tbody');
    var empty   = document.getElementById('leads-empty');
    var count   = document.getElementById('leads-count');
    var expBtn  = document.getElementById('leads-export-btn');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3)">Loading…</td></tr>';
    empty.classList.add('hidden');

    apiFetch(ADMIN_API + '/leads')
      .then(function (r) { return r.json(); })
      .then(function (leads) {
        var pg = paginate('leads', leads, renderLeadsPanel);
        count.textContent = pg.countLabel('lead');

        if (!leads.length) {
          tbody.innerHTML = '';
          empty.classList.remove('hidden');
          expBtn.disabled = true;
          return;
        }

        expBtn.disabled = false;

        var html = '';
        pg.rows.forEach(function (lead, i) {
          var idx = pg.offset + i;
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
            apiFetch(ADMIN_API + '/leads/' + id, { method: 'DELETE' })
              .then(function (r) { return r.json(); })
              .then(function (data) { if (data.ok) renderLeadsPanel(); });
          });
        });

        // Export CSV
        expBtn.onclick = function () {
          var rows = [['#', 'Email', 'Source', 'Date']];
          leads.forEach(function (l, i) {
            rows.push([i + 1, l.email, l.source || 'Website',
                       new Date(l.created_at || l.date).toLocaleString()]);
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--danger)">Failed to load leads.</td></tr>';
      });
  }

  // ── Tour requests panel ──────────────────────────────────────
  //
  // Read + triage only. Nothing here charges anyone: V1 tour payment is a
  // manual Stripe deposit link Chris sends by hand. Before this panel existed
  // a tour lead lived ONLY in the owner email, so a filtered or deleted email
  // was a silently lost booking.
  var TOUR_ROUTES = {
    'north-east-md':   'North East, MD',
    'gettysburg-york': 'Gettysburg / York'
  };
  var TOUR_STATUSES = ['new', 'confirmed', 'deposit_sent', 'paid', 'closed'];
  var TOUR_STATUS_LABELS = {
    'new': 'New', 'confirmed': 'Confirmed', 'deposit_sent': 'Deposit sent',
    'paid': 'Paid', 'closed': 'Closed'
  };
  // Owner-set tiers, mirrored from /tours. Odd group sizes have no published
  // price, so we show the nearest tier rather than inventing one.
  var TOUR_TIERS = { 2: 450, 4: 700, 6: 900, 8: 1100 };

  function tourQuote(size) {
    var n = Number(size);
    if (TOUR_TIERS[n]) return '$' + TOUR_TIERS[n].toLocaleString();
    var vehicles = Math.ceil(n / 2);
    var nearest = TOUR_TIERS[vehicles * 2] || TOUR_TIERS[8];
    return 'TBC (near $' + nearest.toLocaleString() + ')';
  }

  function renderTourRequestsPanel() {
    var tbody  = document.getElementById('tours-tbody');
    var empty  = document.getElementById('tours-empty');
    var count  = document.getElementById('tours-count');
    var expBtn = document.getElementById('tours-export-btn');

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-3)">Loading…</td></tr>';
    empty.classList.add('hidden');

    apiFetch(ADMIN_API + '/tour-requests')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows)) throw new Error('bad payload');
        var pg = paginate('tours', rows, renderTourRequestsPanel);
        count.textContent = pg.countLabel('request');

        if (!rows.length) {
          tbody.innerHTML = '';
          empty.classList.remove('hidden');
          expBtn.disabled = true;
          return;
        }
        expBtn.disabled = false;

        var html = '';
        pg.rows.forEach(function (t, i) {
          var idx = pg.offset + i;
          var d = new Date(t.created_at);
          var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          var timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          var status = t.status || 'new';

          var opts = TOUR_STATUSES.map(function (v) {
            return '<option value="' + v + '"' + (v === status ? ' selected' : '') + '>'
                 + TOUR_STATUS_LABELS[v] + '</option>';
          }).join('');

          html += '<tr>'
            + '<td class="lead-num">' + (idx + 1) + '</td>'
            + '<td><strong>' + esc(t.name) + '</strong>'
              + (t.notes ? '<br><span class="lead-time">' + esc(t.notes) + '</span>' : '')
            + '</td>'
            + '<td class="lead-email"><a href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a>'
              + '<br><a href="tel:' + esc(t.phone) + '" class="lead-time">' + esc(t.phone) + '</a></td>'
            + '<td>' + esc(TOUR_ROUTES[t.route] || t.route) + '</td>'
            + '<td>' + esc(t.preferred_date || 'Flexible') + '</td>'
            + '<td>' + esc(String(t.group_size)) + '</td>'
            + '<td>' + tourQuote(t.group_size) + '</td>'
            + '<td><select class="tour-status-sel" data-id="' + esc(t.id) + '">' + opts + '</select></td>'
            + '<td class="lead-date">' + dateStr + ' <span class="lead-time">' + timeStr + '</span></td>'
            + '<td><button class="btn-icon-danger tour-delete-btn" data-id="' + esc(t.id) + '" title="Delete">✕</button></td>'
            + '</tr>';
        });
        tbody.innerHTML = html;

        tbody.querySelectorAll('.tour-status-sel').forEach(function (sel) {
          sel.addEventListener('change', function () {
            var id = this.getAttribute('data-id');
            var prev = this.getAttribute('data-prev') || '';
            var next = this.value;
            var el = this;
            apiFetch(ADMIN_API + '/tour-requests/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: next })
            })
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (!data.ok) { alert(data.error || 'Could not update the status.'); if (prev) el.value = prev; }
              })
              .catch(function () { alert('Could not update the status.'); if (prev) el.value = prev; });
          });
          sel.setAttribute('data-prev', sel.value);
        });

        tbody.querySelectorAll('.tour-delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            if (!confirm('Delete this tour request? This cannot be undone.')) return;
            apiFetch(ADMIN_API + '/tour-requests/' + id, { method: 'DELETE' })
              .then(function (r) { return r.json(); })
              .then(function (data) { if (data.ok) renderTourRequestsPanel(); });
          });
        });

        expBtn.onclick = function () {
          var head = [['#','Name','Email','Phone','Route','Preferred date','Group size','Price','Status','Received','Notes']];
          rows.forEach(function (t, i) {
            head.push([
              i + 1, t.name, t.email, t.phone,
              TOUR_ROUTES[t.route] || t.route,
              t.preferred_date || 'Flexible',
              t.group_size, tourQuote(t.group_size),
              TOUR_STATUS_LABELS[t.status || 'new'],
              new Date(t.created_at).toLocaleString(),
              t.notes || ''
            ]);
          });
          var csv = head.map(function (r) {
            return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
          }).join('\n');
          var blob = new Blob([csv], { type: 'text/csv' });
          var url  = URL.createObjectURL(blob);
          var a    = document.createElement('a');
          a.href = url;
          a.download = 'cjfr-tour-requests-' + new Date().toISOString().slice(0,10) + '.csv';
          a.click();
          URL.revokeObjectURL(url);
        };
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--danger)">Failed to load tour requests.</td></tr>';
      });
  }

  // ── Analytics panel ──────────────────────────────────────────
  //
  // Charts are hand-drawn inline SVG rather than a charting library: no
  // external request, no CSP surface, nothing to break when a CDN moves, and
  // it inherits the forced-light admin tokens for free.
  //
  // Everything here comes from OUR OWN records. Visitor counts live in Google
  // Analytics, which cannot be read from the browser, so they are not shown.

  function anMoney(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // Grouped bar + line chart of revenue by month.
  function anRevenueChart(months) {
    if (!months.length) return '<p class="an-empty">No bookings yet.</p>';
    var W = 900, H = 210, padL = 52, padR = 14, padT = 18, padB = 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var max = Math.max.apply(null, months.map(function (m) { return m.revenue; })) || 1;
    // Round the axis up to something readable rather than the raw max.
    var step = Math.pow(10, String(Math.floor(max)).length - 1);
    var top = Math.ceil(max / step) * step || 1;

    var bw = iw / months.length;
    var bars = '', labels = '', grid = '';

    for (var g = 0; g <= 4; g++) {
      var gy = padT + ih - (ih * g / 4);
      var gv = Math.round(top * g / 4);
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy
           + '" stroke="var(--border)" stroke-width="1"/>'
           + '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" '
           + 'font-size="10" fill="var(--text-3)">' + anMoney(gv) + '</text>';
    }

    months.forEach(function (m, i) {
      var h = Math.max(2, (m.revenue / top) * ih);
      var x = padL + i * bw + bw * 0.18;
      var w = bw * 0.64;
      var y = padT + ih - h;
      bars += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
           + '" rx="4" fill="var(--orange-ink)"><title>' + m.label + ': ' + anMoney(m.revenue)
           + ' from ' + m.count + ' booking' + (m.count === 1 ? '' : 's') + '</title></rect>';
      if (m.revenue > 0) {
        bars += '<text x="' + (x + w / 2) + '" y="' + (y - 5) + '" text-anchor="middle" '
             + 'font-size="10" font-weight="600" fill="var(--text-2)">' + anMoney(m.revenue) + '</text>';
      }
      labels += '<text x="' + (padL + i * bw + bw / 2) + '" y="' + (H - 12)
             + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + m.label + '</text>';
    });

    return '<div class="an-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" '
      + 'aria-label="Revenue by month">'
      + grid + bars + labels + '</svg></div>';
  }

  // Horizontal bars, used anywhere a category needs ranking.
  function anBars(rows, fmt) {
    if (!rows.length) return '<p class="an-empty">Nothing to show yet.</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var html = '<div class="an-bars">';
    rows.forEach(function (r) {
      var pct = Math.max(2, (r.value / max) * 100);
      html += '<div class="an-bar-row">'
        + '<span class="an-bar-label" title="' + esc(r.label) + '">' + esc(r.label) + '</span>'
        + '<span class="an-bar-track"><span class="an-bar-fill" style="width:' + pct + '%"></span></span>'
        + '<span class="an-bar-val">' + (fmt ? fmt(r) : r.value) + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  // Daily visitors as a filled sparkline.
  function anSparkline(daily) {
    if (!daily.length) return '';
    var W = 900, H = 70, pad = 5;
    var max = Math.max.apply(null, daily.map(function (d) { return d.value; })) || 1;
    var stepX = (W - pad * 2) / Math.max(1, daily.length - 1);
    var pts = daily.map(function (d, i) {
      var x = pad + i * stepX;
      var y = pad + (H - pad * 2) * (1 - d.value / max);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var area = 'M' + pad + ',' + (H - pad) + ' L' + pts.join(' L')
             + ' L' + (pad + (daily.length - 1) * stepX).toFixed(1) + ',' + (H - pad) + ' Z';
    return '<div class="an-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" '
      + 'aria-label="Visitors per day">'
      + '<path d="' + area + '" fill="var(--orange-ink)" opacity="0.12"/>'
      + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--orange-ink)" '
      + 'stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
      + '</svg></div>';
  }

  function renderAnalyticsPanel() {
    var el = document.getElementById('analytics-content');
    el.innerHTML = '<div class="overview-loading">Loading...</div>';

    // GA lives behind its own function and may not be configured. Its failure
    // must never take down the database charts, which are the reliable half.
    var GA_API = ADMIN_API.replace(/\/admin$/, '') + '/ga-stats';

    Promise.all([
      apiFetch(ADMIN_API + '/bookings').then(function (r) { return r.json(); }),
      apiFetch(ADMIN_API + '/tour-requests').then(function (r) { return r.json(); }).catch(function () { return []; }),
      apiFetch(GA_API + '?days=28').then(function (r) { return r.json(); })
        .catch(function () { return { configured: false, reason: 'Analytics is unavailable right now.' }; })
    ]).then(function (res) {
      var bookings = Array.isArray(res[0]) ? res[0] : [];
      var tours    = Array.isArray(res[1]) ? res[1] : [];
      var ga       = res[2] || { configured: false };

      var confirmed = bookings.filter(function (b) { return (b.status || 'confirmed') === 'confirmed'; });

      // Last 12 months, including empty ones so gaps are visible.
      var now = new Date(), months = [];
      for (var i = 11; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        months.push({
          key: key,
          label: d.toLocaleString('en-US', { month: 'short' }),
          revenue: 0, count: 0
        });
      }
      var byKey = {};
      months.forEach(function (m) { byKey[m.key] = m; });
      confirmed.forEach(function (b) {
        var k = (b.created_at || '').slice(0, 7);
        if (byKey[k]) { byKey[k].revenue += Number(b.total) || 0; byKey[k].count += 1; }
      });

      var totalRev = confirmed.reduce(function (a, b) { return a + (Number(b.total) || 0); }, 0);
      var avg = confirmed.length ? totalRev / confirmed.length : 0;

      // Vehicle performance by revenue.
      var vehAgg = {};
      confirmed.forEach(function (b) {
        var name = bookingVehicleName(b) || 'Unknown';
        if (!vehAgg[name]) vehAgg[name] = { label: name, value: 0, count: 0 };
        vehAgg[name].value += Number(b.total) || 0;
        vehAgg[name].count += 1;
      });
      var vehRows = Object.keys(vehAgg).map(function (k) { return vehAgg[k]; })
        .sort(function (a, b) { return b.value - a.value; });

      // Where bookings came from. Only rows recorded since attribution shipped.
      var srcAgg = {}, attributed = 0;
      confirmed.forEach(function (b) {
        if (!b.attr_source) return;
        attributed++;
        var k = b.attr_source;
        if (!srcAgg[k]) srcAgg[k] = { label: k, value: 0, revenue: 0 };
        srcAgg[k].value += 1;
        srcAgg[k].revenue += Number(b.total) || 0;
      });
      var srcRows = Object.keys(srcAgg).map(function (k) { return srcAgg[k]; })
        .sort(function (a, b) { return b.value - a.value; });

      var paidTours = tours.filter(function (t) { return t.status === 'paid'; });

      // Conversion rate needs BOTH halves: bookings from us, visitors from GA.
      var gaOn = ga && ga.configured;
      var recentBookings = confirmed.filter(function (b) {
        return b.created_at && (Date.now() - new Date(b.created_at).getTime()) < 28 * 86400000;
      }).length;
      var convRate = (gaOn && ga.users > 0)
        ? ((recentBookings / ga.users) * 100).toFixed(1) + '%' : null;

      function stat(value, label, sub, cls) {
        return '<div class="an-stat ' + (cls || '') + '">'
          + '<div class="an-stat-value">' + value + '</div>'
          + '<div class="an-stat-label">' + label + '</div>'
          + '<div class="an-stat-sub">' + (sub || '') + '</div></div>';
      }

      var html = '<div class="an-stats">';
      if (gaOn) {
        html += stat(anMoney(totalRev), 'Revenue', confirmed.length + ' bookings', 'an-stat-green')
              + stat(Number(ga.users).toLocaleString(), 'Visitors', 'Last 28 days')
              // With zero visitors recorded, "3 of 0" reads like a broken stat.
              // Say why the number is missing instead of showing a ratio.
              + stat(convRate || '--', 'Conversion',
                     ga.users > 0 ? recentBookings + ' of ' + Number(ga.users).toLocaleString()
                                  : 'Waiting on visitor data')
              + stat(anMoney(avg), 'Avg booking', 'Per rental');
      } else {
        html += stat(anMoney(totalRev), 'Revenue', confirmed.length + ' bookings', 'an-stat-green')
              + stat(anMoney(avg), 'Avg booking', 'Per rental')
              + stat(tours.length, 'Tour requests', paidTours.length + ' paid')
              + stat(attributed + ' / ' + confirmed.length, 'Attributed', 'Known source');
      }
      html += '</div>';

      html += '<div class="an-grid">';

      // Left column, spanning both rows: the trend that deserves the space.
      html += '<div class="an-card an-card-trend"><h3>Revenue by month</h3>'
        + '<p class="an-sub">Last 12 months. Hover a bar for the booking count.</p>'
        + anRevenueChart(months);
      if (gaOn) {
        html += '<h3 style="margin-top:14px;">Visitors per day</h3>'
             + '<p class="an-sub">Last 28 days, from Google Analytics.</p>'
             + anSparkline(ga.daily || []);
      }
      html += '</div>';

      // Right column, two stacked cards.
      html += '<div class="an-card"><h3>Revenue by vehicle</h3>'
        + '<p class="an-sub">Which of the four earns most.</p>'
        + anBars(vehRows.slice(0, 6), function (r) { return anMoney(r.value) + ' (' + r.count + ')'; })
        + '</div>';

      html += '<div class="an-card"><h3>' + (gaOn ? 'Traffic sources' : 'Where bookings come from') + '</h3>';
      if (gaOn) {
        html += '<p class="an-sub">How people reached the site.</p>'
             + anBars((ga.channels || []).slice(0, 5));
      } else if (srcRows.length) {
        html += '<p class="an-sub">Channel that first brought the customer.</p>'
             + anBars(srcRows, function (r) { return r.value + ' (' + anMoney(r.revenue) + ')'; });
      } else {
        html += '<p class="an-sub">Nothing recorded yet.</p>'
             + '<p class="an-empty">Source tracking started 1 September 2026. Older bookings have '
             + 'no source and it cannot be worked out after the fact.</p>';
      }
      html += '</div>';
      html += '</div>';

      html += '<p class="an-note">Revenue comes from your booking records. '
        + (gaOn ? 'Visitor numbers come from Google Analytics and can lag a few hours.'
                : 'Visitor numbers are not connected yet.') + '</p>';

      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML = '<div class="overview-loading">Could not load analytics.</div>';
    });
  }

  // ── collectFormData ──────────────────────────────────────────
  // Harvests all data-binding inputs back into cfg before save/nav
  function collectFormData() {
    // Collect data-binding fields (vehicles, copy, etc.)
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
        if (!obj[path[i]]) obj[path[i]] = {};
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
    });

    // Collect data-pricing fields into cfg.pricing.
    //
    // ONLY when the Pricing panel is the one being left. These inputs live in
    // static markup, so they exist and are EMPTY from the moment the page
    // loads; renderPricingPanel() is what fills them. Collecting
    // unconditionally meant any nav click, from any panel, read "" and wrote
    // Number("") === 0 over every stored price, and an unrendered checkbox
    // read false. A later Save & Publish then persisted those zeros. That is
    // how hourlyRate, hourlyMin, tenhrRate, dailyRate and the delivery
    // settings were all zeroed in the live config while hourlyCap, hourlyMax
    // and multiDayRate, which have no inputs, survived untouched.
    if (activeSection === 'pricing') {
    if (!cfg.pricing) cfg.pricing = {};
    document.querySelectorAll('[data-pricing]').forEach(function (el) {
      var path = el.getAttribute('data-pricing').split('.');
      var value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'number') {
        value = Number(el.value);
      } else {
        value = el.value;
      }
      var obj = cfg.pricing;
      for (var i = 0; i < path.length - 1; i++) {
        // Replace scalar values with objects to support nested paths
        if (!obj[path[i]] || typeof obj[path[i]] !== 'object') obj[path[i]] = {};
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
    });
    }

    // Also sync ratePerDay on vehicles to the 24hr rate for backward compat
    if (cfg.pricing && cfg.pricing.dailyRate && cfg.vehicles) {
      Object.keys(cfg.vehicles).forEach(function (key) {
        var v = cfg.vehicles[key];
        var type = v.type || (key.indexOf('canam') !== -1 ? 'canam' : 'slingshot');
        v.ratePerDay = cfg.pricing.dailyRate[type] || v.ratePerDay;
      });
    }

    // Multi-day tiers and FAQ manage cfg directly via inline handlers.
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

      apiFetch(ADMIN_API + '/chat', {
        method: 'POST',
        body:   JSON.stringify({ message: text })
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

  // ── Booking Detail Modal ────────────────────────────────────
  var currentBooking = null;

  function openBookingDetailModal(booking) {
    currentBooking = booking;
    var modal = document.getElementById('booking-detail-modal');

    // Populate customer info (read-only)
    document.getElementById('bd-name').textContent = booking.name || '—';
    document.getElementById('bd-email').textContent = booking.email || '—';
    document.getElementById('bd-phone').textContent = booking.phone || '—';
    document.getElementById('bd-vehicle').textContent = bookingVehicleName(booking);
    document.getElementById('bd-dates').textContent = (booking.start_date || '') + ' to ' + (booking.end_date || '');
    document.getElementById('bd-total').textContent = '$' + (booking.total || 0).toLocaleString();

    // Populate editable rental dates
    document.getElementById('bd-start-date').value = booking.start_date || '';
    document.getElementById('bd-end-date').value = booking.end_date || '';

    // Refundable deposit section
    renderDepositSection(booking);

    // Show/hide delivery section
    var deliverySection = document.getElementById('bd-delivery-section');
    var deliveryInfo = document.getElementById('bd-delivery-info');

    if (booking.delivery_dropoff || booking.delivery_pickup) {
      var infoText = '';
      if (booking.delivery_dropoff) {
        infoText += '<div style="margin-bottom:4px;"><strong>Vehicle Delivery:</strong> Customer paid $50 for vehicle delivery</div>';
      }
      if (booking.delivery_pickup) {
        infoText += '<div style="margin-bottom:4px;"><strong>Vehicle Pickup:</strong> Customer paid $50 for vehicle pickup</div>';
      }
      if (booking.delivery_address) {
        infoText += '<div style="margin-top:8px;"><strong>Delivery Address:</strong><br>' + esc(booking.delivery_address) + '</div>';
      }
      deliveryInfo.innerHTML = infoText;
      deliverySection.classList.remove('hidden');
    } else {
      deliverySection.classList.add('hidden');
    }

    // Populate pickup/return fields (editable)
    // Get defaults from site config if available
    var defaults = cfg && cfg.default_pickup_details ? cfg.default_pickup_details : {};

    // Auto-fill with delivery address if delivery was requested and fields are empty
    var pickupAddr = booking.pickup_address || '';
    var returnAddr = booking.return_address || '';

    if (booking.delivery_dropoff && !pickupAddr && booking.delivery_address) {
      pickupAddr = booking.delivery_address;
      document.getElementById('bd-pickup-location').value = booking.pickup_location || 'Customer Location (Delivery)';
    } else {
      document.getElementById('bd-pickup-location').value = booking.pickup_location || defaults.pickup_location || '';
    }

    if (booking.delivery_pickup && !returnAddr && booking.delivery_address) {
      returnAddr = booking.delivery_address;
      document.getElementById('bd-return-location').value = booking.return_location || 'Customer Location (Pickup)';
    } else {
      document.getElementById('bd-return-location').value = booking.return_location || defaults.return_location || '';
    }

    document.getElementById('bd-pickup-address').value = pickupAddr || defaults.pickup_address || '';
    document.getElementById('bd-pickup-time').value = booking.pickup_time || defaults.pickup_time || '';
    document.getElementById('bd-fuel-level').value = booking.fuel_level || defaults.fuel_level || '';
    document.getElementById('bd-pickup-instructions').value = booking.pickup_instructions || defaults.pickup_instructions || '';

    document.getElementById('bd-return-address').value = returnAddr || defaults.return_address || '';
    document.getElementById('bd-return-time').value = booking.return_time || defaults.return_time || '';
    document.getElementById('bd-key-drop').value = booking.key_drop_location || defaults.key_drop_location || '';
    document.getElementById('bd-return-instructions').value = booking.return_instructions || defaults.return_instructions || '';

    // Clear messages
    document.getElementById('bd-error').classList.add('hidden');
    document.getElementById('bd-success').classList.add('hidden');

    // Load uploaded ID + rental agreement (private storage, signed URLs)
    loadBookingIdSection(booking);

    modal.classList.remove('hidden');
  }

  // Fetch and render the uploaded ID images + agreement + Can-Am check state.
  function loadBookingIdSection(booking) {
    var idSection    = document.getElementById('bd-id-section');
    var canamSection = document.getElementById('bd-canam-section');
    var imagesEl     = document.getElementById('bd-id-images');
    var metaEl       = document.getElementById('bd-id-meta');
    var agrMetaEl    = document.getElementById('bd-agreement-meta');
    var agrTextEl    = document.getElementById('bd-agreement-text');
    var canamStatus  = document.getElementById('bd-canam-status');

    var canam2Section = document.getElementById('bd-canam2-section');
    var canam2Status  = document.getElementById('bd-canam2-status');
    var d2Status      = document.getElementById('bd-driver2-status');
    var d2Images      = document.getElementById('bd-driver2-images');
    var d2Form        = document.getElementById('bd-driver2-form');

    // Reset
    idSection.classList.add('hidden');
    canamSection.classList.add('hidden');
    canam2Section.classList.add('hidden');
    imagesEl.innerHTML = '';
    metaEl.textContent = '';
    agrMetaEl.textContent = '';
    agrTextEl.textContent = '';
    canamStatus.textContent = '';
    canam2Status.textContent = '';
    d2Status.textContent = 'Loading…';
    d2Images.innerHTML = '';
    d2Form.style.display = '';
    document.getElementById('bd-driver2-name').value = '';
    document.getElementById('bd-driver2-email').value = '';

    apiFetch(ADMIN_API + '/bookings/' + encodeURIComponent(booking.id) + '/id')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.hasUpload) {
          metaEl.textContent = 'No ID on file for this booking.';
          idSection.classList.remove('hidden');
          d2Status.textContent = 'This booking has no ID record, so an additional driver cannot be attached to it.';
          d2Form.style.display = 'none';
          return;
        }

        idSection.classList.remove('hidden');
        var idTypeLabel = data.requiredIdType === 'drivers_license'
          ? "Driver's license (required for Can-Am)"
          : 'Government photo ID';
        metaEl.textContent = 'On file: ' + idTypeLabel + '. Links expire in 15 minutes.';

        function imgTile(label, url) {
          if (!url) return '<div style="font-size:12px;color:var(--danger);">' + label + ': unavailable</div>';
          return '<div style="text-align:center;">'
            + '<a href="' + esc(url) + '" target="_blank" rel="noopener">'
            + '<img src="' + esc(url) + '" alt="' + esc(label) + '" style="width:200px;height:130px;object-fit:cover;border:1px solid var(--border-strong);border-radius:6px;">'
            + '</a><div style="font-size:11px;color:var(--text-3);margin-top:4px;">' + esc(label) + ' · click to enlarge</div></div>';
        }
        imagesEl.innerHTML = imgTile('Front', data.frontUrl) + imgTile('Back', data.backUrl);

        // Agreement
        if (data.agreedAt) {
          agrMetaEl.textContent = 'Version ' + (data.agreementVersion || '—') +
            ' · accepted ' + new Date(data.agreedAt).toLocaleString();
        }
        agrTextEl.textContent = data.agreementText || '(no text stored)';

        // Can-Am manual check
        if (data.requiresCanamCheck) {
          canamSection.classList.remove('hidden');
          if (data.canamVerified) {
            canamStatus.innerHTML = '<span style="color:var(--success);">✓ M endorsement confirmed'
              + (data.canamVerifiedBy ? ' by ' + esc(data.canamVerifiedBy) : '')
              + (data.canamVerifiedAt ? ' on ' + esc(new Date(data.canamVerifiedAt).toLocaleString()) : '')
              + '</span>';
            document.getElementById('bd-verify-canam').style.display = 'none';
          } else {
            canamStatus.innerHTML = '<span style="color:var(--danger);">Not yet confirmed. Open the license image above, verify the M endorsement, then confirm below.</span>';
            document.getElementById('bd-verify-canam').style.display = '';
          }
        }

        // ── Additional driver (free) ─────────────────────────────────────────
        var d2 = data.additionalDriver;
        if (!d2) {
          d2Status.innerHTML = '<span style="color:var(--text-2);">No additional driver on this booking.</span>';
          d2Form.style.display = '';
        } else {
          var d2TypeLabel = d2.requiredIdType === 'drivers_license'
            ? "Driver's license (required for Can-Am)"
            : 'Government photo ID';

          if (d2.uploadStatus === 'received') {
            d2Status.innerHTML = '<strong>' + esc(d2.name) + '</strong> '
              + '<span style="color:var(--success);">· ID received</span> '
              + '<span style="color:var(--text-3);">· ' + esc(d2TypeLabel) + ' · no charge</span>';
            d2Images.innerHTML = imgTile('Additional driver front', d2.frontUrl)
                               + imgTile('Additional driver back', d2.backUrl);
            d2Form.style.display = 'none';
          } else if (d2.uploadLinkPending) {
            var expTxt = d2.linkExpiresAt ? ' Link expires ' + new Date(d2.linkExpiresAt).toLocaleDateString() + '.' : '';
            d2Status.innerHTML = '<strong>' + esc(d2.name) + '</strong> '
              + '<span style="color:var(--warn);">· waiting on their ID upload.</span> '
              + '<span style="color:var(--text-3);">Upload link sent.' + esc(expTxt)
              + ' Re-send below if they need it again. No charge.</span>';
            d2Form.style.display = '';
          } else {
            d2Status.innerHTML = '<strong>' + esc(d2.name) + '</strong> '
              + '<span style="color:var(--danger);">· no ID on file and no live upload link.</span> '
              + '<span style="color:var(--text-3);">Send a new link below.</span>';
            d2Form.style.display = '';
          }

          // Per-driver Can-Am M-endorsement check for the additional driver
          if (d2.requiresCanamCheck && d2.uploadStatus === 'received') {
            canam2Section.classList.remove('hidden');
            if (d2.canamVerified) {
              canam2Status.innerHTML = '<span style="color:var(--success);">✓ M endorsement confirmed for '
                + esc(d2.name)
                + (d2.canamVerifiedBy ? ' by ' + esc(d2.canamVerifiedBy) : '')
                + (d2.canamVerifiedAt ? ' on ' + esc(new Date(d2.canamVerifiedAt).toLocaleString()) : '')
                + '</span>';
              document.getElementById('bd-verify-canam2').style.display = 'none';
            } else {
              canam2Status.innerHTML = '<span style="color:var(--danger);">Not yet confirmed for '
                + esc(d2.name) + '. Open their license image above, verify the M endorsement, then confirm below.</span>';
              document.getElementById('bd-verify-canam2').style.display = '';
            }
          }
        }
      })
      .catch(function () {
        metaEl.textContent = 'Could not load ID for this booking.';
        idSection.classList.remove('hidden');
        d2Status.textContent = 'Could not load additional-driver details.';
      });
  }

  // Add a second driver to an existing booking and email them an upload link.
  // This is the pickup-counter case: the person who booked is not the person
  // who wants to drive. It is free and never changes the amount paid.
  function addAdditionalDriver() {
    if (!currentBooking) return;
    var nameEl  = document.getElementById('bd-driver2-name');
    var emailEl = document.getElementById('bd-driver2-email');
    var btn     = document.getElementById('bd-add-driver2');
    var name    = (nameEl.value || '').trim();
    var email   = (emailEl.value || '').trim();

    if (!name)  { alert("Enter the additional driver's full name."); return; }
    if (!email) { alert('Enter an email address so we can send them the upload link.'); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    apiFetch(ADMIN_API + '/bookings/' + encodeURIComponent(currentBooking.id) + '/additional-driver', {
      method: 'POST',
      body: JSON.stringify({ name: name, email: email })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok || !r.data.ok) throw new Error(r.data.error || 'Could not add the driver');
        currentBooking.additional_driver_name = r.data.driverName;
        currentBooking.driver2_id_upload_status = 'pending';
        currentBooking.driver2_requires_canam_license_check = !!r.data.requiresCanamCheck;
        btn.disabled = false;
        btn.textContent = 'Send Upload Link';
        if (r.data.emailed) {
          showToast('success', 'Upload link sent', r.data.driverName + ' can now upload their ID from their phone. No charge was added.');
        } else {
          showToast('warning', 'Driver added, email failed', 'The driver was saved but the upload link email did not send. Try Send Upload Link again.');
        }
        loadBookingIdSection(currentBooking);
        try { renderBookingsPanel(); } catch (e) {}
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Send Upload Link';
        alert(err.message || 'Could not add the additional driver. Please try again.');
      });
  }

  function renderDepositSection(booking) {
    var section = document.getElementById('bd-deposit-section');
    var status  = document.getElementById('bd-deposit-status');
    var btn     = document.getElementById('bd-refund-deposit');

    if (!booking.deposit_cents || booking.deposit_cents <= 0) {
      section.classList.add('hidden');
      return;
    }

    var dollars = '$' + (booking.deposit_cents / 100).toLocaleString();
    if (booking.deposit_refunded_at) {
      var when = new Date(booking.deposit_refunded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      status.innerHTML = '<span style="color:var(--success);font-weight:600;">✓ ' + dollars + ' deposit refunded</span> <span style="color:var(--text-3);">on ' + when + (booking.deposit_refunded_by ? ' by ' + esc(booking.deposit_refunded_by) : '') + '</span>';
      btn.style.display = 'none';
    } else {
      status.innerHTML = '<span style="font-weight:600;">' + dollars + ' deposit held.</span> <span style="color:var(--text-2);">Refund it once the vehicle is back and checked over.</span>';
      btn.style.display = '';
      btn.disabled = false;
      btn.textContent = '✓ Vehicle returned — refund deposit';
    }
    section.classList.remove('hidden');
  }

  function refundDeposit() {
    if (!currentBooking) return;
    var dollars = '$' + ((currentBooking.deposit_cents || 0) / 100).toLocaleString();
    if (!confirm('Refund the ' + dollars + ' deposit to ' + (currentBooking.name || currentBooking.email) + '? This sends the money back to their card and cannot be undone.')) return;

    var btn = document.getElementById('bd-refund-deposit');
    btn.disabled = true;
    btn.textContent = 'Refunding…';

    apiFetch(ADMIN_API + '/bookings/' + encodeURIComponent(currentBooking.id) + '/refund-deposit', { method: 'POST' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok || !r.data.ok) throw new Error(r.data.error || 'Refund failed');
        currentBooking.deposit_refunded_at = r.data.refundedAt;
        renderDepositSection(currentBooking);
        showToast('success', 'Deposit refunded', dollars + ' is on its way back to the customer’s card.');
        try { renderBookingsPanel(); } catch (e) {}
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = '✓ Vehicle returned — refund deposit';
        alert(err.message || 'Could not refund the deposit. Please try again.');
      });
  }

  // Each driver is confirmed separately. `which` is 'primary' or 'additional'.
  function verifyCanamEndorsement(which) {
    if (!currentBooking) return;
    var isSecond = which === 'additional';
    var btnId    = isSecond ? 'bd-verify-canam2' : 'bd-verify-canam';
    var label    = isSecond
      ? "✓ I confirmed the additional driver's M endorsement"
      : '✓ I confirmed the M endorsement';
    var btn = document.getElementById(btnId);
    btn.disabled = true;
    btn.textContent = 'Saving…';
    apiFetch(ADMIN_API + '/bookings/' + encodeURIComponent(currentBooking.id) + '/verify-canam', {
      method: 'POST',
      body: JSON.stringify({ driver: isSecond ? 'additional' : 'primary' })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then(function () {
        if (isSecond) {
          currentBooking.driver2_canam_license_verified = true;
        } else {
          currentBooking.canam_license_verified = true;
        }
        loadBookingIdSection(currentBooking);
        try { renderBookingsPanel(); } catch (e) {}
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = label;
        alert('Could not save the confirmation. Please try again.');
      });
  }

  function closeBookingDetailModal() {
    document.getElementById('booking-detail-modal').classList.add('hidden');
    currentBooking = null;
  }

  function saveBookingDetails() {
    if (!currentBooking) return;

    // Date changes go through the dedicated Reschedule button (which runs the
    // availability + price-guardrail flow) — this Save button only handles
    // pickup/return details, so it never sends start_date/end_date.
    var data = {
      id: currentBooking.id,
      pickup_location: document.getElementById('bd-pickup-location').value.trim(),
      pickup_address: document.getElementById('bd-pickup-address').value.trim(),
      pickup_time: document.getElementById('bd-pickup-time').value.trim(),
      fuel_level: document.getElementById('bd-fuel-level').value.trim(),
      pickup_instructions: document.getElementById('bd-pickup-instructions').value.trim(),
      return_location: document.getElementById('bd-return-location').value.trim(),
      return_address: document.getElementById('bd-return-address').value.trim(),
      return_time: document.getElementById('bd-return-time').value.trim(),
      key_drop_location: document.getElementById('bd-key-drop').value.trim(),
      return_instructions: document.getElementById('bd-return-instructions').value.trim()
    };

    var errorEl = document.getElementById('bd-error');
    var successEl = document.getElementById('bd-success');

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    apiFetch(ADMIN_API + '/bookings/' + currentBooking.id, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || 'Failed to save');
          return body;
        });
      })
      .then(function (body) {
        successEl.textContent = '✓ Details saved successfully!';
        successEl.classList.remove('hidden');

        // Update currentBooking object with new data
        Object.keys(data).forEach(function (key) {
          if (key !== 'id') currentBooking[key] = data[key];
        });
        try { renderBookingsPanel(); } catch (e) {}

        setTimeout(closeBookingDetailModal, 2200);
      })
      .catch(function (err) {
        errorEl.textContent = 'Error: ' + err.message;
        errorEl.classList.remove('hidden');
      });
  }

  // ── Reschedule (dedicated one-click date-change action) ────────────────
  function rescheduleBooking(confirmPriceChange) {
    if (!currentBooking) return;

    var msgEl = document.getElementById('bd-reschedule-msg');
    var btn = document.getElementById('bd-reschedule');
    var startDate = document.getElementById('bd-start-date').value;
    var endDate = document.getElementById('bd-end-date').value;

    if (!startDate || !endDate) {
      msgEl.style.color = 'var(--danger)';
      msgEl.textContent = 'Pick both a start and end date first.';
      return;
    }

    var payload = { start_date: startDate, end_date: endDate };
    if (confirmPriceChange) payload.confirmPriceChange = true;

    btn.disabled = true;
    btn.textContent = 'Checking…';
    msgEl.style.color = 'var(--text-3)';
    msgEl.textContent = '';

    apiFetch(ADMIN_API + '/bookings/' + currentBooking.id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, body: body };
        });
      })
      .then(function (res) {
        btn.disabled = false;
        btn.textContent = 'Reschedule';

        if (!res.ok) {
          if (res.body && res.body.warning === 'price_mismatch') {
            var proceed = confirm(res.body.error + '\n\nProceed anyway without changing the amount charged?');
            if (proceed) {
              rescheduleBooking(true);
              return;
            }
            msgEl.style.color = 'var(--warn)';
            msgEl.textContent = 'Reschedule cancelled — price mismatch not confirmed.';
            return;
          }
          throw new Error((res.body && res.body.error) || 'Failed to reschedule');
        }

        currentBooking.start_date = startDate;
        currentBooking.end_date = endDate;
        currentBooking.days = res.body.booking ? res.body.booking.days : currentBooking.days;
        document.getElementById('bd-dates').textContent = startDate + ' to ' + endDate;

        msgEl.style.color = 'var(--success)';
        msgEl.textContent = '✓ Rescheduled to ' + startDate + (endDate !== startDate ? ' → ' + endDate : '') + '. Old date freed, new date blocked, reminder emails re-anchored.';

        try { renderBookingsPanel(); } catch (e) {}
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Reschedule';
        msgEl.style.color = 'var(--danger)';
        msgEl.textContent = 'Error: ' + err.message;
      });
  }

  document.getElementById('bd-reschedule').addEventListener('click', function () {
    rescheduleBooking(false);
  });

  // Bind modal event listeners
  document.getElementById('bd-close-x').addEventListener('click', closeBookingDetailModal);
  document.getElementById('bd-cancel').addEventListener('click', closeBookingDetailModal);
  document.getElementById('bd-save').addEventListener('click', saveBookingDetails);
  document.getElementById('bd-verify-canam').addEventListener('click', function () { verifyCanamEndorsement('primary'); });
  document.getElementById('bd-verify-canam2').addEventListener('click', function () { verifyCanamEndorsement('additional'); });
  document.getElementById('bd-add-driver2').addEventListener('click', addAdditionalDriver);
  document.getElementById('bd-refund-deposit').addEventListener('click', refundDeposit);
  document.getElementById('booking-detail-modal').addEventListener('click', function (e) {
    if (e.target === this) closeBookingDetailModal();
  });

  // Mobile menu toggle functionality
  function initMobileSidebar() {
    var toggle = document.getElementById('mobile-menu-toggle');
    var sidebar = document.getElementById('sidebar');
    var adminMain = document.getElementById('admin-main');

    if (!toggle || !sidebar) return;

    // Toggle sidebar on button click
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
      if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

    // Close sidebar when clicking a menu item
    var sidebarLinks = sidebar.querySelectorAll('a, button');
    sidebarLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('mobile-open');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    initMobileSidebar();
  });
}());
