// A cell-based screen buffer with row-level diffing for flicker-free redraws.

import { SEQ, fgParam, bgParam } from './color.js';
import { charWidth, strWidth, truncate } from './text.js';

export const BOX = {
  double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝' },
  single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘' },
  round: { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯' },
  heavy: { h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛' },
};

function sgr(c) {
  const p = ['0'];
  if (c.b) p.push('1');
  if (c.d) p.push('2');
  if (c.u) p.push('4');
  if (c.fg) p.push(fgParam(c.fg));
  if (c.bg) p.push(bgParam(c.bg));
  return `\x1b[${p.join(';')}m`;
}

export class Screen {
  constructor(w, h) {
    this.prevRows = null;
    this.resize(w, h);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.prevRows = null;
    this.clear();
  }

  invalidate() {
    this.prevRows = null;
  }

  clear() {
    const n = this.w * this.h;
    this.cells = new Array(n);
    for (let i = 0; i < n; i++) {
      this.cells[i] = { ch: ' ', fg: null, bg: null, b: false, d: false, u: false, solid: false };
    }
  }

  cell(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.cells[y * this.w + x];
  }

  /**
   * Write one cell. A missing `bg` keeps whatever background is already there,
   * so text can be layered on top of highlighted rows and modal panels.
   */
  set(x, y, ch, st = {}) {
    const c = this.cell(x, y);
    if (!c) return;
    const old = c.ch;
    if (old === '' && ch !== '') {
      const l = this.cell(x - 1, y);
      if (l) l.ch = ' ';
    }
    if (old && old !== ' ' && charWidth(old.codePointAt(0)) === 2) {
      const r = this.cell(x + 1, y);
      if (r && r.ch === '') r.ch = ' ';
    }
    c.ch = ch;
    c.fg = st.fg ?? null;
    if (st.bg !== undefined) c.bg = st.bg;
    c.b = !!st.bold;
    c.d = !!st.dim;
    c.u = !!st.underline;
    c.solid = c.solid || ch !== ' ' || !!c.bg || !!st.solid;
  }

  put(x, y, str, st = {}) {
    const s = String(str ?? '');
    if (y < 0 || y >= this.h) return x + strWidth(s);
    for (const ch of s) {
      const cw = charWidth(ch.codePointAt(0));
      if (cw === 0) continue;
      if (x >= this.w) break;
      if (cw === 2) {
        if (x + 1 >= this.w) {
          if (x >= 0) this.set(x, y, ' ', st);
          x += 1;
          break;
        }
        if (x >= 0) {
          this.set(x, y, ch, st);
          this.set(x + 1, y, '', st);
        }
      } else if (x >= 0) {
        this.set(x, y, ch, st);
      }
      x += cw;
    }
    return x;
  }

  text(x, y, str, st = {}, maxW) {
    if (maxW !== undefined && maxW <= 0) return x;
    return this.put(x, y, maxW !== undefined ? truncate(str, maxW) : str, st);
  }

  /** Draw a list of [text, style] segments, truncating at maxW. */
  segs(x, y, list, maxW = Infinity) {
    let used = 0;
    for (const seg of list) {
      if (!seg) continue;
      const [str, st] = Array.isArray(seg) ? seg : [seg, {}];
      const room = maxW - used;
      if (room <= 0) break;
      const s = strWidth(str) > room ? truncate(str, room) : str;
      used = this.put(x + used, y, s, st || {}) - x;
    }
    return x + used;
  }

  fill(x, y, w, h, st = {}, ch = ' ') {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch, st);
  }

  hline(x, y, w, ch, st) {
    for (let i = 0; i < w; i++) this.set(x + i, y, ch, st);
  }

  box(x, y, w, h, o = {}) {
    if (w < 2 || h < 2) return;
    const b = BOX[o.kind || 'double'];
    const at = (cx, cy) => (o.styleAt ? o.styleAt(cx, cy) : o.st) || {};
    for (let i = 1; i < w - 1; i++) {
      this.set(x + i, y, b.h, at(x + i, y));
      this.set(x + i, y + h - 1, b.h, at(x + i, y + h - 1));
    }
    for (let j = 1; j < h - 1; j++) {
      this.set(x, y + j, b.v, at(x, y + j));
      this.set(x + w - 1, y + j, b.v, at(x + w - 1, y + j));
    }
    this.set(x, y, b.tl, at(x, y));
    this.set(x + w - 1, y, b.tr, at(x + w - 1, y));
    this.set(x, y + h - 1, b.bl, at(x, y + h - 1));
    this.set(x + w - 1, y + h - 1, b.br, at(x + w - 1, y + h - 1));
    if (o.title && w > 6) {
      this.put(x + 2, y, truncate(` ${o.title} `, w - 4), o.titleSt || at(x + 2, y));
    }
  }

  rowString(y, isLast) {
    let s = '';
    let lastKey = null;
    // Skip the bottom-right cell so terminals never scroll.
    const end = isLast ? this.w - 1 : this.w;
    for (let x = 0; x < end; x++) {
      const c = this.cells[y * this.w + x];
      if (c.ch === '') continue;
      const key = `${c.fg}|${c.bg}|${c.b}|${c.d}|${c.u}`;
      if (key !== lastKey) {
        s += sgr(c);
        lastKey = key;
      }
      s += c.ch;
    }
    return s + SEQ.reset;
  }

  flush(out) {
    const rows = [];
    for (let y = 0; y < this.h; y++) rows.push(this.rowString(y, y === this.h - 1));
    let buf = '';
    for (let y = 0; y < this.h; y++) {
      if (!this.prevRows || this.prevRows[y] !== rows[y]) buf += `\x1b[${y + 1};1H` + rows[y];
    }
    this.prevRows = rows;
    if (buf) out.write(buf);
  }

  toPlain() {
    const rows = [];
    for (let y = 0; y < this.h; y++) {
      let s = '';
      for (let x = 0; x < this.w; x++) s += this.cells[y * this.w + x].ch;
      rows.push(s);
    }
    return rows.join('\n');
  }

  toAnsi() {
    const rows = [];
    for (let y = 0; y < this.h; y++) rows.push(this.rowString(y, false));
    return rows.join('\n');
  }
}
