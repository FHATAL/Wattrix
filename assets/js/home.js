/* =========================================================
   WATTRIX — home page
   Live hero mini-calculator + the vehicle marquee.
   Reuses the same engine the full calculator runs on.
   =======================================================*/
(function () {
  'use strict';

  var W = window.Wattrix || {};
  var D = window.WATTRIX_DATA;
  var E = window.WattrixEngine;
  function $(id) { return document.getElementById(id); }

  /* ---------- hero mini calculator ---------- */
  function initMini() {
    var battery = $('mBattery'), eff = $('mEff'), dist = $('mDist'),
      price = $('mPrice'), temp = $('mTemp');
    if (!battery || !E) return;

    function paint() {
      var min = parseFloat(temp.min), max = parseFloat(temp.max), v = parseFloat(temp.value);
      temp.style.setProperty('--pct', ((v - min) / (max - min) * 100) + '%');
    }

    function run() {
      var cap = parseFloat(battery.value) || 0;
      var whRated = parseFloat(eff.value) || 0;
      var km = parseFloat(dist.value) || 0;
      var p = parseFloat(price.value) || 0;
      var t = parseFloat(temp.value);

      $('mTempVal').textContent = t + '°C';
      paint();

      var factor = E.conditionFactor({ tempC: t, profile: 'mixed', extraLoad: 'none', winterTyres: false });
      var whAdj = whRated * factor;
      var kwh = E.tripEnergy(km, whAdj);
      var fullRange = whAdj > 0 ? cap * 1000 / whAdj : 0;
      var cost = kwh * p;

      W.countUp($('mEnergy'), kwh, { decimals: 1, suffix: ' kWh' });
      W.countUp($('mRange'), fullRange, { decimals: 0, suffix: ' km' });
      W.countUp($('mCost'), cost, { decimals: 2, prefix: '€' });

      var note = $('mNote');
      if (kwh > cap) {
        note.innerHTML = '<span class="text-warn">That is more than the battery holds - you would need to charge on the way. The full tool plans the stops.</span>';
      } else if (factor > 1.2) {
        note.innerHTML = '<span class="text-warn">At ' + t + '°C consumption is ' + Math.round((factor - 1) * 100) +
          '% above rated, so range drops to ' + Math.round(fullRange) + ' km.</span>';
      } else {
        note.textContent = 'Adjust anything. The full tool adds charging stops, taper curves and comparisons.';
      }
    }

    [battery, eff, dist, price, temp].forEach(function (el) {
      el.addEventListener('input', run);
      el.addEventListener('change', run);
    });
    run();
  }

  /* ---------- vehicle marquee ---------- */
  function initMarquee() {
    var track = $('carMarquee');
    if (!track || !D) return;
    var picks = D.vehicles.filter(function (_, i) { return i % 2 === 0; }).slice(0, 18);
    // Duplicated once so the -50% scroll loops seamlessly.
    var html = picks.concat(picks).map(function (v) {
      return '<span class="marquee-item"><b>' + v.n + '</b> ' + v.cap + ' kWh</span>';
    }).join('');
    track.innerHTML = html;
  }

  function boot() { initMini(); initMarquee(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
