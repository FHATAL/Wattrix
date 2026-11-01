# Wattrix promo ad

A 22.5 second 3D motion-design ad for wattrix.app, built in code with
[Remotion](https://www.remotion.dev/) (React + TypeScript). Two cuts from
one source:

| Composition | Size | Use |
|---|---|---|
| `WattrixWide` | 1920x1080 (16:9) | YouTube, LinkedIn, X, site embed |
| `WattrixTall` | 1080x1920 (9:16) | Reels, TikTok, Shorts, Stories |

## Story

| Time | Scene | What it shows |
|---|---|---|
| 0.0-3.7s | Hook | "kWh ÷ kW" gets struck out. "Charging slows down as you fill up." |
| 3.7-8.3s | Taper | 3D extruded charge curve (the calculator's real DC taper), live kW/time readout, "kWh÷kW says 21 min / Wattrix says 26 min" |
| 8.3-16.3s | Features | 3D card carousel of the real Trip, Charge, Range and EV vs fuel result cards |
| 16.3-19s | Proof | Site in a 3D browser window plus free / no sign-up / offline / 48 presets / installable |
| 19-22.5s | CTA | Extruded bolt, wordmark, "Plan your drive free", wattrix.app, "by FHATAL" |

Every number on screen is either the calculator's own output for the scenarios
in `scripts/capture.mjs` or a figure the site already publishes (`llms.txt`).
If the engine changes, re-run the capture and check the copy in
`src/scenes/Features.tsx` and `src/scenes/Taper.tsx` still matches.

## Commands

```bash
npm install
npm run capture   # re-shoot the app UI into public/shots (serves the repo root locally)
npm run studio    # live preview / scrub in the browser
npm run render    # both cuts -> out/final: MP4 (-14 LUFS), WebM, poster JPGs
```

Timing and sound cues live in `src/timeline.json`; `scripts/sfx.py`
synthesises the sound-effect bed from it (numpy only, nothing to license).
To use a music track, mix it under `out/raw/*.mp4` or add a second `<Audio>`
in `src/Ad.tsx`.

## Embedding on the site

```html
<video autoplay muted loop playsinline preload="metadata"
       poster="/assets/video/wattrix-ad-poster-16x9.jpg"
       style="width:100%;height:auto;border-radius:20px">
  <source src="/assets/video/wattrix-ad-16x9.webm" type="video/webm">
  <source src="/assets/video/wattrix-ad-16x9.mp4" type="video/mp4">
</video>
```

Rendered files are not committed (see `.gitignore`); they are delivered
separately so the repo stays small.

Fonts in `public/fonts` are Space Grotesk, Inter and JetBrains Mono (SIL Open
Font License), self-hosted so renders never hit the network.
