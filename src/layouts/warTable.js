// Layout 2: War Table (Kanban grouped by Realm + Pinned Daily Rituals Column).
// Column 0 is always "DAILY RITUALS" with the Commission Chest bar.
// Columns 1..N are the Realms, each showing Realm Health and [DUSTY] warnings.
// Users can navigate columns/cards with Arrow/hjkl keys and move quest cards
// across Realms with < / > (or H / L).

import { darken, mix } from '../color.js';
import { truncate } from '../text.js';
import {
  RANKS,
  CADENCES,
  computeQuestHp,
  getDustyRealms,
  isRitualDueToday,
  renderChargeBar,
  getCommissionStatus,
} from '../state.js';
import { drawBar } from './chrome.js';

export function buildWarTableColumns(state) {
  const cols = [
    {
      id: '__rituals__',
      title: 'DAILY RITUALS',
      isRituals: true,
      items: [...(state.rituals || [])].sort((a, b) => {
        if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
        return (b.streak || 0) - (a.streak || 0);
      }),
    },
  ];

  const realms = new Set(state.realms || []);
  for (const q of state.quests) {
    if (q.realm) realms.add(q.realm);
  }

  for (const r of realms) {
    const open = state.quests
      .filter((q) => q.status === 'open' && (q.realm || 'Main Campaign') === r)
      .sort((a, b) => {
        if (a.inPouch !== b.inPouch) return a.inPouch ? -1 : 1;
        return (RANKS[a.rank]?.order ?? 2) - (RANKS[b.rank]?.order ?? 2);
      });
    const doneCount = state.quests.filter(
      (q) => q.status === 'done' && (q.realm || 'Main Campaign') === r
    ).length;
    cols.push({
      id: r,
      title: r,
      isRituals: false,
      items: open,
      doneCount,
      totalCount: open.length + doneCount,
    });
  }

  return cols;
}

