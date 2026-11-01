// Captures real UI panels from the Wattrix site into public/shots.
// Usage: node scripts/capture.mjs  (serves the repo root on :8765 while running)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const outDir = path.resolve(here, '../public/shots');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: repoRoot, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 800));

const consent = JSON.stringify({ v: 3, ts: new Date().toISOString(), necessary: true, analytics: false, marketing: false });

const shots = [
  // Trip: Helsinki to Oulu-ish distance, winter-ish
  { name: 'trip', query: 'mode=trip&dist=610&tempC=-5&socStart=90&stopTop=80' },
  // Charge: 75 kWh, 10 -> 80 on 150 kW (figure published in llms.txt: ~26 min)
  { name: 'charge', query: 'mode=charge&cSocFrom=10&cSocTo=80&chargerKw=150&tempC=20' },
  // Range at -10 C
  { name: 'range', query: 'mode=range&tempC=-10&rSoc=100' },
  // EV vs fuel
  { name: 'compare', query: 'mode=compare' },
];

const browser = await chromium.launch();
try {
  // Fresh context per shot so saved calculator state never leaks between scenarios.
  const freshPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await ctx.addInitScript((c) => {
      try { localStorage.setItem('wattrix.consent.v3', c); } catch (e) {}
    }, consent);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.error('pageerror', e.message));
    return p;
  };
  let page;

  for (const s of shots) {
    page = await freshPage();
    await page.goto(`${BASE}/calculator.html?${s.query}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.cookie-banner,.toast,.install-nudge,#installNudge{display:none!important}' });
    const card = page.locator('#resultsCard');
    await card.screenshot({ path: path.join(outDir, `${s.name}-card.png`) });
    const title = await page.locator('#resultsTitle').textContent();
    console.log(s.name, '->', title?.trim());
  }

  page = await freshPage();
  // Home hero
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.cookie-banner,.toast{display:none!important}' });
  await page.screenshot({ path: path.join(outDir, 'desktop-home.png') });
} finally {
  await browser.close();
  server.kill();
}
