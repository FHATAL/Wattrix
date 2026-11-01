// Renders verification stills: node scripts/stills.mjs WattrixWide 30,120,300
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const [id = 'WattrixWide', framesArg = '30,150,300,520,640'] = process.argv.slice(2);
const frames = framesArg.split(',').map(Number);
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id, browserExecutable: fs.existsSync(browserExecutable) ? browserExecutable : null });
const outDir = path.join(root, 'out/stills');
fs.mkdirSync(outDir, { recursive: true });
for (const frame of frames) {
  const output = path.join(outDir, `${id}-${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output, browserExecutable: fs.existsSync(browserExecutable) ? browserExecutable : null, scale: 0.5 });
  console.log(output);
}
