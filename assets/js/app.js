/* =========================================================
   WATTRIX — shared app core
   Loader, nav, scroll reveal, toasts, modals, cookie consent,
   service worker registration. No dependencies.
   =======================================================*/
(function () {
  'use strict';

  var CONFIG = {
    gaId: 'G-WPLMYR2M1F',
    adsClient: 'ca-pub-2697517525197581',
    adsEnabled: false,           // no ad slots on the site yet
    consentKey: 'wattrix.consent.v3',
    consentMaxAgeDays: 180
  };

  var W = window.Wattrix = window.Wattrix || {};
  W.config = CONFIG;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  W.reduceMotion = reduceMotion;

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function on(node, ev, fn, opts) { if (node) node.addEventListener(ev, fn, opts); }
  W.$ = $; W.$$ = $$; W.el = el;

  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    cookie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="15" r="1" fill="currentColor"/><circle cx="15.5" cy="9" r="1" fill="currentColor"/></svg>'
  };
  W.ICON = ICON;

  /* ---------- toast ---------- */
  var toastWrap = null;
  W.toast = function (msg, type, ms) {
    if (!toastWrap) {
      toastWrap = el('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastWrap);
    }
    var icon = type === 'err' ? ICON.err : type === 'warn' ? ICON.warn : ICON.check;
    var t = el('div', { class: 'toast' + (type ? ' ' + type : '') }, icon + '<span></span>');
    t.querySelector('span').textContent = msg;
    toastWrap.appendChild(t);
    var life = ms || 2800;
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, life);
    return t;
  };

  /* ---------- modal ---------- */
  var openModals = [];
  W.modal = function (opts) {
    var backdrop = el('div', { class: 'modal-backdrop' });
    var box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' });
    var head = el('div', { class: 'modal-head' });
    head.appendChild(el('h3', { text: opts.title || '' }));
    var close = el('button', { class: 'modal-close', type: 'button', 'aria-label': 'Close dialog' }, '&times;');
    head.appendChild(close);
    box.appendChild(head);

    var body = el('div', { class: 'modal-body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    if (opts.footer) {
      var foot = el('div', { class: 'modal-foot' });
      if (typeof opts.footer === 'string') foot.innerHTML = opts.footer;
      else foot.appendChild(opts.footer);
      box.appendChild(foot);
    }

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    var prevFocus = document.activeElement;
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { backdrop.classList.add('show'); });

    function destroy() {
      backdrop.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        openModals = openModals.filter(function (m) { return m !== api; });
        if (!openModals.length) document.body.style.overflow = prevOverflow;
        if (prevFocus && prevFocus.focus) prevFocus.focus();
      }, 300);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); destroy(); }
      if (e.key === 'Tab') {
        var f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', box)
          .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    on(close, 'click', destroy);
    on(backdrop, 'mousedown', function (e) { if (e.target === backdrop) destroy(); });
    document.addEventListener('keydown', onKey);
    setTimeout(function () {
      var first = $('input,button:not(.modal-close),select', box);
      (first || close).focus();
    }, 60);

    var api = { close: destroy, root: box, body: body };
    openModals.push(api);
    return api;
  };

  /* ---------- loader ---------- */
  function hideLoader() {
    var l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('hidden');
    setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 600);
  }
  // Never block the page: hide on load, plus a hard safety timeout.
  if (document.readyState === 'complete') setTimeout(hideLoader, 120);
  else on(window, 'load', function () { setTimeout(hideLoader, 180); });
  setTimeout(hideLoader, 2600);

  /* ---------- nav ---------- */
  function initNav() {
    var nav = $('.nav');
    var wrapper = $('.nav-wrapper');
    if (!nav) return;

    var toggle = $('.nav-toggle', nav);
    if (!toggle) {
      toggle = el('button', { class: 'nav-toggle', type: 'button', 'aria-label': 'Toggle menu', 'aria-expanded': 'false' },
        '<span></span><span></span><span></span>');
      var brand = $('.brand', nav);
      if (brand && brand.nextSibling) nav.insertBefore(toggle, brand.nextSibling);
      else nav.appendChild(toggle);
    }
    on(toggle, 'click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav-links a, .nav-cta a', nav).forEach(function (a) {
      on(a, 'click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    on(document, 'click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape') nav.classList.remove('is-open');
    });

    // mark active link from the current path
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav-links a', nav).forEach(function (a) {
      var target = (a.getAttribute('href') || '').split('#')[0].split('/').pop();
      if (target && target === here) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
      else a.classList.remove('active');
    });

    if (wrapper) {
      var tick = false;
      function onScroll() {
        if (tick) return;
        tick = true;
        requestAnimationFrame(function () {
          wrapper.classList.toggle('scrolled', window.scrollY > 24);
          tick = false;
        });
      }
      on(window, 'scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    var nodes = $$('[data-reveal]');
    if (!nodes.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    // stagger siblings inside a shared parent
    var groups = {};
    nodes.forEach(function (n) {
      var key = n.parentNode ? (n.parentNode.dataset.revealGroup || '') : '';
      if (!n.style.getPropertyValue('--rd')) {
        var p = n.parentNode;
        if (p && p.hasAttribute && p.hasAttribute('data-stagger')) {
          groups[key] = groups[key] || new Map();
          var arr = Array.prototype.filter.call(p.children, function (c) { return c.hasAttribute('data-reveal'); });
          var i = arr.indexOf(n);
          if (i > -1) n.style.setProperty('--rd', (i * 80) + 'ms');
        }
      }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- pointer glow on cards ---------- */
  function initSpotlight() {
    if (reduceMotion) return;
    if (window.matchMedia('(hover: none)').matches) return;
    $$('.card.spot').forEach(function (c) {
      on(c, 'pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- button ripple ---------- */
  function initRipple() {
    if (reduceMotion) return;
    on(document, 'pointerdown', function (e) {
      var btn = e.target.closest && e.target.closest('.btn');
      if (!btn || btn.disabled) return;
      var r = btn.getBoundingClientRect();
      var size = Math.max(r.width, r.height);
      var d = el('span', { class: 'ripple' });
      d.style.width = d.style.height = size + 'px';
      d.style.left = (e.clientX - r.left - size / 2) + 'px';
      d.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 620);
    });
  }

  /* ---------- count-up numbers ---------- */
  // Stop any in-flight count-up so a later write is not overwritten
  // mid-animation (switching modes used to leave a stale value on screen).
  W.stopCount = function (node) {
    if (node && node._raf) { cancelAnimationFrame(node._raf); node._raf = null; }
  };

  W.countUp = function (node, to, opts) {
    opts = opts || {};
    W.stopCount(node);
    var dec = opts.decimals != null ? opts.decimals : 0;
    var pre = opts.prefix || '', suf = opts.suffix || '';
    var from = parseFloat(node.dataset.cv || '0');
    if (!isFinite(from)) from = 0;
    if (!isFinite(to)) to = 0;
    node.dataset.cv = String(to);
    if (reduceMotion || Math.abs(to - from) < 0.005) {
      node.textContent = pre + to.toFixed(dec) + suf;
      return;
    }
    var dur = opts.duration || 480, t0 = performance.now();
    function frame(t) {
      var p = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = pre + (from + (to - from) * e).toFixed(dec) + suf;
      if (p < 1) node._raf = requestAnimationFrame(frame);
      else node._raf = null;
    }
    node._raf = requestAnimationFrame(frame);
  };

  /* =========================================================
     COOKIE CONSENT
     Banner + preferences modal are injected here so every page
     gets identical, always-working markup.
     ========================================================= */
  var Consent = (function () {
    var CATS = [
      { id: 'necessary', name: 'Strictly necessary', desc: 'Keeps the site working: your saved calculator inputs, unit choices and this consent record. Cannot be turned off.', locked: true },
      { id: 'analytics', name: 'Analytics', desc: 'Anonymous, aggregated page-view stats (Google Analytics 4) so we know which tools people actually use. IP anonymised.', locked: false },
      { id: 'marketing', name: 'Advertising', desc: 'Ad measurement and personalisation. Off by default and currently unused - no ad units run on this site.', locked: false }
    ];

    var state = null, banner = null, shownAt = 0;

    function read() {
      try {
        var raw = localStorage.getItem(CONFIG.consentKey);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o || o.v !== 3) return null;
        var age = (Date.now() - new Date(o.ts).getTime()) / 86400000;
        if (!isFinite(age) || age > CONFIG.consentMaxAgeDays) return null;  // expire, re-ask
        return o;
      } catch (e) { return null; }
    }

    function write(o) {
      state = {
        v: 3, ts: new Date().toISOString(),
        necessary: true,
        analytics: !!o.analytics,
        marketing: !!o.marketing
      };
      try { localStorage.setItem(CONFIG.consentKey, JSON.stringify(state)); } catch (e) { }
      apply(state);
      document.dispatchEvent(new CustomEvent('wattrix:consent', { detail: state }));
      return state;
    }

    function gtagStub() {
      window.dataLayer = window.dataLayer || [];
      if (!window.gtag) window.gtag = function () { window.dataLayer.push(arguments); };
    }

    function signals(c) {
      return {
        ad_storage: c.marketing ? 'granted' : 'denied',
        ad_user_data: c.marketing ? 'granted' : 'denied',
        ad_personalization: c.marketing ? 'granted' : 'denied',
        analytics_storage: c.analytics ? 'granted' : 'denied',
        functionality_storage: 'granted',
        personalization_storage: 'denied',
        security_storage: 'granted'
      };
    }

    function loadGA() {
      if (window.__wxGaLoaded) return;
      window.__wxGaLoaded = true;
      gtagStub();
      window.gtag('js', new Date());
      window.gtag('config', CONFIG.gaId, { anonymize_ip: true });
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.gaId);
      document.head.appendChild(s);
    }

    function loadAds() {
      if (!CONFIG.adsEnabled || window.__wxAdsLoaded) return;
      window.__wxAdsLoaded = true;
      var s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CONFIG.adsClient);
      document.head.appendChild(s);
    }

    // Drop analytics cookies when consent is withdrawn.
    function clearAnalyticsCookies() {
      var host = location.hostname;
      var domains = ['', host, '.' + host];
      var parts = host.split('.');
      if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (!/^(_ga|_gid|_gat|_gac)/.test(name)) return;
        domains.forEach(function (d) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
        });
      });
    }

    function apply(c) {
      gtagStub();
      window.gtag('consent', 'update', signals(c));
      if (c.analytics) loadGA(); else clearAnalyticsCookies();
      if (c.marketing) loadAds();
    }

    /* --- banner --- */
    function buildBanner() {
      if (banner) return banner;
      banner = el('div', {
        class: 'cookie-banner', id: 'cookieBanner', role: 'dialog',
        'aria-live': 'polite', 'aria-label': 'Cookie consent'
      });
      banner.hidden = true;
      banner.innerHTML =
        '<div class="cb-title">' + ICON.cookie + '<span>Your privacy, your call</span></div>' +
        '<p>The calculator itself needs no cookies - every number is worked out in your browser. ' +
        'We would like optional analytics to see which tools get used. Nothing is shared or sold. ' +
        '<a href="about.html#privacy">Read the details</a>.</p>' +
        '<div class="cookie-actions">' +
        '<button type="button" class="btn sm" data-cc="prefs">Customise</button>' +
        '<button type="button" class="btn sm" data-cc="reject">Reject optional</button>' +
        '<button type="button" class="btn sm brand" data-cc="accept">Accept all</button>' +
        '</div>';
      document.body.appendChild(banner);

      banner.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cc]');
        if (!b) return;
        var act = b.dataset.cc;
        if (act === 'accept') { write({ analytics: true, marketing: true }); hideBanner(); W.toast('All cookies accepted'); }
        else if (act === 'reject') { write({ analytics: false, marketing: false }); hideBanner(); W.toast('Optional cookies rejected'); }
        else if (act === 'prefs') { openPrefs(); }
      });
      // Esc = reject optional (never a dark pattern: closing must not consent)
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && banner && !banner.hidden && !openModals.length) {
          write({ analytics: false, marketing: false });
          hideBanner();
        }
      });
      return banner;
    }

    function showBanner() {
      buildBanner();
      banner.hidden = false;
      shownAt = Date.now();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { banner.classList.add('show'); });
      });
    }

    function hideBanner() {
      if (!banner) return;
      banner.classList.remove('show');
      setTimeout(function () { if (banner) banner.hidden = true; }, 450);
    }

    /* --- preferences modal --- */
    function openPrefs() {
      var current = state || { necessary: true, analytics: false, marketing: false };
      var wrap = el('div');
      wrap.appendChild(el('p', { class: 'small muted mb-3' },
        'Choose what Wattrix may store. Your choice is saved on this device and can be changed any time from the footer.'));

      CATS.forEach(function (cat) {
        var row = el('div', { class: 'switch' });
        row.innerHTML =
          '<div class="sw-txt"><strong></strong><span></span></div>' +
          '<button type="button" class="toggle" role="switch" data-cat="' + cat.id + '"></button>';
        row.querySelector('strong').textContent = cat.name + (cat.locked ? ' (always on)' : '');
        row.querySelector('span').textContent = cat.desc;
        var tg = row.querySelector('.toggle');
        var val = cat.locked ? true : !!current[cat.id];
        tg.setAttribute('aria-checked', val ? 'true' : 'false');
        tg.setAttribute('aria-label', cat.name);
        if (cat.locked) tg.disabled = true;
        else on(tg, 'click', function () {
          var now = tg.getAttribute('aria-checked') === 'true';
          tg.setAttribute('aria-checked', now ? 'false' : 'true');
        });
        wrap.appendChild(row);
      });

      var foot = el('div');
      foot.innerHTML =
        '<button type="button" class="btn" data-p="reject">Reject optional</button>' +
        '<button type="button" class="btn" data-p="save">Save choices</button>' +
        '<button type="button" class="btn brand" data-p="accept">Accept all</button>';

      var m = W.modal({ title: 'Cookie preferences', body: wrap, footer: foot });

      m.root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-p]');
        if (!b) return;
        var act = b.dataset.p, next;
        if (act === 'accept') next = { analytics: true, marketing: true };
        else if (act === 'reject') next = { analytics: false, marketing: false };
        else {
          next = {};
          $$('.toggle[data-cat]', m.root).forEach(function (t) {
            next[t.dataset.cat] = t.getAttribute('aria-checked') === 'true';
          });
        }
        write(next);
        hideBanner();
        m.close();
        W.toast('Preferences saved');
      });
    }

    function init() {
      gtagStub();
      state = read();
      // Consent Mode v2 defaults must exist before anything measures.
      window.gtag('consent', 'default', signals(state || { analytics: false, marketing: false }));
      if (state) apply(state);
      else setTimeout(showBanner, 700);

      // Any "manage cookies" control on any page.
      document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-cookie-prefs], #footerManageCookies');
        if (t) { e.preventDefault(); openPrefs(); }
      });
    }

    return {
      init: init, openPrefs: openPrefs,
      get: function () { return state ? Object.assign({}, state) : null; },
      set: write,
      reset: function () {
        try { localStorage.removeItem(CONFIG.consentKey); } catch (e) { }
        state = null; clearAnalyticsCookies(); showBanner();
      }
    };
  })();
  W.consent = Consent;

  /* ---------- analytics event helper (respects consent) ---------- */
  W.track = function (name, params) {
    var c = Consent.get();
    if (!c || !c.analytics || !window.gtag) return;
    try { window.gtag('event', name, params || {}); } catch (e) { }
  };

  /* ---------- footer year + build ---------- */
  function initFooter() {
    $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
  }

  /* ---------- service worker ---------- */
  function initSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is a bonus, never fatal */ });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    initNav();
    initReveal();
    initSpotlight();
    initRipple();
    initFooter();
    Consent.init();
    initSW();
    document.dispatchEvent(new CustomEvent('wattrix:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
