# Wattrix

**The EV charging matrix.** Energy, charging time, real range and running costs
for any electric car - worked out entirely in your browser.

Live at [wattrix.app](https://wattrix.app)

No backend. No build step. No account. Open `index.html` and it works.

---

## What it does

Four tools sharing one car profile:

| Tool | Answers |
|---|---|
| **Trip** | Do I make it on one charge? How many stops, how long, what does it cost door to door? |
| **Charge** | How long is this session really, with the taper curve modelled properly? |
| **Range** | How far can I actually go in today's temperature, at today's speed, with this load? |
| **EV vs fuel** | Cost per 100 km and per year against petrol, diesel or a hybrid. |

Plus: 48 car presets, 10 charge-point presets, km/mi and four consumption
units, saved scenarios, shareable links, CSV export, print/PDF, a guided
tour, and full offline support.

## Why it is not just kWh divided by kW

Two things most calculators skip:

**Charging tapers.** Power falls as the pack fills. Wattrix walks each session
in half-percent steps and takes the lower of what the charge point supplies and
what the car accepts at that state of charge. DC follows a taper curve - flat to
about 35%, easing through the middle, a fraction of peak past 85%. Below 10 °C
the DC curve is derated further. AC is flat until the BMS balances near the top.

**Conditions matter.** Rated consumption is adjusted by a multiplier built from:

| Factor | Effect |
|---|---|
| Temperature | below 20 °C, ~1.1% per degree (so ~1.33× at -10 °C) |
| Speed | city 0.90× · mixed 1.00× · 100 km/h 1.16× · 120 km/h 1.28× · 140 km/h 1.45× |
| Load | full car 1.08× · roof box 1.16× · trailer 1.60× |
| Winter tyres | 1.05× |

They multiply, which is why a cold motorway run with a roof box is so much worse
than any single factor suggests.

**Cost is metered energy, not battery energy.** Charging losses (~5% DC, ~11% AC)
sit between the two and you pay for them, so they are billed.

## Privacy

There is no server, so there is nothing to send anything to. Your inputs, saved
scenarios and cookie choice live in `localStorage` on your device.

Analytics is opt-in: reject and the Google Analytics script is never loaded at
all, not loaded-and-muted. Consent Mode v2 defaults are set before anything
measures, the choice expires after 180 days, and withdrawing it clears the
analytics cookies immediately. Preferences are reachable from the footer of
every page.

## Project layout

```
index.html          landing page with a live hero calculator
calculator.html     the four-tool app
reference.html      computed charging/range/cost tables (SEO + citation asset)
use-cases.html      eight worked examples, each deep-linking into the calculator
about.html          method, accuracy limits, privacy, FAQ
404.html
llms.txt            site summary and key figures for AI answer engines
sw.js               service worker (offline)
manifest.json       PWA manifest
assets/css/style.css
assets/js/app.js         loader, nav, reveal, toasts, modals, cookie consent, SW
assets/js/data.js        vehicle / charger / fuel reference data + taper curves
assets/js/calculator.js  engine (exported as window.WattrixEngine) + calculator UI
assets/js/tour.js        guided tour
assets/js/home.js        hero mini-calculator + marquee
assets/icons/            PWA icons
assets/og/               Open Graph share images (1200x630)
```

Every figure on `reference.html` is generated from the calculation engine
itself, so the published tables can never drift from what the calculator
returns. Regenerate them if the engine changes.

`WattrixEngine` is pure and side-effect free - `session()`, `plan()`,
`tripEnergy()`, `conditionFactor()` and the unit conversions can be tested or
reused on their own.

## Deep links

The calculator reads its whole state from the query string, which is what the
Share button copies and what the use-case pages link to:

```
calculator.html?mode=trip&cap=77&eff=186&dist=620&socStart=100
               &socReserve=12&chargerKw=150&chargerType=dc&price=0.45
               &tempC=12&profile=mw120
```

`#trip`, `#charge`, `#range` and `#compare` select a tool. `?tour=1` runs the
guided tour.

## Development

Static files. Serve the directory with anything:

```bash
npx http-server -p 8080 .
```

The service worker only registers over HTTPS or on localhost. After changing a
cached asset, bump `VERSION` in `sw.js` so returning visitors pick it up.

## Accuracy

Planning estimates, not promises. Elevation is not modelled, charging curves are
generic rather than your specific car, and battery degradation is not accounted
for - reduce the usable capacity yourself on an older car. Consumption is the
biggest source of error, so use your own long-term average. **Always keep the
reserve you set.**

## Licence and credits

Built and maintained by [FHATAL](https://fhatal.com).
Corrections to the preset data are welcome: support@fhatal.com
