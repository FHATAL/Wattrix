/* =========================================================
   WATTRIX — calculator
   Four tools over one shared vehicle profile:
     trip    : can I make it, what charging does it cost me
     charge  : how long is this charging session, really
     range   : how far can I go in today's conditions
     compare : EV vs petrol/diesel running costs
   All maths runs locally. Nothing leaves the browser.
   =======================================================*/
(function () {
  'use strict';

  var D = window.WATTRIX_DATA;
  var W = window.Wattrix || {};
  var KM_MI = D.KM_PER_MI;
  var STORE = 'wattrix.inputs.v3';
  var SCENARIOS = 'wattrix.scenarios.v1';

  function $(id) { return document.getElementById(id); }
  function $$(sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); }

  /* ---------- number helpers ---------- */
  function num(v, def) {
    if (v === null || v === undefined || v === '') return def === undefined ? 0 : def;
    var n = parseFloat(String(v).replace(/\s+/g, '').replace(',', '.'));
    return isFinite(n) ? n : (def === undefined ? 0 : def);
  }
  function clamp(n, a, b) { return Math.min(Math.max(n, a), b); }
  function fmt(n, d) {
    if (!isFinite(n)) return '--';
    d = d === undefined ? 1 : d;
    return Number(n).toFixed(d);
  }
  function fmtInt(n) { return isFinite(n) ? Math.round(n).toLocaleString() : '--'; }
  function hm(hours) {
    if (!isFinite(hours) || hours < 0) return '--';
    var total = Math.round(hours * 60);
    var h = Math.floor(total / 60), m = total % 60;
    return h > 0 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + ' min';
  }

  /* =========================================================
     ENGINE (pure functions - unit tested separately)
     ========================================================= */
  var Engine = {
    /* Efficiency unit -> canonical Wh/km */
    toWhPerKm: function (value, unit) {
      switch (unit) {
        case 'whmi': return value / KM_MI;
        case 'kwh100': return value * 10;
        case 'mikwh': return value > 0 ? (1000 / value) / KM_MI : 0;
        default: return value;
      }
    },
    fromWhPerKm: function (whkm, unit) {
      switch (unit) {
        case 'whmi': return whkm * KM_MI;
        case 'kwh100': return whkm / 10;
        case 'mikwh': return whkm > 0 ? 1000 / (whkm * KM_MI) : 0;
        default: return whkm;
      }
    },

    /* Multiplier applied to rated consumption for real conditions.
       Each term is an independent, defensible penalty. */
    conditionFactor: function (c) {
      var f = 1;
      var t = c.tempC;
      if (isFinite(t)) {
        // Cold hurts twice: chemistry plus cabin heating.
        if (t < 20) f *= 1 + (20 - t) * 0.011;
        else if (t > 28) f *= 1 + (t - 28) * 0.008;
      }
      f *= ({ city: 0.90, mixed: 1.0, road: 1.08, mw100: 1.16, mw120: 1.28, mw140: 1.45 })[c.profile] || 1;
      f *= ({ none: 1, load: 1.08, roof: 1.16, trailer: 1.6 })[c.extraLoad] || 1;
      if (c.winterTyres) f *= 1.05;
      return f;
    },

    /* Charging session simulated 0.5% of pack at a time so the
       taper is integrated instead of hand-waved. */
    session: function (o) {
      var cap = o.capKwh, from = clamp(o.fromSoc, 0, 100), to = clamp(o.toSoc, 0, 100);
      var out = { hours: 0, kwhBattery: 0, kwhBilled: 0, avgKw: 0, peakKw: 0, samples: [], ok: to > from && cap > 0 };
      if (!out.ok) return out;

      var stepPct = 0.5;
      var stepKwh = cap * stepPct / 100;
      var isDc = o.type === 'dc';
      var vehLimit = isDc ? (o.vehicleDcKw || 999) : (o.vehicleAcKw || 999);
      var supply = o.chargerKw || 0;
      // Cold packs charge slower on DC. Rough but real.
      var coldK = 1;
      if (isDc && isFinite(o.tempC)) {
        if (o.tempC < 10) coldK = clamp(1 - (10 - o.tempC) * 0.022, 0.45, 1);
        else if (o.tempC > 35) coldK = 0.9;
      }

      var soc = from, t = 0;
      out.samples.push({ soc: soc, t: 0, kw: powerAt(soc) });
      var guard = 0;
      while (soc < to - 1e-9 && guard++ < 5000) {
        var kw = powerAt(soc);
        if (kw <= 0.01) break;
        var dPct = Math.min(stepPct, to - soc);
        var dKwh = cap * dPct / 100;
        var dt = dKwh / kw;
        t += dt;
        soc += dPct;
        out.kwhBattery += dKwh;
        if (kw > out.peakKw) out.peakKw = kw;
        out.samples.push({ soc: soc, t: t, kw: kw });
      }
      out.hours = t;
      var loss = clamp(o.lossPct === undefined ? (isDc ? 5 : 11) : o.lossPct, 0, 40) / 100;
      out.kwhBilled = out.kwhBattery / (1 - loss);
      out.avgKw = t > 0 ? out.kwhBattery / t : 0;
      return out;

      function powerAt(s) {
        var f = isDc ? D.dcFactor(s) : D.acFactor(s);
        return Math.min(supply, vehLimit * f * (isDc ? coldK : 1));
      }
    },

    /* How much energy (kWh at the battery) a drive needs. */
    tripEnergy: function (distanceKm, whPerKm) {
      return distanceKm * whPerKm / 1000;
    },

    /* Plan the charging stops needed to finish a trip. */
    plan: function (o) {
      var cap = o.capKwh;
      var need = o.tripKwh;
      var startKwh = cap * o.startSoc / 100;
      var reserveKwh = cap * o.reserveSoc / 100;
      var available = startKwh - reserveKwh;
      var res = {
        stops: [], totalChargeHours: 0, totalKwhBattery: 0, totalKwhBilled: 0,
        deficitKwh: 0, arrivalSoc: 0, needsCharge: false
      };

      if (need <= available + 1e-9) {
        res.arrivalSoc = cap > 0 ? ((startKwh - need) / cap) * 100 : 0;
        return res;
      }

      res.needsCharge = true;
      res.deficitKwh = need - available;

      // Each stop: arrive near the reserve level, charge up to the cap
      // the driver set (default 80% - past that DC charging is slow).
      var topSoc = clamp(o.stopTopSoc || 80, 20, 100);
      var bottomSoc = clamp(o.reserveSoc, 0, topSoc - 5);
      var perStopKwh = cap * (topSoc - bottomSoc) / 100;
      var remaining = res.deficitKwh;
      var guard = 0;

      while (remaining > 1e-6 && guard++ < 12) {
        var take = Math.min(remaining, perStopKwh);
        var toSoc = bottomSoc + (take / cap) * 100;
        var s = Engine.session({
          capKwh: cap, fromSoc: bottomSoc, toSoc: toSoc,
          chargerKw: o.chargerKw, vehicleDcKw: o.vehicleDcKw, vehicleAcKw: o.vehicleAcKw,
          type: o.chargerType, lossPct: o.lossPct, tempC: o.tempC
        });
        if (!s.ok || s.hours <= 0) break;
        res.stops.push({ fromSoc: bottomSoc, toSoc: toSoc, hours: s.hours, kwh: s.kwhBattery, billed: s.kwhBilled, avgKw: s.avgKw });
        res.totalChargeHours += s.hours;
        res.totalKwhBattery += s.kwhBattery;
        res.totalKwhBilled += s.kwhBilled;
        remaining -= take;
      }
      res.arrivalSoc = o.reserveSoc;
      return res;
    }
  };
  window.WattrixEngine = Engine;

  /* =========================================================
     STATE
     ========================================================= */
  var FIELDS = [
    'mode', 'cap', 'eff', 'effUnit', 'dcMax', 'acMax',
    'dist', 'distUnit', 'socStart', 'socReserve', 'stopTop',
    'chargerKw', 'chargerType', 'price', 'currency', 'lossPct',
    'tempC', 'profile', 'extraLoad', 'winterTyres',
    'cSocFrom', 'cSocTo',
    'rSoc', 'rReserve',
    'annualKm', 'homePrice', 'pubPrice', 'pubShare', 'fuelL100', 'fuelPrice', 'fuelCo2'
  ];

  var DEFAULTS = {
    mode: 'trip', cap: 75, eff: 175, effUnit: 'whkm', dcMax: 150, acMax: 11,
    dist: 300, distUnit: 'km', socStart: 90, socReserve: 10, stopTop: 80,
    chargerKw: 150, chargerType: 'dc', price: 0.35, currency: '€', lossPct: 5,
    tempC: 15, profile: 'mixed', extraLoad: 'none', winterTyres: false,
    cSocFrom: 20, cSocTo: 80,
    rSoc: 70, rReserve: 10,
    annualKm: 20000, homePrice: 0.12, pubPrice: 0.45, pubShare: 25,
    fuelL100: 7.0, fuelPrice: 1.75, fuelCo2: 2.31
  };

  var S = Object.assign({}, DEFAULTS);
  var els = {};
  var lastResult = null;

  /* ---------- persistence ---------- */
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return false;
      FIELDS.forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
      return true;
    } catch (e) { return false; }
  }

  /* ---------- URL sharing ---------- */
  function toQuery() {
    var p = new URLSearchParams();
    FIELDS.forEach(function (k) {
      if (S[k] === DEFAULTS[k]) return;
      p.set(k, typeof S[k] === 'boolean' ? (S[k] ? '1' : '0') : S[k]);
    });
    p.set('mode', S.mode);
    return p.toString();
  }
  function fromQuery() {
    var p = new URLSearchParams(location.search);
    if (!p.toString()) return false;
    var hit = false;
    FIELDS.forEach(function (k) {
      if (!p.has(k)) return;
      var v = p.get(k);
      hit = true;
      if (typeof DEFAULTS[k] === 'boolean') S[k] = v === '1' || v === 'true';
      else if (typeof DEFAULTS[k] === 'number') S[k] = num(v, DEFAULTS[k]);
      else S[k] = v;
    });
    return hit;
  }

  /* ---------- bind DOM <-> state ---------- */
  function syncToDom() {
    FIELDS.forEach(function (k) {
      var e = els[k];
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!S[k];
      else e.value = S[k];
      if (e.type === 'range') paintRange(e);
    });
    // mirrors for range values
    $$('[data-mirror]').forEach(function (m) {
      var src = els[m.dataset.mirror];
      if (src) m.textContent = mirrorText(m.dataset.mirror, src.value);
    });
    updateTabs();
    updateModeVisibility();
    updateChargerTypeUi();
  }

  function mirrorText(key, v) {
    if (key === 'tempC') return v + '°C';
    if (key === 'pubShare') return v + '%';
    return v + '%';
  }

  function paintRange(e) {
    var min = num(e.min, 0), max = num(e.max, 100), v = num(e.value, 0);
    var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    e.style.setProperty('--pct', pct + '%');
  }

  function readDom() {
    FIELDS.forEach(function (k) {
      var e = els[k];
      if (!e) return;
      if (e.type === 'checkbox') S[k] = e.checked;
      else if (typeof DEFAULTS[k] === 'number') S[k] = num(e.value, DEFAULTS[k]);
      else S[k] = e.value;
    });
  }

  /* ---------- validation ---------- */
  var RULES = {
    cap: [1, 400, 'Usable battery should be between 1 and 400 kWh'],
    eff: [1, 2000, 'Check the consumption figure'],
    dcMax: [1, 500, 'Peak DC power should be 1-500 kW'],
    acMax: [1, 50, 'Onboard AC charger is usually 3.7-22 kW'],
    dist: [0, 20000, 'Distance should be 0-20000'],
    chargerKw: [0.5, 500, 'Charger power should be 0.5-500 kW'],
    price: [0, 10, 'Price per kWh looks wrong'],
    annualKm: [0, 500000, 'Annual distance looks wrong'],
    fuelL100: [0.1, 60, 'Fuel use should be 0.1-60 L/100 km'],
    fuelPrice: [0, 20, 'Fuel price looks wrong']
  };

  function validate() {
    var ok = true;
    Object.keys(RULES).forEach(function (k) {
      var e = els[k];
      if (!e || e.offsetParent === null) return;
      var r = RULES[k], v = num(e.value, NaN);
      var bad = !isFinite(v) || v < r[0] || v > r[1];
      e.classList.toggle('invalid', bad);
      var errNode = document.querySelector('[data-err="' + k + '"]');
      if (errNode) {
        errNode.textContent = bad ? r[2] : '';
        errNode.classList.toggle('show', bad);
      }
      if (bad) ok = false;
    });
    // SoC sanity
    if (S.mode === 'charge' && S.cSocTo <= S.cSocFrom) {
      flagSoc('cSocTo', 'Target must be above the starting charge');
      ok = false;
    } else clearFlag('cSocTo');
    if (S.mode === 'trip' && S.socReserve >= S.socStart) {
      flagSoc('socReserve', 'Reserve must be below your starting charge');
      ok = false;
    } else clearFlag('socReserve');
    return ok;
  }
  function flagSoc(k, msg) {
    var e = els[k]; if (e) e.classList.add('invalid');
    var n = document.querySelector('[data-err="' + k + '"]');
    if (n) { n.textContent = msg; n.classList.add('show'); }
  }
  function clearFlag(k) {
    var e = els[k]; if (e) e.classList.remove('invalid');
    var n = document.querySelector('[data-err="' + k + '"]');
    if (n) { n.textContent = ''; n.classList.remove('show'); }
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function distToKm(v) { return S.distUnit === 'mi' ? v * KM_MI : v; }
  function kmToDist(v) { return S.distUnit === 'mi' ? v / KM_MI : v; }
  function du() { return S.distUnit; }
  function cur() { return S.currency; }
  function money(v, d) { return cur() + fmt(v, d === undefined ? 2 : d); }

  function setKpi(id, value, opts) {
    var node = $(id);
    if (!node) return;
    opts = opts || {};
    if (opts.raw) {
      // A count-up from the previous mode could still be running and
      // would overwrite this on its next frame.
      if (W.stopCount) W.stopCount(node);
      node.textContent = value;
      node.dataset.cv = '';
    } else W.countUp(node, value, opts);
    var box = node.closest('.kpi-box');
    if (box) {
      box.classList.remove('flash');
      void box.offsetWidth;
      box.classList.add('flash');
    }
  }

  function setKpiLabel(i, text) {
    var n = document.querySelectorAll('.kpi-label')[i];
    if (n) n.textContent = text;
  }

  function verdict(kind, title, text) {
    var v = $('verdict');
    if (!v) return;
    var icons = {
      ok: W.ICON.check, warn: W.ICON.warn, danger: W.ICON.err, info: W.ICON.info
    };
    v.className = 'verdict ' + kind;
    v.innerHTML = icons[kind] + '<div><strong></strong><span></span></div>';
    v.querySelector('strong').textContent = title;
    v.querySelector('span').textContent = text;
  }

  function socBar(pct, label, subLeft, subRight) {
    var wrap = $('socBar');
    if (!wrap) return;
    wrap.hidden = false;
    var fill = $('socFill');
    var p = clamp(pct, 0, 100);
    fill.style.width = p + '%';
    fill.className = 'socbar-fill' + (p < 10 ? ' low' : p < 25 ? ' mid' : '');
    $('socText').textContent = label;
    $('socLeft').textContent = subLeft || '';
    $('socRight').textContent = subRight || '';
  }

  function breakdown(rows) {
    var ul = $('breakdown');
    if (!ul) return;
    ul.innerHTML = rows.map(function (r) {
      if (r.group) return '<li class="group">' + esc(r.group) + '</li>';
      if (r.note) return '<li class="note">' + esc(r.note) + '</li>';
      return '<li>' + esc(r.k) + '<span class="' + (r.cls || '') + '">' + esc(r.v) + '</span></li>';
    }).join('');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------- SVG line chart ---------- */
  function chart(series, opts) {
    opts = opts || {};
    var box = $('chartBox');
    if (!box) return;
    if (!series || !series.length) { box.hidden = true; return; }
    box.hidden = false;

    var w = 100, h = 46, padL = 9, padR = 4, padT = 4, padB = 9;
    var xs = [], ys = [];
    series.forEach(function (s) {
      s.points.forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    });
    var xMin = opts.xMin !== undefined ? opts.xMin : Math.min.apply(null, xs);
    var xMax = opts.xMax !== undefined ? opts.xMax : Math.max.apply(null, xs);
    var yMin = opts.yMin !== undefined ? opts.yMin : 0;
    var yMax = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, ys);
    if (xMax <= xMin) xMax = xMin + 1;
    if (yMax <= yMin) yMax = yMin + 1;

    function X(v) { return padL + ((v - xMin) / (xMax - xMin)) * (w - padL - padR); }
    function Y(v) { return h - padB - ((v - yMin) / (yMax - yMin)) * (h - padT - padB); }

    var grid = '';
    for (var i = 0; i <= 4; i++) {
      var gy = padT + (i / 4) * (h - padT - padB);
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(2) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(2) +
        '" stroke="rgba(255,255,255,.07)" stroke-width="0.25"/>';
    }

    var paths = series.map(function (s, idx) {
      var d = s.points.map(function (p, i) {
        return (i ? 'L' : 'M') + X(p.x).toFixed(2) + ' ' + Y(p.y).toFixed(2);
      }).join(' ');
      var out = '';
      if (s.fill) {
        var last = s.points[s.points.length - 1], first = s.points[0];
        out += '<path d="' + d + ' L' + X(last.x).toFixed(2) + ' ' + Y(yMin).toFixed(2) +
          ' L' + X(first.x).toFixed(2) + ' ' + Y(yMin).toFixed(2) + ' Z" fill="' + s.fill + '" stroke="none"/>';
      }
      if (s.dash) {
        out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 0.9) +
          '" stroke-dasharray="2 1.6" stroke-linecap="round" opacity="0.95"/>';
      } else {
        out += '<path class="spark-line" style="--len:260" d="' + d + '" fill="none" stroke="' + s.color +
          '" stroke-width="' + (s.width || 0.9) + '" stroke-linejoin="round" stroke-linecap="round"/>';
      }
      return out;
    }).join('');

    var labels = '';
    (opts.xTicks || []).forEach(function (t) {
      labels += '<text x="' + X(t.v).toFixed(2) + '" y="' + (h - 1.5) + '" fill="#647084" font-size="2.6" text-anchor="middle">' + esc(t.label) + '</text>';
    });
    (opts.yTicks || []).forEach(function (t) {
      labels += '<text x="' + (padL - 1.5) + '" y="' + (Y(t.v) + 0.9).toFixed(2) + '" fill="#647084" font-size="2.6" text-anchor="end">' + esc(t.label) + '</text>';
    });

    box.querySelector('svg').setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    box.querySelector('svg').innerHTML = grid + paths + labels;
    var legend = box.querySelector('.chart-legend');
    legend.innerHTML = series.filter(function (s) { return s.label; }).map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span>';
    }).join('');
    if (opts.title) box.setAttribute('aria-label', opts.title);
  }
  function hideChart() { var b = $('chartBox'); if (b) b.hidden = true; }

  /* =========================================================
     MODES
     ========================================================= */
  function whPerKm() {
    return Engine.toWhPerKm(S.eff, S.effUnit);
  }
  function conditions() {
    return {
      tempC: S.tempC, profile: S.profile,
      extraLoad: S.extraLoad, winterTyres: !!S.winterTyres
    };
  }
  function adjustedWhPerKm() {
    return whPerKm() * Engine.conditionFactor(conditions());
  }
  function avgSpeedKmh() {
    return ({ city: 42, mixed: 68, road: 80, mw100: 100, mw120: 118, mw140: 132 })[S.profile] || 70;
  }

  function computeTrip() {
    var cap = S.cap;
    var whAdj = adjustedWhPerKm();
    var factor = Engine.conditionFactor(conditions());
    var distKm = distToKm(S.dist);
    var tripKwh = Engine.tripEnergy(distKm, whAdj);
    var plan = Engine.plan({
      capKwh: cap, tripKwh: tripKwh,
      startSoc: S.socStart, reserveSoc: S.socReserve, stopTopSoc: S.stopTop,
      chargerKw: S.chargerKw, chargerType: S.chargerType,
      vehicleDcKw: S.dcMax, vehicleAcKw: S.acMax,
      lossPct: S.lossPct, tempC: S.tempC
    });

    var driveHours = distKm / avgSpeedKmh();
    var totalHours = driveHours + plan.totalChargeHours;
    var cost = plan.totalKwhBilled * S.price;
    var rangeStartKm = cap * (S.socStart - S.socReserve) / 100 * 1000 / whAdj;

    // With no stop needed there is no charging bill, so show what the
    // energy the drive uses is worth instead of a meaningless zero.
    var headlineCost = plan.needsCharge ? cost : tripKwh * S.price;

    setKpi('kpi1', plan.needsCharge ? plan.totalKwhBilled : tripKwh, { decimals: 1, suffix: ' kWh' });
    setKpiLabel(0, plan.needsCharge ? 'Charge needed' : 'Trip energy');
    setKpi('kpi2', plan.needsCharge ? hm(plan.totalChargeHours) : hm(driveHours), { raw: true });
    setKpiLabel(1, plan.needsCharge ? 'Charging time' : 'Driving time');
    setKpi('kpi3', headlineCost, { decimals: 2, prefix: cur() });
    setKpiLabel(2, plan.needsCharge ? 'Charging cost' : 'Energy cost');

    if (!plan.needsCharge) {
      verdict('ok', 'You can make it without stopping',
        'Arriving with about ' + fmt(plan.arrivalSoc, 0) + '% left, which is ' +
        fmt(kmToDist(cap * plan.arrivalSoc / 100 * 1000 / whAdj), 0) + ' ' + du() + ' of spare range.');
      socBar(plan.arrivalSoc, fmt(plan.arrivalSoc, 0) + '% on arrival',
        'Start ' + S.socStart + '%', 'Reserve ' + S.socReserve + '%');
    } else if (plan.stops.length === 0) {
      verdict('danger', 'This trip cannot be planned',
        'Check the charger power and battery size - the numbers given do not allow any charging.');
      socBar(0, 'Not possible', '', '');
    } else {
      verdict(plan.stops.length > 2 ? 'warn' : 'info',
        plan.stops.length + (plan.stops.length === 1 ? ' charging stop needed' : ' charging stops needed'),
        'Add ' + fmt(plan.deficitKwh, 1) + ' kWh en route. Door to door about ' + hm(totalHours) +
        ' including charging.');
      socBar(S.socReserve, 'Arrive at each stop near ' + fmt(S.socReserve, 0) + '%',
        'Start ' + S.socStart + '%', 'Charge to ' + S.stopTop + '%');
    }

    var rows = [
      { group: 'The drive' },
      { k: 'Distance', v: fmtInt(S.dist) + ' ' + du() },
      { k: 'Rated consumption', v: fmt(S.eff, S.effUnit === 'kwh100' || S.effUnit === 'mikwh' ? 1 : 0) + ' ' + effUnitLabel() },
      { k: 'Adjusted for conditions', v: fmt(whAdj, 0) + ' Wh/km (' + (factor >= 1 ? '+' : '') + fmt((factor - 1) * 100, 0) + '%)', cls: factor > 1.15 ? 'text-warn' : '' },
      { k: 'Energy for the trip', v: fmt(tripKwh, 1) + ' kWh' },
      { k: 'Driving time at ' + fmtInt(kmToDist(avgSpeedKmh())) + ' ' + du() + '/h', v: hm(driveHours) },
      { group: 'Battery' },
      { k: 'Usable pack', v: fmt(cap, 1) + ' kWh' },
      { k: 'Range at start', v: fmt(kmToDist(rangeStartKm), 0) + ' ' + du() + ' to reserve' },
      { k: 'Energy on board', v: fmt(cap * S.socStart / 100, 1) + ' kWh (' + fmt(S.socStart, 0) + '%)' }
    ];

    if (plan.needsCharge) {
      rows.push({ group: 'Charging plan' });
      rows.push({ k: 'Shortfall', v: fmt(plan.deficitKwh, 1) + ' kWh', cls: 'text-warn' });
      plan.stops.forEach(function (s, i) {
        rows.push({
          k: 'Stop ' + (i + 1) + ': ' + fmt(s.fromSoc, 0) + '% → ' + fmt(s.toSoc, 0) + '%',
          v: hm(s.hours) + ' · ' + fmt(s.avgKw, 0) + ' kW avg'
        });
      });
      rows.push({ k: 'Energy into battery', v: fmt(plan.totalKwhBattery, 1) + ' kWh' });
      rows.push({ k: 'Energy billed (' + fmt(S.lossPct, 0) + '% losses)', v: fmt(plan.totalKwhBilled, 1) + ' kWh' });
      rows.push({ k: 'Charging cost', v: money(cost) });
      rows.push({ k: 'Cost per 100 ' + du(), v: money(distKm > 0 ? cost / kmToDist(distKm) * 100 : 0) });
      rows.push({ group: 'Journey total' });
      rows.push({ k: 'Driving + charging', v: hm(totalHours), cls: 'text-ok' });
      rows.push({ k: 'Average speed door to door', v: fmt(kmToDist(distKm) / totalHours, 0) + ' ' + du() + '/h' });
      rows.push({ note: 'Charging times use a tapering curve, so the last 20% of the pack is deliberately slow.' });
    } else {
      rows.push({ group: 'On arrival' });
      rows.push({ k: 'State of charge', v: fmt(plan.arrivalSoc, 0) + '%', cls: 'text-ok' });
      rows.push({ k: 'Energy left', v: fmt(cap * plan.arrivalSoc / 100, 1) + ' kWh' });
      rows.push({ k: 'Cost of the energy used', v: money(tripKwh * S.price) });
      rows.push({ k: 'Cost per 100 ' + du(), v: money(distKm > 0 ? (tripKwh * S.price) / kmToDist(distKm) * 100 : 0) });
    }
    breakdown(rows);

    // Energy budget chart: SoC against distance travelled.
    var pts = [], steps = 40;
    for (var i = 0; i <= steps; i++) {
      var d = distKm * i / steps;
      var soc = S.socStart - (Engine.tripEnergy(d, whAdj) / cap) * 100;
      pts.push({ x: kmToDist(d), y: Math.max(soc, -20) });
    }
    var reservePts = [{ x: 0, y: S.socReserve }, { x: kmToDist(distKm), y: S.socReserve }];
    chart([
      { points: pts, color: '#7559ff', width: 1.1, fill: 'rgba(117,89,255,.14)', label: 'Charge without stopping' },
      { points: reservePts, color: '#ff7b83', width: 0.8, dash: true, label: 'Your reserve' }
    ], {
      yMin: Math.min(0, S.socReserve - 10), yMax: 100,
      xTicks: [{ v: 0, label: '0' }, { v: kmToDist(distKm) / 2, label: fmtInt(kmToDist(distKm) / 2) }, { v: kmToDist(distKm), label: fmtInt(kmToDist(distKm)) + ' ' + du() }],
      yTicks: [{ v: 0, label: '0%' }, { v: 50, label: '50%' }, { v: 100, label: '100%' }],
      title: 'State of charge over the trip'
    });

    lastResult = {
      mode: 'trip', tripKwh: tripKwh, cost: cost, plan: plan,
      driveHours: driveHours, totalHours: totalHours, whAdj: whAdj
    };
  }

  function computeCharge() {
    var s = Engine.session({
      capKwh: S.cap, fromSoc: S.cSocFrom, toSoc: S.cSocTo,
      chargerKw: S.chargerKw, vehicleDcKw: S.dcMax, vehicleAcKw: S.acMax,
      type: S.chargerType, lossPct: S.lossPct, tempC: S.tempC
    });
    var whAdj = adjustedWhPerKm();
    var cost = s.kwhBilled * S.price;
    var rangeAdded = whAdj > 0 ? s.kwhBattery * 1000 / whAdj : 0;
    var limit = S.chargerType === 'dc' ? Math.min(S.chargerKw, S.dcMax) : Math.min(S.chargerKw, S.acMax);

    setKpi('kpi1', hm(s.hours), { raw: true });
    setKpiLabel(0, 'Session time');
    setKpi('kpi2', s.kwhBattery, { decimals: 1, suffix: ' kWh' });
    setKpiLabel(1, 'Added to pack');
    setKpi('kpi3', cost, { decimals: 2, prefix: cur() });
    setKpiLabel(2, 'Cost');

    if (!s.ok) {
      verdict('danger', 'Nothing to calculate', 'The target charge has to be higher than the starting charge.');
      setKpi('kpi1', '--', { raw: true });
      setKpi('kpi2', '--', { raw: true });
      setKpi('kpi3', '--', { raw: true });
      hideChart();
      breakdown([]);
      socBar(0, '--', '', '');
      return;
    }

    var bottleneck = S.chargerType === 'dc'
      ? (S.chargerKw <= S.dcMax ? 'the charger' : 'your car')
      : (S.chargerKw <= S.acMax ? 'the charge point' : 'your onboard charger');
    if (S.cSocTo > 85 && S.chargerType === 'dc') {
      verdict('warn', 'The last stretch is the slow one',
        'Going from ' + fmt(S.cSocTo - 10, 0) + '% to ' + fmt(S.cSocTo, 0) + '% alone takes roughly ' +
        hm(tailTime(85, S.cSocTo)) + '. On a road trip, unplugging at 80% is usually faster overall.');
    } else {
      verdict('ok', 'Session planned',
        'Averaging ' + fmt(s.avgKw, 0) + ' kW, peaking at ' + fmt(s.peakKw, 0) + ' kW. Power is capped by ' + bottleneck + '.');
    }

    socBar(S.cSocTo, fmt(S.cSocFrom, 0) + '% → ' + fmt(S.cSocTo, 0) + '%',
      hm(s.hours), '+' + fmt(kmToDist(rangeAdded), 0) + ' ' + du());

    breakdown([
      { group: 'Session' },
      { k: 'Charge window', v: fmt(S.cSocFrom, 0) + '% → ' + fmt(S.cSocTo, 0) + '%' },
      { k: 'Energy into battery', v: fmt(s.kwhBattery, 1) + ' kWh' },
      { k: 'Energy billed (' + fmt(S.lossPct, 0) + '% losses)', v: fmt(s.kwhBilled, 1) + ' kWh' },
      { k: 'Time', v: hm(s.hours) },
      { group: 'Power' },
      { k: 'Charge point', v: fmt(S.chargerKw, 0) + ' kW ' + S.chargerType.toUpperCase() },
      { k: 'Car accepts up to', v: fmt(S.chargerType === 'dc' ? S.dcMax : S.acMax, 1) + ' kW' },
      { k: 'Effective ceiling', v: fmt(limit, 1) + ' kW' },
      { k: 'Average delivered', v: fmt(s.avgKw, 1) + ' kW' },
      { k: 'Peak delivered', v: fmt(s.peakKw, 1) + ' kW' },
      { group: 'Value' },
      { k: 'Cost', v: money(cost) },
      { k: 'Cost per kWh billed', v: money(s.kwhBilled > 0 ? cost / s.kwhBilled : 0, 3) },
      { k: 'Range added', v: fmt(kmToDist(rangeAdded), 0) + ' ' + du(), cls: 'text-ok' },
      { k: 'Cost per 100 ' + du(), v: money(rangeAdded > 0 ? cost / kmToDist(rangeAdded) * 100 : 0) },
      { k: 'Time per 100 ' + du() + ' added', v: hm(rangeAdded > 0 ? s.hours / kmToDist(rangeAdded) * 100 : 0) },
      S.chargerType === 'dc' && S.tempC < 10
        ? { note: 'A cold pack cannot take full DC power. At ' + fmt(S.tempC, 0) + '°C the estimate is derated - preconditioning on the way to the charger recovers most of it.' }
        : { note: 'Real sessions vary with cell temperature, charger sharing and state of health. Treat this as a good estimate, not a promise.' }
    ]);

    // Power against state of charge, plus SoC against time.
    var powerPts = s.samples.map(function (p) { return { x: p.soc, y: p.kw }; });
    var socPts = s.samples.map(function (p) { return { x: p.soc, y: (p.t / s.hours) * (s.peakKw || 1) }; });
    chart([
      { points: powerPts, color: '#38fbd0', width: 1.1, fill: 'rgba(56,251,208,.13)', label: 'Power delivered (kW)' },
      { points: socPts, color: '#2dd4ff', width: 0.8, dash: true, label: 'Time elapsed' }
    ], {
      xMin: S.cSocFrom, xMax: S.cSocTo, yMin: 0, yMax: Math.max(s.peakKw * 1.1, 1),
      xTicks: [
        { v: S.cSocFrom, label: fmt(S.cSocFrom, 0) + '%' },
        { v: (S.cSocFrom + S.cSocTo) / 2, label: fmt((S.cSocFrom + S.cSocTo) / 2, 0) + '%' },
        { v: S.cSocTo, label: fmt(S.cSocTo, 0) + '%' }
      ],
      yTicks: [{ v: 0, label: '0' }, { v: s.peakKw, label: fmt(s.peakKw, 0) + ' kW' }],
      title: 'Charging power across the session'
    });

    lastResult = { mode: 'charge', session: s, cost: cost, rangeAdded: rangeAdded };

    function tailTime(a, b) {
      var t = Engine.session({
        capKwh: S.cap, fromSoc: Math.max(a, S.cSocFrom), toSoc: b,
        chargerKw: S.chargerKw, vehicleDcKw: S.dcMax, vehicleAcKw: S.acMax,
        type: S.chargerType, lossPct: S.lossPct, tempC: S.tempC
      });
      return t.hours;
    }
  }

  function computeRange() {
    var cap = S.cap;
    var whRated = whPerKm();
    var factor = Engine.conditionFactor(conditions());
    var whAdj = whRated * factor;
    var usableKwh = cap * (S.rSoc - S.rReserve) / 100;
    var fullKwh = cap * S.rSoc / 100;
    var rangeAdj = whAdj > 0 ? usableKwh * 1000 / whAdj : 0;
    var rangeRated = whRated > 0 ? usableKwh * 1000 / whRated : 0;
    var perTenPct = whAdj > 0 ? (cap * 0.1) * 1000 / whAdj : 0;
    var costPer100 = whAdj * S.price / 10;

    setKpi('kpi1', kmToDist(rangeAdj), { decimals: 0, suffix: ' ' + du() });
    setKpiLabel(0, 'Usable range');
    setKpi('kpi2', whAdj, { decimals: 0, suffix: ' Wh/km' });
    setKpiLabel(1, 'Real consumption');
    setKpi('kpi3', costPer100, { decimals: 2, prefix: cur() });
    setKpiLabel(2, 'Per 100 ' + du());

    var lost = rangeRated - rangeAdj;
    if (factor > 1.2) {
      verdict('warn', 'Conditions are costing you range',
        'You lose about ' + fmt(kmToDist(lost), 0) + ' ' + du() + ' versus the rated figure. Cold and motorway speed are the two big ones.');
    } else if (factor < 1) {
      verdict('ok', 'Better than rated',
        'These conditions are gentle on the car - about ' + fmt(kmToDist(-lost), 0) + ' ' + du() + ' more than the rated figure.');
    } else {
      verdict('info', 'Close to the rated figure',
        'Conditions add about ' + fmt((factor - 1) * 100, 0) + '% to consumption.');
    }

    socBar(S.rSoc, fmt(S.rSoc, 0) + '% charged',
      fmt(fullKwh, 1) + ' kWh on board', 'Reserve ' + fmt(S.rReserve, 0) + '%');

    breakdown([
      { group: 'Right now' },
      { k: 'State of charge', v: fmt(S.rSoc, 0) + '%' },
      { k: 'Energy on board', v: fmt(fullKwh, 1) + ' kWh' },
      { k: 'Usable to reserve', v: fmt(usableKwh, 1) + ' kWh' },
      { group: 'Range' },
      { k: 'In these conditions', v: fmt(kmToDist(rangeAdj), 0) + ' ' + du(), cls: 'text-ok' },
      { k: 'At the rated figure', v: fmt(kmToDist(rangeRated), 0) + ' ' + du() },
      { k: 'Difference', v: (lost >= 0 ? '-' : '+') + fmt(Math.abs(kmToDist(lost)), 0) + ' ' + du(), cls: lost > 0 ? 'text-warn' : 'text-ok' },
      { k: 'Per 10% of battery', v: fmt(kmToDist(perTenPct), 0) + ' ' + du() },
      { k: 'Full pack, these conditions', v: fmt(kmToDist(whAdj > 0 ? cap * 1000 / whAdj : 0), 0) + ' ' + du() },
      { group: 'Running cost' },
      { k: 'Energy price', v: money(S.price, 3) + ' / kWh' },
      { k: 'Cost per 100 ' + du(), v: money(costPer100) },
      { k: 'Cost per ' + du(), v: money(costPer100 / 100, 3) },
      { note: 'Consumption multiplier ' + fmt(factor, 2) + '× from temperature, speed, load and tyres.' }
    ]);

    // Range against temperature at the current driving profile.
    var pts = [];
    for (var t = -20; t <= 40; t += 2) {
      var f = Engine.conditionFactor({ tempC: t, profile: S.profile, extraLoad: S.extraLoad, winterTyres: S.winterTyres });
      var wh = whRated * f;
      pts.push({ x: t, y: kmToDist(wh > 0 ? usableKwh * 1000 / wh : 0) });
    }
    var nowPts = [{ x: S.tempC, y: 0 }, { x: S.tempC, y: kmToDist(rangeAdj) }];
    chart([
      { points: pts, color: '#38fbd0', width: 1.1, fill: 'rgba(56,251,208,.12)', label: 'Range vs outside temperature' },
      { points: nowPts, color: '#a08cff', width: 0.8, dash: true, label: 'Today' }
    ], {
      xMin: -20, xMax: 40, yMin: 0,
      xTicks: [{ v: -20, label: '-20°' }, { v: 10, label: '10°' }, { v: 40, label: '40°' }],
      yTicks: [{ v: 0, label: '0' }],
      title: 'Range against outside temperature'
    });

    lastResult = { mode: 'range', rangeAdj: rangeAdj, whAdj: whAdj, costPer100: costPer100 };
  }

  function computeCompare() {
    var whAdj = adjustedWhPerKm();
    var annualKm = distToKm(S.annualKm);
    var pubShare = clamp(S.pubShare, 0, 100) / 100;
    var blended = S.homePrice * (1 - pubShare) + S.pubPrice * pubShare;

    // Charging losses are paid for at the meter, so they belong in the price.
    var lossK = 1 / (1 - clamp(S.lossPct, 0, 40) / 100);
    var evPer100 = (whAdj / 10) * blended * lossK;
    var evAnnual = evPer100 * annualKm / 100;

    var fuelPer100 = S.fuelL100 * S.fuelPrice;
    var fuelAnnual = fuelPer100 * annualKm / 100;

    var saveAnnual = fuelAnnual - evAnnual;
    var savePer100 = fuelPer100 - evPer100;

    var evCo2 = 0;  // grid intensity varies too much to fake a number per country
    var fuelCo2Annual = (S.fuelL100 * annualKm / 100) * S.fuelCo2;

    setKpi('kpi1', evPer100, { decimals: 2, prefix: cur() });
    setKpiLabel(0, 'EV / 100 ' + du());
    setKpi('kpi2', fuelPer100, { decimals: 2, prefix: cur() });
    setKpiLabel(1, 'Fuel / 100 ' + du());
    setKpi('kpi3', saveAnnual, { decimals: 0, prefix: cur() });
    setKpiLabel(2, 'Saved per year');

    if (saveAnnual > 0) {
      verdict('ok', 'The EV is cheaper to run',
        'About ' + money(saveAnnual, 0) + ' a year at ' + fmtInt(S.annualKm) + ' ' + du() +
        ', which is ' + money(saveAnnual / 12, 0) + ' a month.');
    } else {
      verdict('warn', 'Fuel wins at these prices',
        'With this mix of charging the EV costs ' + money(-saveAnnual, 0) + ' more per year. Shift more charging to home rates and it flips.');
    }

    var bar = $('socBar');
    if (bar) bar.hidden = true;

    var rows = [
      { group: 'Electricity' },
      { k: 'Home price', v: money(S.homePrice, 3) + ' / kWh' },
      { k: 'Public price', v: money(S.pubPrice, 3) + ' / kWh' },
      { k: 'Public share of charging', v: fmt(S.pubShare, 0) + '%' },
      { k: 'Blended price', v: money(blended, 3) + ' / kWh' },
      { k: 'Consumption used', v: fmt(whAdj, 0) + ' Wh/km' },
      { group: 'Cost per 100 ' + du() },
      { k: 'Electric', v: money(evPer100), cls: 'text-ok' },
      { k: 'Combustion', v: money(fuelPer100) },
      { k: 'Difference', v: (savePer100 >= 0 ? '-' : '+') + money(Math.abs(savePer100)), cls: savePer100 >= 0 ? 'text-ok' : 'text-danger' },
      { group: 'Per year at ' + fmtInt(S.annualKm) + ' ' + du() },
      { k: 'Electric', v: money(evAnnual, 0) },
      { k: 'Combustion', v: money(fuelAnnual, 0) },
      { k: 'Saving', v: money(saveAnnual, 0), cls: saveAnnual >= 0 ? 'text-ok' : 'text-danger' },
      { k: 'Over five years', v: money(saveAnnual * 5, 0) },
      { group: 'Tailpipe CO2 avoided' },
      { k: 'Combustion emits', v: fmtInt(fuelCo2Annual) + ' kg / year' },
      { k: 'Electric tailpipe', v: fmtInt(evCo2) + ' kg / year' },
      { note: 'Tailpipe only. Well-to-wheel depends on your grid mix, so we do not invent a number for it.' }
    ];
    breakdown(rows);

    // Cost against annual distance.
    var maxKm = Math.max(annualKm * 1.6, 10000);
    var evPts = [], icePts = [];
    for (var i = 0; i <= 30; i++) {
      var km = maxKm * i / 30;
      evPts.push({ x: kmToDist(km), y: evPer100 * km / 100 });
      icePts.push({ x: kmToDist(km), y: fuelPer100 * km / 100 });
    }
    chart([
      { points: icePts, color: '#f4515b', width: 1, label: 'Petrol / diesel' },
      { points: evPts, color: '#38fbd0', width: 1.1, fill: 'rgba(56,251,208,.12)', label: 'Electric' }
    ], {
      xMin: 0, yMin: 0,
      xTicks: [{ v: 0, label: '0' }, { v: kmToDist(maxKm) / 2, label: fmtInt(kmToDist(maxKm) / 2) }, { v: kmToDist(maxKm), label: fmtInt(kmToDist(maxKm)) + ' ' + du() }],
      yTicks: [{ v: 0, label: '0' }],
      title: 'Annual running cost against distance'
    });

    lastResult = { mode: 'compare', evPer100: evPer100, fuelPer100: fuelPer100, saveAnnual: saveAnnual };
  }

  function effUnitLabel() {
    return ({ whkm: 'Wh/km', whmi: 'Wh/mi', kwh100: 'kWh/100km', mikwh: 'mi/kWh' })[S.effUnit] || 'Wh/km';
  }

  /* ---------- orchestrator ---------- */
  var pending = null;
  function recompute() {
    readDom();
    $$('[data-mirror]').forEach(function (m) {
      var src = els[m.dataset.mirror];
      if (src) m.textContent = mirrorText(m.dataset.mirror, src.value);
    });
    $$('input[type=range]').forEach(paintRange);
    updateChargerTypeUi();

    if (!validate()) {
      verdict('danger', 'Check the highlighted fields', 'One or more inputs are outside a sensible range.');
      return;
    }
    if (S.mode === 'trip') computeTrip();
    else if (S.mode === 'charge') computeCharge();
    else if (S.mode === 'range') computeRange();
    else if (S.mode === 'compare') computeCompare();
    save();
  }
  function schedule() {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () { pending = null; recompute(); });
  }

  /* ---------- mode tabs ---------- */
  function updateTabs() {
    $$('.seg [data-mode]').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.mode === S.mode ? 'true' : 'false');
    });
  }
  function updateModeVisibility() {
    $$('[data-modes]').forEach(function (n) {
      var list = n.dataset.modes.split(/\s+/);
      n.hidden = list.indexOf(S.mode) === -1;
    });
    var t = $('resultsTitle');
    if (t) t.textContent = ({ trip: 'Trip result', charge: 'Charging session', range: 'Range today', compare: 'Cost comparison' })[S.mode];
  }
  function setMode(m) {
    S.mode = m;
    if (els.mode) els.mode.value = m;
    updateTabs();
    updateModeVisibility();
    recompute();
    if (W.track) W.track('calc_mode', { mode: m });
  }

  /* AC/DC choice changes which vehicle limit and default losses apply. */
  function updateChargerTypeUi() {
    var hint = $('chargerHint');
    if (!hint) return;
    var limit = S.chargerType === 'dc' ? S.dcMax : S.acMax;
    var eff = Math.min(S.chargerKw, limit);
    hint.textContent = 'Your car tops out at ' + fmt(limit, 1) + ' kW on ' + S.chargerType.toUpperCase() +
      ', so this session is capped at ' + fmt(eff, 1) + ' kW.';
  }

  /* ---------- vehicle preset picker ---------- */
  function openVehiclePicker() {
    var wrap = W.el('div');
    var search = W.el('input', { type: 'search', class: 'preset-search', placeholder: 'Search 48 models, e.g. Ioniq or Model 3', 'aria-label': 'Search vehicles' });
    var list = W.el('div', { class: 'preset-list' });
    wrap.appendChild(search);
    wrap.appendChild(list);

    function render(q) {
      q = (q || '').toLowerCase().trim();
      var items = D.vehicles.filter(function (v) { return !q || v.n.toLowerCase().indexOf(q) > -1; });
      if (!items.length) {
        list.innerHTML = '<p class="small dim" style="padding:12px">No match. Type your own numbers instead - any EV works.</p>';
        return;
      }
      list.innerHTML = '';
      items.forEach(function (v) {
        var b = W.el('button', { type: 'button', class: 'preset-item' });
        b.innerHTML = '<span class="pn"></span><span class="pd"></span>';
        b.querySelector('.pn').textContent = v.n;
        b.querySelector('.pd').textContent = v.cap + ' kWh · ' + v.wh + ' Wh/km · ' + v.dc + ' kW';
        b.addEventListener('click', function () {
          S.cap = v.cap;
          S.eff = Math.round(Engine.fromWhPerKm(v.wh, S.effUnit) * 10) / 10;
          S.dcMax = v.dc;
          S.acMax = v.ac;
          els.cap.value = S.cap;
          els.eff.value = S.eff;
          els.dcMax.value = S.dcMax;
          els.acMax.value = S.acMax;
          var nm = $('vehicleName');
          if (nm) nm.textContent = v.n;
          try { localStorage.setItem('wattrix.vehicle', v.n); } catch (e) { }
          m.close();
          recompute();
          W.toast(v.n + ' loaded');
          if (W.track) W.track('preset_vehicle', { vehicle: v.n });
        });
        list.appendChild(b);
      });
    }
    search.addEventListener('input', function () { render(search.value); });
    render('');
    var m = W.modal({ title: 'Pick your car', body: wrap });
  }

  function openChargerPicker() {
    var wrap = W.el('div');
    var list = W.el('div', { class: 'preset-list' });
    D.chargers.forEach(function (c) {
      var b = W.el('button', { type: 'button', class: 'preset-item' });
      b.innerHTML = '<span class="pn"></span><span class="pd"></span>';
      b.querySelector('.pn').textContent = c.n;
      b.querySelector('.pd').textContent = c.kw + ' kW ' + c.type.toUpperCase() + ' · ' + c.note;
      b.addEventListener('click', function () {
        S.chargerKw = c.kw;
        S.chargerType = c.type;
        S.lossPct = c.type === 'dc' ? 5 : 11;
        els.chargerKw.value = c.kw;
        els.chargerType.value = c.type;
        els.lossPct.value = S.lossPct;
        m.close();
        recompute();
        W.toast(c.n + ' selected');
      });
      list.appendChild(b);
    });
    wrap.appendChild(list);
    var m = W.modal({ title: 'Charging point', body: wrap });
  }

  /* ---------- saved scenarios ---------- */
  function getScenarios() {
    try { return JSON.parse(localStorage.getItem(SCENARIOS)) || []; } catch (e) { return []; }
  }
  function putScenarios(list) {
    try { localStorage.setItem(SCENARIOS, JSON.stringify(list.slice(0, 20))); } catch (e) { }
  }
  function renderScenarios() {
    var box = $('savedList');
    if (!box) return;
    var list = getScenarios();
    if (!list.length) {
      box.innerHTML = '<p class="small dim">Nothing saved yet. Set up a trip you repeat - the school run, the drive to the summer place - and keep it here.</p>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (sc, i) {
      var row = W.el('div', { class: 'saved-item' });
      row.innerHTML = '<div><div class="nm"></div><div class="mt"></div></div>' +
        '<div class="acts">' +
        '<button class="icon-btn" data-act="load" title="Load"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
        '<button class="icon-btn danger" data-act="del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>';
      row.querySelector('.nm').textContent = sc.name;
      row.querySelector('.mt').textContent = sc.meta || '';
      row.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'load') {
          FIELDS.forEach(function (k) { if (sc.state[k] !== undefined) S[k] = sc.state[k]; });
          syncToDom();
          recompute();
          W.toast('Loaded "' + sc.name + '"');
        } else {
          var l = getScenarios();
          l.splice(i, 1);
          putScenarios(l);
          renderScenarios();
          W.toast('Deleted');
        }
      });
      box.appendChild(row);
    });
  }
  function saveScenario() {
    var name = prompt('Name this scenario', defaultScenarioName());
    if (!name) return;
    var list = getScenarios();
    list.unshift({ name: name.slice(0, 60), meta: scenarioMeta(), state: Object.assign({}, S), ts: Date.now() });
    putScenarios(list);
    renderScenarios();
    W.toast('Saved');
  }
  function defaultScenarioName() {
    if (S.mode === 'trip') return fmtInt(S.dist) + ' ' + du() + ' trip';
    if (S.mode === 'charge') return fmt(S.cSocFrom, 0) + '-' + fmt(S.cSocTo, 0) + '% at ' + fmt(S.chargerKw, 0) + ' kW';
    if (S.mode === 'range') return 'Range at ' + fmt(S.tempC, 0) + '°C';
    return 'EV vs fuel';
  }
  function scenarioMeta() {
    return S.mode.toUpperCase() + ' · ' + fmt(S.cap, 0) + ' kWh · ' + fmt(adjustedWhPerKm(), 0) + ' Wh/km';
  }

  /* ---------- share / export ---------- */
  function shareLink() {
    var url = location.origin + location.pathname + '?' + toQuery();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        W.toast('Link copied - it carries every input');
      }, function () { fallbackShare(url); });
    } else fallbackShare(url);
    if (W.track) W.track('share_link', { mode: S.mode });
  }
  function fallbackShare(url) {
    var wrap = W.el('div');
    wrap.innerHTML = '<p class="small muted mb-3">Copy this link. It contains every input, nothing else.</p>';
    var i = W.el('input', { type: 'text', value: url, readonly: 'readonly', 'aria-label': 'Share link' });
    wrap.appendChild(i);
    W.modal({ title: 'Share this calculation', body: wrap });
    setTimeout(function () { i.select(); }, 80);
  }

  function exportCsv() {
    var rows = [['Wattrix export', new Date().toISOString()], [], ['Input', 'Value']];
    FIELDS.forEach(function (k) { rows.push([k, String(S[k])]); });
    rows.push([], ['Result', 'Value']);
    $$('#breakdown li').forEach(function (li) {
      var span = li.querySelector('span');
      if (span) rows.push([li.childNodes[0].textContent.trim(), span.textContent.trim()]);
      else rows.push([li.textContent.trim(), '']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wattrix-' + S.mode + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    W.toast('CSV downloaded');
  }

  function resetAll() {
    if (!confirm('Reset every input back to the defaults?')) return;
    try { localStorage.removeItem(STORE); } catch (e) { }
    S = Object.assign({}, DEFAULTS);
    var nm = $('vehicleName');
    if (nm) nm.textContent = 'Custom vehicle';
    try { localStorage.removeItem('wattrix.vehicle'); } catch (e) { }
    syncToDom();
    recompute();
    W.toast('Back to defaults');
  }

  /* ---------- collapsibles ---------- */
  function initCollapse() {
    $$('.collapse-btn').forEach(function (btn) {
      var body = document.getElementById(btn.getAttribute('aria-controls'));
      if (!body) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      body.dataset.collapsed = open ? 'false' : 'true';
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        body.dataset.collapsed = isOpen ? 'true' : 'false';
        body.style.maxHeight = isOpen ? '0px' : body.scrollHeight + 'px';
      });
      // keep height correct when contents change
      new MutationObserver(function () {
        if (body.dataset.collapsed === 'false') body.style.maxHeight = body.scrollHeight + 'px';
      }).observe(body, { childList: true, subtree: true, attributes: true });
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    if (!$('calcRoot')) return;

    FIELDS.forEach(function (k) { els[k] = $(k); });

    var hadSaved = load();
    var hadUrl = fromQuery();
    if (hadUrl) W.toast('Loaded a shared calculation');

    var vname = null;
    try { vname = localStorage.getItem('wattrix.vehicle'); } catch (e) { }
    if (vname && $('vehicleName')) $('vehicleName').textContent = vname;

    syncToDom();
    initCollapse();
    renderScenarios();

    // input binding
    $$('#calcRoot input, #calcRoot select').forEach(function (e) {
      e.addEventListener('input', schedule);
      e.addEventListener('change', schedule);
    });

    // mode tabs
    $$('.seg [data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });
    // keyboard: left/right across the tab strip
    var seg = document.querySelector('.seg[role=tablist]');
    if (seg) seg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = $$('[data-mode]', seg);
      var i = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
      var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[n].focus();
      setMode(tabs[n].dataset.mode);
    });

    // buttons
    var bind = function (id, fn) { var n = $(id); if (n) n.addEventListener('click', fn); };
    bind('pickVehicle', openVehiclePicker);
    bind('pickCharger', openChargerPicker);
    bind('btnShare', shareLink);
    bind('btnCsv', exportCsv);
    bind('btnPrint', function () { window.print(); });
    bind('btnReset', resetAll);
    bind('btnSaveScenario', saveScenario);

    // quick chips
    $$('[data-set]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var pairs = chip.dataset.set.split(';');
        pairs.forEach(function (p) {
          var kv = p.split('=');
          var k = kv[0].trim(), v = kv[1];
          if (!(k in S)) return;
          S[k] = typeof DEFAULTS[k] === 'number' ? num(v, DEFAULTS[k]) : (typeof DEFAULTS[k] === 'boolean' ? v === 'true' : v);
          if (els[k]) {
            if (els[k].type === 'checkbox') els[k].checked = !!S[k];
            else els[k].value = S[k];
            if (els[k].type === 'range') paintRange(els[k]);
          }
        });
        syncToDom();
        recompute();
      });
    });

    recompute();

    // deep link: #trip / #charge / #range / #compare
    var hash = (location.hash || '').replace('#', '');
    if (['trip', 'charge', 'range', 'compare'].indexOf(hash) > -1 && !hadUrl) setMode(hash);

    document.dispatchEvent(new CustomEvent('wattrix:calc-ready'));

    // Deferred by a tick: this script runs before tour.js, so firing
    // synchronously here would land before the tour is listening.
    // The flag covers any listener that attaches even later.
    if (!hadSaved && !hadUrl) {
      W.firstVisit = true;
      setTimeout(function () {
        document.dispatchEvent(new CustomEvent('wattrix:first-visit'));
      }, 0);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