export function renderWarTableLayout(screen, tui, palette, biome) {
  const w = screen.w;
  const h = screen.h;
  const v = biome.vocab;
  const topY = 4;
  const bottomY = h - 2;
  const availH = bottomY - topY;
  if (availH < 8) return;

  const columns = buildWarTableColumns(tui.state);
  tui.warCol = Math.max(0, Math.min(tui.warCol || 0, columns.length - 1));
  const activeCol = columns[tui.warCol];
  if (activeCol) {
    tui.warRow = Math.max(0, Math.min(tui.warRow || 0, Math.max(0, activeCol.items.length - 1)));
  }

  // How many columns fit cleanly at min width 26?
  const minColW = 26;
  const visibleColsCount = Math.max(1, Math.min(columns.length, Math.floor(w / minColW)));
  const startCol = Math.max(
    0,
    Math.min(tui.warCol - Math.floor(visibleColsCount / 2), columns.length - visibleColsCount)
  );
  const colW = Math.floor(w / visibleColsCount);
  const dustyRealms = getDustyRealms(tui.state);

  // Subtle top bar showing horizontal scroll & active selection
  screen.fill(0, topY, w, 1, { fg: palette.muted, bg: palette.panelBg });
  const navHint = ` ⚔ WAR TABLE (${tui.warCol + 1}/${columns.length} Columns) · [←/→] Column · [↑/↓] Card · [</>] Move ${v.realm} · [Enter] Battle Arena`;
  screen.text(0, topY, navHint, { fg: palette.accent, bg: palette.panelBg, bold: true }, w);

  const colY = topY + 1;
  const colH = bottomY - colY;

  for (let c = 0; c < visibleColsCount; c++) {
    const colIdx = startCol + c;
    const col = columns[colIdx];
    const isActiveCol = colIdx === tui.warCol;
    const cx = c * colW;
    const cw = c === visibleColsCount - 1 ? w - cx : colW;

    const isDusty = !col.isRituals && dustyRealms.has(col.id);
    const borderColor = isActiveCol
      ? palette.borderBright
      : isDusty
      ? mix(palette.muted, '#f4a261', 0.45)
      : palette.border;

    screen.fill(cx + 1, colY + 1, Math.max(1, cw - 2), Math.max(1, colH - 2), {
      fg: palette.text,
      bg: palette.bg,
    });
    const headerTag = col.isRituals
      ? `⟳ ${v.rituals.toUpperCase()} (${col.items.length})`
      : `${col.title.toUpperCase()} (${col.items.length})${isDusty ? ' [DUSTY]' : ''}`;

    screen.box(cx, colY, cw, colH, {
      kind: biome.boxKind,
      st: { fg: borderColor, bg: palette.bg, bold: isActiveCol },
      title: truncate(headerTag, cw - 4),
      titleSt: {
        fg: col.isRituals ? palette.ritual : isActiveCol ? palette.borderBright : isDusty ? '#f4a261' : palette.accent,
        bg: palette.bg,
        bold: true,
      },
    });

    // Sub-header row inside column: Commission chest or Realm health bar
    let iy = colY + 1;
    if (col.isRituals) {
      const comm = getCommissionStatus(tui.state);
      const pct = comm.target > 0 ? Math.round((comm.completedCount / comm.target) * 100) : 0;
      const barW = Math.max(6, Math.min(12, cw - 15));
      let bx = screen.put(cx + 2, iy, 'Chest:', { fg: palette.muted, bg: palette.bg });
      drawBar(screen, bx, iy, barW, pct, comm.claimed ? '#80ed99' : palette.ritual, darken(palette.muted, 0.45), palette.bg);
      screen.text(bx + barW + 1, iy, comm.claimed ? 'OPEN' : `${comm.completedCount}/${comm.target}`, {
        fg: comm.claimed ? '#80ed99' : palette.text,
        bg: palette.bg,
        bold: comm.claimed,
      }, cw - (bx - cx + barW + 2));
    } else {
      const pct = col.totalCount > 0 ? Math.round((col.doneCount / col.totalCount) * 100) : 100;
      const barW = Math.max(6, Math.min(12, cw - 15));
      let bx = screen.put(cx + 2, iy, 'Clear:', { fg: palette.muted, bg: palette.bg });
      drawBar(screen, bx, iy, barW, pct, palette.xpBar, darken(palette.muted, 0.45), palette.bg);
      screen.text(bx + barW + 1, iy, `${pct}%`, { fg: palette.muted, bg: palette.bg }, 5);
    }
    iy += 1;

    if (col.items.length === 0) {
      screen.text(cx + 2, iy + 1, '(Empty)', { fg: palette.muted, bg: palette.bg }, cw - 4);
      continue;
    }

    // Each card is 4 lines tall (box top, title, progress bar, box bottom)
    const cardH = 4;
    const maxCards = Math.max(1, Math.floor((colH - 3) / cardH));
    const selRow = isActiveCol ? tui.warRow : 0;
    const startItem = Math.max(
      0,
      Math.min(selRow - Math.floor(maxCards / 2), Math.max(0, col.items.length - maxCards))
    );
    const slice = col.items.slice(startItem, startItem + maxCards);

    slice.forEach((item, idx) => {
      const realIdx = startItem + idx;
      const isSelected = isActiveCol && realIdx === tui.warRow;
      const cardY = iy + idx * cardH;
      const cardW = cw - 2;
      const cardBg = isSelected ? palette.highlightBg : palette.panelBg;

      screen.fill(cx + 1, cardY, cardW, cardH, { fg: palette.text, bg: cardBg });
      screen.box(cx + 1, cardY, cardW, cardH, {
        kind: 'single',
        st: {
          fg: isSelected ? palette.borderBright : darken(palette.border, 0.2),
          bg: cardBg,
          bold: isSelected,
        },
      });

      if (col.isRituals) {
        const due = isRitualDueToday(item);
        const cad = CADENCES[item.cadence]?.short || 'DAILY';
        const icon = item.completedToday ? '✔' : due ? '⟳' : '·';
        let lx = cx + 2;
        lx = screen.put(lx, cardY + 1, `${icon} `, {
          fg: item.completedToday ? '#80ed99' : palette.ritual,
          bg: cardBg,
          bold: true,
        });
        const cadW = cad.length + 1;
        screen.text(lx, cardY + 1, item.title, { fg: palette.text, bg: cardBg, bold: isSelected }, Math.max(6, cardW - 5 - cadW));
        screen.text(cx + cardW - cad.length, cardY + 1, cad, { fg: palette.accent, bg: cardBg }, cad.length);

        const charge = renderChargeBar(item.progressCount, item.targetCount, 6);
        screen.text(cx + 2, cardY + 2, `${charge}  ♦${item.streak || 0}d`, {
          fg: item.completedToday ? '#80ed99' : palette.muted,
          bg: cardBg,
        }, cardW - 3);
      } else {
        const rankMeta = RANKS[item.rank] || RANKS.C;
        const hp = computeQuestHp(item);
        const isBloom = biome.progressMode === 'bloom';
        const pct = isBloom ? 100 - hp.pct : hp.pct;

        let lx = cx + 2;
        lx = screen.put(lx, cardY + 1, `${item.rank}`, { fg: '#111111', bg: rankMeta.hex, bold: true });
        lx = screen.put(lx, cardY + 1, item.inPouch ? '★' : ' ', { fg: palette.gold, bg: cardBg });
        screen.text(lx, cardY + 1, item.title, { fg: palette.text, bg: cardBg, bold: isSelected }, cardW - 6);

        const barW = Math.max(6, cardW - 14);
        let bx = screen.put(cx + 2, cardY + 2, isBloom ? 'Gr:' : 'HP:', { fg: palette.muted, bg: cardBg });
        const barColor = isBloom ? palette.ritual : hp.pct > 60 ? palette.hpFull : hp.pct > 25 ? palette.hpMid : palette.hpLow;
        drawBar(screen, bx, cardY + 2, barW, pct, barColor, darken(palette.muted, 0.45), cardBg);
        const tail = item.recurrence ? ' ⟳' : item.bountyMultiplier > 1 ? ' ♦' : ` ${pct}%`;
        screen.text(bx + barW, cardY + 2, tail, { fg: palette.muted, bg: cardBg }, 6);
      }
    });
  }
}
