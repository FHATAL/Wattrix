import { continueRender, delayRender, staticFile } from 'remotion';

// Self-hosted copies of the site's fonts (SIL OFL), so renders never depend on the network.
const faces: Array<[string, string]> = [
  ['Space Grotesk', 'fonts/SpaceGrotesk.woff2'],
  ['Inter', 'fonts/Inter.woff2'],
  ['JetBrains Mono', 'fonts/JetBrainsMono.woff2'],
];

let started = false;
export function loadFonts(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading fonts');
  Promise.all(
    faces.map(async ([family, file]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, { weight: '100 900' });
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}
