/* =========================================================
   WATTRIX — guided tour
   Spotlight overlay + step popover. Keyboard driven,
   scroll-aware, works on touch. No dependencies.
   =======================================================*/
(function () {
  'use strict';

  var W = window.Wattrix || (window.Wattrix = {});
  var SEEN_KEY = 'wattrix.tour.seen.v2';

  var state = { steps: [], i: 0, live: false, nodes: null, onResize: null };

  function $(s, r) { return (r || document).querySelector(s); }

  /* ---------- build ---------- */
  function buildDom() {
    var overlay = document.createElement('div');
    overlay.className = 'tour-overlay';

    var hole = document.createElement('div');
    hole.className = 'tour-hole';

    var pop = document.createElement('div');
    pop.className = 'tour-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-label', 'Product tour');
    pop.innerHTML =
      '<button type="button" class="tour-skip" data-t="end">Skip</button>' +
      '<div class="tp-step"></div>' +
      '<h4></h4>' +
      '<p></p>' +
      '<div class="tp-foot">' +
      '<div class="tp-dots"></div>' +
      '<div class="tp-btns">' +
      '<button type="button" class="btn sm" data-t="prev">Back</button>' +
      '<button type="button" class="btn sm brand" data-t="next">Next</button>' +
      '</div></div>';

    document.body.appendChild(overlay);
    document.body.appendChild(hole);
    document.body.appendChild(pop);
    return { overlay: overlay, hole: hole, pop: pop };
  }

  /* ---------- position ---------- */
  function place(step) {
    var n = state.nodes;
    var target = step.el ? document.querySelector(step.el) : null;
    var visible = target && target.offsetParent !== null;

    if (!visible) {
      // Centre card, no spotlight - so the overlay has to do the dimming.
      n.overlay.classList.add('dim');
      n.hole.style.opacity = '0';
      n.hole.style.width = n.hole.style.height = '0px';
      n.pop.style.left = '50%';
      n.pop.style.top = '50%';
      n.pop.style.transform = 'translate(-50%,-50%)';
      return;
    }

    n.overlay.classList.remove('dim');
    n.hole.style.opacity = '1';
    n.pop.style.transform = 'none';

    var r = target.getBoundingClientRect();
    var pad = step.pad === undefined ? 8 : step.pad;
    var vw = window.innerWidth, vh = window.innerHeight;

    n.hole.style.top = (r.top - pad) + 'px';
    n.hole.style.left = (r.left - pad) + 'px';
    n.hole.style.width = (r.width + pad * 2) + 'px';
    n.hole.style.height = (r.height + pad * 2) + 'px';

    var pw = n.pop.offsetWidth || 340;
    var ph = n.pop.offsetHeight || 190;
    var gap = 16;

    var top, left;
    var below = vh - r.bottom;
    var above = r.top;

    if (below >= ph + gap + 10) top = r.bottom + gap;
    else if (above >= ph + gap + 10) top = r.top - ph - gap;
    else top = Math.max(12, Math.min(vh - ph - 12, r.top));

    left = r.left + r.width / 2 - pw / 2;
    left = Math.max(12, Math.min(vw - pw - 12, left));

    n.pop.style.top = Math.round(top) + 'px';
    n.pop.style.left = Math.round(left) + 'px';
  }

  function scrollTo(step, done) {
    var target = step.el ? document.querySelector(step.el) : null;
    if (!target || target.offsetParent === null) { done(); return; }
    var r = target.getBoundingClientRect();
    var needs = r.top < 120 || r.bottom > window.innerHeight - 120;
    if (!needs) { done(); return; }
    var y = window.scrollY + r.top - (window.innerHeight / 2 - r.height / 2);
    window.scrollTo({ top: Math.max(0, y), behavior: W.reduceMotion ? 'auto' : 'smooth' });
    setTimeout(done, W.reduceMotion ? 20 : 380);
  }

  /* ---------- render ---------- */
  function render() {
    var step = state.steps[state.i];
    if (!step) { end(); return; }
    var n = state.nodes;

    if (typeof step.before === 'function') {
      try { step.before(); } catch (e) { }
    }

    n.pop.querySelector('.tp-step').textContent = 'Step ' + (state.i + 1) + ' of ' + state.steps.length;
    n.pop.querySelector('h4').textContent = step.title;
    n.pop.querySelector('p').textContent = step.text;

    var dots = n.pop.querySelector('.tp-dots');
    dots.innerHTML = state.steps.map(function (_, i) {
      return '<i class="' + (i === state.i ? 'on' : '') + '"></i>';
    }).join('');

    var prev = n.pop.querySelector('[data-t=prev]');
    var next = n.pop.querySelector('[data-t=next]');
    prev.disabled = state.i === 0;
    next.textContent = state.i === state.steps.length - 1 ? 'Finish' : 'Next';

    // Let the DOM settle (mode switches change layout) before measuring.
    requestAnimationFrame(function () {
      scrollTo(step, function () {
        place(step);
        next.focus();
      });
    });
  }

  /* ---------- control ---------- */
  function next() {
    if (state.i >= state.steps.length - 1) { end(true); return; }
    state.i++;
    render();
  }
  function prev() {
    if (state.i === 0) return;
    state.i--;
    render();
  }

  function onKey(e) {
    if (!state.live) return;
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  }

  function start(steps, opts) {
    if (state.live) return;
    steps = (steps || []).filter(function (s) {
      return !s.el || document.querySelector(s.el);
    });
    if (!steps.length) return;

    state.steps = steps;
    state.i = 0;
    state.live = true;
    state.nodes = buildDom();
    document.body.classList.add('tour-active');

    var n = state.nodes;
    requestAnimationFrame(function () { n.overlay.classList.add('show'); });

    n.pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]');
      if (!b) return;
      if (b.dataset.t === 'next') next();
      else if (b.dataset.t === 'prev') prev();
      else end();
    });
    n.overlay.addEventListener('click', function () { end(); });
    document.addEventListener('keydown', onKey);

    state.onResize = function () {
      var s = state.steps[state.i];
      if (s) place(s);
    };
    window.addEventListener('resize', state.onResize);
    window.addEventListener('scroll', state.onResize, { passive: true });

    render();
    if (W.track) W.track('tour_start', { page: location.pathname });
    if (opts && opts.mark !== false) markSeen();
  }

  function end(completed) {
    if (!state.live) return;
    state.live = false;
    var n = state.nodes;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', state.onResize);
    window.removeEventListener('scroll', state.onResize);
    document.body.classList.remove('tour-active');
    n.overlay.classList.remove('show');
    n.pop.style.opacity = '0';
    n.hole.style.opacity = '0';
    setTimeout(function () {
      [n.overlay, n.hole, n.pop].forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
    }, 320);
    markSeen();
    if (W.track) W.track(completed ? 'tour_complete' : 'tour_exit', { step: state.i + 1 });
    if (completed && W.toast) W.toast('That is the whole tool. Numbers update as you type.');
  }

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { }
  }
  function hasSeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  W.tour = { start: start, end: end, hasSeen: hasSeen, reset: function () { try { localStorage.removeItem(SEEN_KEY); } catch (e) { } } };

  /* =========================================================
     CALCULATOR TOUR
     ========================================================= */
  function setMode(m) {
    var b = document.querySelector('.seg [data-mode="' + m + '"]');
    if (b) b.click();
  }

  var CALC_STEPS = [
    {
      el: '#vehiclePanel',
      title: 'Start with your car',
      text: 'Everything else hangs off two numbers: usable battery size and how much energy you actually use per kilometre. Pick a model from the list or type your own.'
    },
    {
      el: '#pickVehicle',
      title: '48 models built in',
      text: 'The picker fills in battery size, typical consumption and peak charging power. Search by model name, then adjust anything that does not match your car.'
    },
    {
      el: '#modeTabs',
      title: 'Four tools, one profile',
      text: 'Trip plans a journey. Charge times a single session. Range tells you how far you can go right now. Compare puts the EV against petrol or diesel.',
      before: function () { setMode('trip'); }
    },
    {
      el: '#tripPanel',
      title: 'Plan the journey',
      text: 'Distance, the charge you set off with, and the reserve you refuse to go below. Wattrix works out whether you make it and how many stops it costs you.',
      before: function () { setMode('trip'); }
    },
    {
      el: '#chargerPanel',
      title: 'Where you plug in',
      text: 'AC or DC, and how many kW. Your car has its own ceiling, so a 350 kW charger does not help a car that peaks at 100 kW. Wattrix uses the lower of the two.'
    },
    {
      el: '#conditionsPanel',
      title: 'The bit other calculators skip',
      text: 'Temperature, speed, roof box, winter tyres. At -10 °C on the motorway you can lose a third of your range, and the plan changes with it.',
      before: function () {
        var b = document.querySelector('[aria-controls=conditionsBody]');
        if (b && b.getAttribute('aria-expanded') === 'false') b.click();
      }
    },
    {
      el: '#resultsCard',
      title: 'Answers, live',
      text: 'Nothing to submit. Every keystroke re-runs the maths in your browser, including the charging curve that makes the last 20% so slow.'
    },
    {
      el: '#verdict',
      title: 'The plain-English answer first',
      text: 'Green means you are fine. Amber means it works but costs you time. Red means the numbers do not add up yet.'
    },
    {
      el: '#chartBox',
      title: 'And the shape of it',
      text: 'The chart changes with the tool: charge against distance, power against state of charge, range against temperature, cost against mileage.'
    },
    {
      el: '#resultActions',
      title: 'Take it with you',
      text: 'Share copies a link that carries every input. CSV and Print give you something to keep. Save stores the trips you repeat.'
    },
    {
      el: '#btnTour',
      title: 'That is the tour',
      text: 'Restart it any time from this button. Your inputs stay on this device and nothing is uploaded.'
    }
  ];

  // Never stack the tour on top of the cookie banner - the consent
  // choice has to be made on a clear screen first.
  function startWhenClear(delay, guard) {
    setTimeout(function () {
      if (guard && guard()) return;
      var banner = document.querySelector('.cookie-banner:not([hidden])');
      if (banner) {
        document.addEventListener('wattrix:consent', function once() {
          document.removeEventListener('wattrix:consent', once);
          setTimeout(function () {
            if (guard && guard()) return;
            start(CALC_STEPS);
          }, 700);
        });
        return;
      }
      start(CALC_STEPS);
    }, delay);
  }

  function initCalcTour() {
    if (!document.getElementById('calcRoot')) return;

    var btn = document.getElementById('btnTour');
    if (btn) btn.addEventListener('click', function () { start(CALC_STEPS); });

    // ?tour=1 always runs it (handy for links and support).
    if (new URLSearchParams(location.search).get('tour') === '1') {
      startWhenClear(700);
      return;
    }

    // Otherwise offer it the first time someone lands on the tool.
    function offer() {
      if (hasSeen() || state.live) return;
      startWhenClear(1200, function () { return hasSeen() || state.live; });
    }
    document.addEventListener('wattrix:first-visit', offer);
    if (W.firstVisit) offer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCalcTour);
  else initCalcTour();
})();
