// Display-width aware string helpers (handles emoji / CJK as double-width).

const EMOJI_BMP = new Set([
  0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd, 0x25fe, 0x2614, 0x2615,
  0x267f, 0x2693, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea,
  0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd, 0x2705, 0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753,
  0x2754, 0x2755, 0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b55,
]);
for (let cp = 0x2648; cp <= 0x2653; cp++) EMOJI_BMP.add(cp);

export function charWidth(cp) {
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if ((cp >= 0x300 && cp <= 0x36f) || cp === 0x200b || cp === 0x200c || cp === 0x200d) return 0;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  if (EMOJI_BMP.has(cp)) return 2;
  return 1;
}

export function strWidth(str) {
  let w = 0;
  for (const ch of String(str ?? '')) w += charWidth(ch.codePointAt(0));
  return w;
}

function sliceWidth(str, maxW) {
  let out = '';
  let w = 0;
  for (const ch of str) {
    const cw = charWidth(ch.codePointAt(0));
    if (w + cw > maxW) break;
    out += ch;
    w += cw;
  }
  return out || [...str][0] || '';
}

export function truncate(str, maxW, ellipsis = '…') {
  const s = String(str ?? '');
  if (maxW <= 0) return '';
  if (strWidth(s) <= maxW) return s;
  let out = '';
  let w = 0;
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0));
    if (w + cw > maxW - 1) break;
    out += ch;
    w += cw;
  }
  return out + ellipsis;
}

export function padRight(str, w) {
  const s = truncate(str, w);
  return s + ' '.repeat(Math.max(0, w - strWidth(s)));
}

export function wrap(text, maxW) {
  if (maxW <= 0) return [];
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let word of words) {
    while (strWidth(word) > maxW) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      const head = sliceWidth(word, maxW);
      lines.push(head);
      word = word.slice(head.length);
    }
    if (!word) continue;
    if (!cur) cur = word;
    else if (strWidth(cur) + 1 + strWidth(word) <= maxW) cur += ' ' + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}
