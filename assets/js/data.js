/* =========================================================
   WATTRIX — reference data
   cap  = usable battery (kWh)
   wh   = typical real-world consumption (Wh/km, mixed driving)
   dc   = peak DC charging power (kW)
   ac   = max onboard AC charger (kW)
   Figures are typical published/real-world values used as
   starting points. Always override with your own numbers.
   =======================================================*/
window.WATTRIX_DATA = (function () {
  'use strict';

  var vehicles = [
    { n: 'Tesla Model 3 RWD', cap: 57.5, wh: 145, dc: 170, ac: 11 },
    { n: 'Tesla Model 3 Long Range', cap: 75, wh: 155, dc: 250, ac: 11 },
    { n: 'Tesla Model Y RWD', cap: 57.5, wh: 158, dc: 170, ac: 11 },
    { n: 'Tesla Model Y Long Range', cap: 75, wh: 168, dc: 250, ac: 11 },
    { n: 'Tesla Model S Long Range', cap: 95, wh: 178, dc: 250, ac: 11 },
    { n: 'Hyundai Ioniq 5 77 kWh', cap: 74, wh: 178, dc: 235, ac: 11 },
    { n: 'Hyundai Ioniq 6 77 kWh', cap: 74, wh: 152, dc: 233, ac: 11 },
    { n: 'Hyundai Kona Electric 65', cap: 65.4, wh: 160, dc: 102, ac: 11 },
    { n: 'Kia EV6 Long Range', cap: 74, wh: 172, dc: 240, ac: 11 },
    { n: 'Kia EV3 Long Range', cap: 78, wh: 158, dc: 128, ac: 11 },
    { n: 'Kia Niro EV', cap: 64.8, wh: 165, dc: 72, ac: 11 },
    { n: 'VW ID.3 Pro 58', cap: 58, wh: 165, dc: 120, ac: 11 },
    { n: 'VW ID.4 Pro 77', cap: 77, wh: 186, dc: 135, ac: 11 },
    { n: 'VW ID.7 Pro', cap: 77, wh: 165, dc: 175, ac: 11 },
    { n: 'Skoda Enyaq 85', cap: 77, wh: 180, dc: 135, ac: 11 },
    { n: 'Cupra Born 58', cap: 58, wh: 168, dc: 120, ac: 11 },
    { n: 'Audi Q4 e-tron 45', cap: 77, wh: 185, dc: 135, ac: 11 },
    { n: 'BMW i4 eDrive40', cap: 81.3, wh: 170, dc: 205, ac: 11 },
    { n: 'BMW iX1 xDrive30', cap: 64.7, wh: 182, dc: 130, ac: 11 },
    { n: 'BMW iX xDrive50', cap: 105.2, wh: 205, dc: 195, ac: 11 },
    { n: 'Mercedes EQA 250', cap: 66.5, wh: 180, dc: 100, ac: 11 },
    { n: 'Mercedes EQE 350+', cap: 89, wh: 175, dc: 170, ac: 11 },
    { n: 'Polestar 2 Long Range', cap: 79, wh: 176, dc: 205, ac: 11 },
    { n: 'Volvo EX30 Extended', cap: 64, wh: 160, dc: 153, ac: 11 },
    { n: 'Volvo EX40 / XC40 ER', cap: 78, wh: 185, dc: 200, ac: 11 },
    { n: 'Renault Megane E-Tech 60', cap: 60, wh: 165, dc: 130, ac: 22 },
    { n: 'Renault Zoe R135 52', cap: 52, wh: 168, dc: 46, ac: 22 },
    { n: 'Renault 5 E-Tech 52', cap: 52, wh: 150, dc: 100, ac: 11 },
    { n: 'Peugeot e-208 51', cap: 48.1, wh: 155, dc: 100, ac: 11 },
    { n: 'Fiat 500e 42', cap: 37.3, wh: 145, dc: 85, ac: 11 },
    { n: 'Dacia Spring 45', cap: 26.8, wh: 142, dc: 30, ac: 7.4 },
    { n: 'MG4 Long Range 64', cap: 61.7, wh: 168, dc: 135, ac: 11 },
    { n: 'MG ZS EV Long Range', cap: 68.3, wh: 178, dc: 92, ac: 11 },
    { n: 'BYD Atto 3', cap: 60, wh: 182, dc: 88, ac: 11 },
    { n: 'BYD Seal AWD', cap: 82.5, wh: 178, dc: 150, ac: 11 },
    { n: 'Nissan Leaf 40 kWh', cap: 36, wh: 168, dc: 46, ac: 6.6 },
    { n: 'Nissan Ariya 87', cap: 87, wh: 190, dc: 130, ac: 22 },
    { n: 'Toyota bZ4X FWD', cap: 64, wh: 175, dc: 150, ac: 11 },
    { n: 'Ford Mustang Mach-E ER', cap: 88, wh: 195, dc: 150, ac: 11 },
    { n: 'Ford F-150 Lightning ER', cap: 131, wh: 300, dc: 155, ac: 19.2 },
    { n: 'Porsche Taycan 89 kWh', cap: 83.7, wh: 196, dc: 270, ac: 11 },
    { n: 'Rivian R1T Large Pack', cap: 135, wh: 250, dc: 220, ac: 11 },
    { n: 'Chevrolet Bolt EUV', cap: 65, wh: 165, dc: 55, ac: 11 },
    { n: 'Opel Corsa Electric 51', cap: 48.1, wh: 155, dc: 100, ac: 11 },
    { n: 'Mini Cooper SE (J01)', cap: 49.2, wh: 155, dc: 95, ac: 11 },
    { n: 'Smart #1 Pro+', cap: 66, wh: 178, dc: 150, ac: 22 },
    { n: 'Citroen e-C3 44', cap: 44, wh: 158, dc: 100, ac: 7.4 },
    { n: 'Honda e:Ny1', cap: 61.9, wh: 185, dc: 78, ac: 11 }
  ];

  var chargers = [
    { n: 'Schuko household socket', kw: 2.3, type: 'ac', note: '230 V / 10 A' },
    { n: 'Home wallbox 1-phase 16 A', kw: 3.7, type: 'ac', note: '230 V' },
    { n: 'Home wallbox 1-phase 32 A', kw: 7.4, type: 'ac', note: '230 V' },
    { n: 'Wallbox 3-phase 11 kW', kw: 11, type: 'ac', note: '400 V / 16 A' },
    { n: 'Wallbox 3-phase 22 kW', kw: 22, type: 'ac', note: '400 V / 32 A' },
    { n: 'Public DC 50 kW', kw: 50, type: 'dc', note: 'older CCS' },
    { n: 'Public DC 100 kW', kw: 100, type: 'dc', note: 'common CCS' },
    { n: 'Public DC 150 kW', kw: 150, type: 'dc', note: 'HPC' },
    { n: 'Public DC 250 kW', kw: 250, type: 'dc', note: 'Supercharger V3' },
    { n: 'Public DC 350 kW', kw: 350, type: 'dc', note: 'Ionity / HPC max' }
  ];

  var fuels = [
    { n: 'Petrol (E10)', l100: 7.0, price: 1.75, co2: 2.31 },
    { n: 'Diesel', l100: 5.8, price: 1.80, co2: 2.64 },
    { n: 'Hybrid petrol', l100: 4.8, price: 1.75, co2: 2.31 },
    { n: 'Large petrol SUV', l100: 9.5, price: 1.75, co2: 2.31 }
  ];

  /* DC charging taper. Fraction of the car's peak DC power that is
     actually available at a given state of charge. Generic curve -
     real cars differ, but the shape (fast to ~50%, slow after 80%)
     holds for every pack on the market. */
  var dcCurve = [
    [0, 0.55], [5, 0.85], [10, 1.00], [35, 1.00], [45, 0.94],
    [55, 0.84], [65, 0.70], [75, 0.54], [85, 0.36], [92, 0.24],
    [100, 0.12]
  ];

  /* AC is limited by the onboard charger, so it is flat until the
     BMS balances cells near the top. */
  var acCurve = [[0, 1], [88, 1], [95, 0.8], [100, 0.5]];

  function interp(curve, x) {
    if (x <= curve[0][0]) return curve[0][1];
    for (var i = 1; i < curve.length; i++) {
      if (x <= curve[i][0]) {
        var a = curve[i - 1], b = curve[i];
        var t = (x - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return curve[curve.length - 1][1];
  }

  return {
    vehicles: vehicles,
    chargers: chargers,
    fuels: fuels,
    dcFactor: function (soc) { return interp(dcCurve, soc); },
    acFactor: function (soc) { return interp(acCurve, soc); },
    KM_PER_MI: 1.609344
  };
})();
