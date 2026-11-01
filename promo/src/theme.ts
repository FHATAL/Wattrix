// Wattrix brand tokens, mirrored from assets/css/style.css on the site.
export const C = {
  bg: '#050507',
  bgSub: '#0a0b10',
  card: '#101320',
  text: '#eef2f7',
  muted: '#9aa6b8',
  dim: '#647084',
  violet: '#7559ff',
  mint: '#38fbd0',
  cyan: '#2dd4ff',
  warn: '#f5a524',
  danger: '#f4515b',
  ember: '#FF5500',
  emberHi: '#FDAD00',
  line: 'rgba(255,255,255,.08)',
} as const;

export const GRAD = `linear-gradient(135deg, ${C.violet}, ${C.mint})`;

export const F = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const SITE = 'wattrix.app';
