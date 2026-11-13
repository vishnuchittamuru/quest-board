// Color handling: 24-bit truecolor with automatic 256-color fallback.

export const SEQ = {
  reset: '\x1b[0m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  altOn: '\x1b[?1049h',
  altOff: '\x1b[?1049l',
  clear: '\x1b[2J\x1b[H',
  bell: '\x07',
};

export function detectTrueColor(env = process.env) {
  if (env.QUEST_COLOR === '256') return false;
  if (env.QUEST_COLOR === 'truecolor') return true;
  const ct = String(env.COLORTERM || '').toLowerCase();
  if (ct.includes('truecolor') || ct.includes('24bit')) return true;
  if (env.WT_SESSION) return true; // Windows Terminal
  if (['vscode', 'iTerm.app', 'WezTerm'].includes(env.TERM_PROGRAM)) return true;
  return false;
}

let trueColor = detectTrueColor();
const fgCache = new Map();
const bgCache = new Map();

export function setTrueColor(on) {
  trueColor = !!on;
  fgCache.clear();
  bgCache.clear();
}

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a, b, t) {
  if (!a) return b;
  if (!b || t <= 0) return a;
  const k = Math.min(1, t);
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * k));
}

export const lighten = (hex, t) => mix(hex, '#ffffff', t);
export const darken = (hex, t) => mix(hex, '#000000', t);

function rgbTo256(r, g, b) {
  if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.min(23, Math.round((r - 8) / 10));
  }
  const q = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40));
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
}

export function fgParam(hex) {
  let v = fgCache.get(hex);
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = trueColor ? `38;2;${r};${g};${b}` : `38;5;${rgbTo256(r, g, b)}`;
    fgCache.set(hex, v);
  }
  return v;
}

export function bgParam(hex) {
  let v = bgCache.get(hex);
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = trueColor ? `48;2;${r};${g};${b}` : `48;5;${rgbTo256(r, g, b)}`;
    bgCache.set(hex, v);
  }
  return v;
}

/** Wrap text in ANSI styling (used by CLI output and prompt wizards). */
export function paint(text, { fg, bg, bold } = {}) {
  const p = [];
  if (bold) p.push('1');
  if (fg) p.push(fgParam(fg));
  if (bg) p.push(bgParam(bg));
  if (!p.length) return String(text);
  return `\x1b[${p.join(';')}m${text}${SEQ.reset}`;
}

export function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}
