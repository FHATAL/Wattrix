import { Config } from '@remotion/cli/config';
import fs from 'node:fs';

// Reuse the preinstalled Playwright headless shell when present (no Chrome download needed).
// Set REMOTION_BROWSER to override, or remove this to let Remotion fetch its own.
const candidates = [
  process.env.REMOTION_BROWSER,
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
].filter(Boolean) as string[];
const found = candidates.find((p) => fs.existsSync(p));
if (found) Config.setBrowserExecutable(found);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
