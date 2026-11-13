// Layout 1: Classic Split-Pane Guild Notice Board + Daily Rituals Sanctum.
// Left Pane: Tabs (Board, Active Pouch, Daily Rituals, Hall of Legends), Realm Filter,
//            compact Daily Rituals Pulse Bar, and scrollable Quest/Ritual list.
// Right Pane: Detailed Scroll Inspector (Boss HP or Cozy Cottage Bloom Growth,
//             Sub-steps, Repeating Cadence / Mastery Chain, and Field Notes).

import { darken } from '../color.js';
import { strWidth, truncate, wrap } from '../text.js';
import {
  RANKS,
  CADENCES,
  computeQuestHp,
  isRitualDueToday,
  getRitualMastery,
  renderChargeBar,
} from '../state.js';
import { drawBar } from './chrome.js';

function getGrowthLabel(pct) {
  if (pct >= 100) return '🌸 Full Bloom';
  if (pct >= 60) return '🌷 Budding';
  if (pct >= 25) return '🌿 Sprout';
  return '🌱 Seed';
}

export function renderClassicLayout(screen, tui, palette, biome) {
  const w = screen.w;
  const h = screen.h;
  const v = biome.vocab;
  const hero = tui.state.hero;

  const topY = 4;
  const bodyBottom = h - 2;
  if (bodyBottom - topY < 8) return;

  // Row 4: Sub-tabs & Realm Filter Bar
  const openCount = tui.state.quests.filter((q) => q.status === 'open').length;
  const pouchCount = tui.state.quests.filter((q) => q.status === 'open' && q.inPouch).length;
  const dueRituals = (tui.state.rituals || []).filter((r) => isRitualDueToday(r) || r.completedToday);
  const doneRituals = dueRituals.filter((r) => r.completedToday).length;
  const doneQuests = tui.state.quests.filter((q) => q.status === 'done').length;

  screen.fill(0, topY, w, 1, { fg: palette.text, bg: palette.panelBg });
  let tx = 1;
  const fullTabs = [
    ['board', `[b] Board (${openCount})`, palette.gold],
    ['pouch', `[p] ${v.pouch} (${pouchCount})`, palette.pouchAccent],
    ['rituals', `[y] ${v.rituals} (${doneRituals}/${dueRituals.length})`, palette.ritual],
    ['archive', `[a] ${v.archive} (${doneQuests})`, '#80ed99'],
  ];
  const fullTabsW = fullTabs.reduce((sum, [, lbl]) => sum + strWidth(lbl) + 3, 0);
  const reserveRealmW = Math.min(38, Math.max(26, strWidth(v.realm) + strWidth(tui.realmFilter) + 16));

  let tabs = fullTabs;
  let tabPad = ' ';
  if (1 + fullTabsW + reserveRealmW > w) {
    // Compact labels when terminal width is tight so the Task Group bar never clips
    const shortArchive = v.archive.split(' ').pop() || 'Legends';
    const compactArchive = w < 102 ? 'Legends' : shortArchive;
    const compactPouch = w < 102 ? truncate(v.pouch, 10) : v.pouch;
    const compactRituals = w < 102 ? truncate(v.rituals, 11) : v.rituals;
    tabs = [
      ['board', `[b] Board(${openCount})`, palette.gold],
      ['pouch', `[p] ${compactPouch}(${pouchCount})`, palette.pouchAccent],
      ['rituals', `[y] ${compactRituals}(${doneRituals}/${dueRituals.length})`, palette.ritual],
      ['archive', `[a] ${compactArchive}(${doneQuests})`, '#80ed99'],
    ];
    tabPad = '';
  }

  for (const [id, label, activeBg] of tabs) {
    const active = tui.viewTab === id;
    tx = screen.put(
      tx,
      topY,
      `${tabPad}${label}${tabPad}`,
      active ? { fg: palette.bg, bg: activeBg, bold: true } : { fg: palette.muted, bg: palette.panelBg }
    );
    tx = screen.put(tx, topY, ' ', { bg: palette.panelBg });
  }

  const realmLabelPrefix = `│ ${v.realm} [Tab]: `;
  if (tx + strWidth(realmLabelPrefix) + 4 < w) {
    tx = screen.put(tx, topY, realmLabelPrefix, { fg: palette.muted, bg: palette.panelBg });
    const realms = tui.getRealmsList();
    const activeRealm = tui.realmFilter || 'ALL';
    const orderedRealms = [activeRealm, ...realms.filter((r) => r !== activeRealm)];

    let renderedAny = false;
    for (const r of orderedRealms) {
      const isActive = r === activeRealm;
      const pill = isActive ? `◆ ${r}` : r;
      const sep = renderedAny ? ' · ' : '';
      const pieceW = strWidth(sep) + strWidth(pill);
      if (tx + pieceW > w - 1) {
        if (!renderedAny) {
          const maxActive = Math.max(4, w - 1 - tx - 2);
          screen.put(tx, topY, `◆ ${truncate(r, maxActive)}`, {
            fg: palette.accent,
            bg: palette.panelBg,
            bold: true,
            underline: true,
          });
        }
        break;
      }
      if (sep) {
        tx = screen.put(tx, topY, sep, { fg: palette.muted, bg: palette.panelBg });
      }
      tx = screen.put(
        tx,
        topY,
        pill,
        isActive
          ? { fg: palette.accent, bg: palette.panelBg, bold: true, underline: true }
          : { fg: palette.muted, bg: palette.panelBg }
      );
      renderedAny = true;
    }
  }

  // Split Pane Boxes (Rows 5 .. h-3)
  const paneY = topY + 1;
  const paneH = bodyBottom - paneY;
  const leftW = Math.max(40, Math.floor(w * 0.53));
  const rightW = w - leftW;

  screen.fill(1, paneY + 1, leftW - 2, paneH - 2, { fg: palette.text, bg: palette.bg });
  screen.fill(leftW + 1, paneY + 1, rightW - 2, paneH - 2, { fg: palette.text, bg: palette.bg });

  const borderStyle = { fg: palette.border, bg: palette.bg };
  const leftTitle =
    tui.viewTab === 'rituals'
      ? `⟳ ${v.rituals.toUpperCase()} (REPEATING)`
      : tui.viewTab === 'pouch'
      ? `★ ${v.pouch.toUpperCase()}`
      : tui.viewTab === 'archive'
      ? `✦ ${v.archive.toUpperCase()}`
      : `§ ${v.quests.toUpperCase()} BOARD`;

  screen.box(0, paneY, leftW, paneH, {
    kind: biome.boxKind,
    st: borderStyle,
    title: leftTitle,
    titleSt: { fg: palette.accent, bg: palette.bg, bold: true },
  });
  screen.box(leftW, paneY, rightW, paneH, {
    kind: biome.boxKind,
    st: borderStyle,
    title: tui.viewTab === 'rituals' ? `⟳ ${v.ritual.toUpperCase()} INSPECTOR` : `✦ ${v.quest.toUpperCase()} INSPECTOR`,
    titleSt: { fg: palette.accent2, bg: palette.bg, bold: true },
  });

  if (tui.viewTab === 'rituals') {
    renderRitualList(screen, tui, palette, biome, 1, paneY + 1, leftW - 2, paneH - 2);
    renderRitualInspector(screen, tui, palette, biome, leftW + 1, paneY + 1, rightW - 2, paneH - 2);
  } else {
    renderQuestList(screen, tui, palette, biome, 1, paneY + 1, leftW - 2, paneH - 2);
    renderQuestInspector(screen, tui, palette, biome, leftW + 1, paneY + 1, rightW - 2, paneH - 2);
  }
}

function renderQuestList(screen, tui, palette, biome, x, y, w, h) {
  const v = biome.vocab;
  let cy = y;

  // Compact Daily Rituals Pulse Bar on Board/Pouch view so habits stay top-of-mind
  if (tui.viewTab !== 'archive' && h > 6) {
    const rituals = (tui.state.rituals || []).filter((r) => isRitualDueToday(r) || r.completedToday);
    let rx = screen.put(x + 1, cy, `⟳ ${v.rituals}: `, { fg: palette.ritual, bg: palette.bg, bold: true });
    for (const r of rituals.slice(0, 3)) {
      if (rx >= x + w - 12) break;
      const chip = r.completedToday
        ? `[✔ ${truncate(r.title, 11)}] `
        : `[${r.progressCount}/${r.targetCount} ${truncate(r.title, 10)}] `;
      rx = screen.put(rx, cy, chip, {
        fg: r.completedToday ? '#80ed99' : palette.text,
        bg: palette.bg,
      });
    }
    screen.text(rx, cy, '[y]Open', { fg: palette.muted, bg: palette.bg }, x + w - rx);
    cy += 1;
    screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
    cy += 1;
  }

  const list = tui.getFilteredQuests();

  // Distinct summary bar on Hall of Legends archive tab so it never looks like the open board
  if (tui.viewTab === 'archive' && h > 6) {
    const hero = tui.state.hero;
    const summary = `✦ ${v.archive}: ${list.length} archived · Slain: ${hero.totalCompleted || 0} · Best Streak: ${hero.bestStreak || 1}d · [u] Reopen`;
    screen.text(x + 1, cy, summary, { fg: '#80ed99', bg: palette.bg, bold: true }, w - 2);
    cy += 1;
    screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
    cy += 1;
  }

  if (list.length === 0) {
    if (tui.viewTab === 'archive') {
      screen.text(x + 2, cy + 1, `No completed ${v.quests.toLowerCase()} in ${v.archive} yet.`, { fg: palette.muted, bg: palette.bg }, w - 4);
      screen.text(x + 2, cy + 2, `► Press [b] for Board and finish a ${v.quest.toLowerCase()} with [c] to record victory!`, { fg: '#80ed99', bg: palette.bg }, w - 4);
    } else if (tui.viewTab === 'pouch') {
      screen.text(x + 2, cy + 1, `No ${v.quests.toLowerCase()} in Today's ${v.pouch} yet.`, { fg: palette.muted, bg: palette.bg }, w - 4);
      screen.text(x + 2, cy + 2, `► Press [b] for Board and press [Space] to pick one, or [d] for ${v.fate}!`, { fg: palette.accent, bg: palette.bg }, w - 4);
    } else {
      screen.text(x + 2, cy + 1, `No ${v.quests.toLowerCase()} in this view.`, { fg: palette.muted, bg: palette.bg }, w - 4);
      screen.text(x + 2, cy + 2, `► Press [n] to create one, or [d] for ${v.fate}!`, { fg: palette.accent, bg: palette.bg }, w - 4);
    }
    return;
  }

  const availH = y + h - cy;
  const itemsPerPage = Math.max(1, Math.floor(availH / 2));
  const startIdx = Math.max(
    0,
    Math.min(tui.selectedIndex - Math.floor(itemsPerPage / 2), Math.max(0, list.length - itemsPerPage))
  );
  const slice = list.slice(startIdx, startIdx + itemsPerPage);

  slice.forEach((q, idx) => {
    const realIdx = startIdx + idx;
    const selected = realIdx === tui.selectedIndex;
    const rowY = cy + idx * 2;
    const rankMeta = RANKS[q.rank] || RANKS.C;
    const hp = computeQuestHp(q);
    const isBloom = biome.progressMode === 'bloom';
    const progressPct = isBloom ? 100 - hp.pct : hp.pct;

    const bg = selected ? palette.highlightBg : palette.bg;
    if (selected) screen.fill(x, rowY, w, 2, { fg: palette.text, bg });

    let lx = x;
    lx = screen.put(lx, rowY, selected ? '►' : ' ', { fg: palette.borderBright, bg, bold: true });
    lx = screen.put(lx, rowY, q.inPouch ? '★' : '·', { fg: q.inPouch ? palette.gold : palette.muted, bg, bold: q.inPouch });
    lx = screen.put(lx, rowY, ` ${q.rank} `, { fg: '#111111', bg: rankMeta.hex, bold: true });
    lx = screen.put(lx, rowY, ' ', { bg });

    const badges = [];
    if (q.recurrence) badges.push([`[⟳${CADENCES[q.recurrence]?.short || 'RPT'}]`, { fg: palette.ritual, bg }]);
    if (q.bountyMultiplier > 1) badges.push([` [♦${q.bountyMultiplier}x]`, { fg: palette.accent2, bg, bold: true }]);
    const badgeW = badges.reduce((s, [t]) => s + strWidth(t), 0);

    const titleMax = Math.max(8, x + w - lx - badgeW - 1);
    lx = screen.text(lx, rowY, q.title, { fg: palette.text, bg, bold: selected }, titleMax);
    screen.segs(lx, rowY, badges, x + w - lx);

    // Line 2 of item: Realm + HP/Growth Bar
    let sx = x + 4;
    sx = screen.text(sx, rowY + 1, `‹${truncate(q.realm || 'General', 14)}› `, { fg: palette.muted, bg });
    sx = screen.put(sx, rowY + 1, isBloom ? 'Grow:' : 'HP:', { fg: palette.muted, bg });
    const barColor = isBloom
      ? palette.ritual
      : hp.pct > 60
      ? palette.hpFull
      : hp.pct > 25
      ? palette.hpMid
      : palette.hpLow;
    drawBar(screen, sx, rowY + 1, 8, progressPct, barColor, darken(palette.muted, 0.45), bg);
    sx += 9;
    const stepInfo = hp.totalCount > 0 ? `${hp.doneCount}/${hp.totalCount} steps` : `${progressPct}%`;
    screen.text(sx, rowY + 1, stepInfo, { fg: palette.muted, bg }, x + w - sx);
  });
}

function renderQuestInspector(screen, tui, palette, biome, x, y, w, h) {
  const q = tui.getSelectedQuest();
  const v = biome.vocab;
  if (!q) {
    screen.text(x + 2, y + 1, `Select a ${v.quest.toLowerCase()} or press [n] to create one.`, { fg: palette.muted, bg: palette.bg }, w - 4);
    return;
  }

  const rankMeta = RANKS[q.rank] || RANKS.C;
  const hp = computeQuestHp(q);
  const mult = q.bountyMultiplier || 1;
  const xpReward = Math.round(rankMeta.xp * mult);
  const goldReward = Math.round(rankMeta.gold * mult);
  const isBloom = biome.progressMode === 'bloom';
  let cy = y;

  // Status Header
  const statusSegs = [
    [` ${q.rank} `, { fg: '#111111', bg: rankMeta.hex, bold: true }],
    [' ', { bg: palette.bg }],
    q.status === 'done'
      ? ['[COMPLETED - Press u to Reopen]', { fg: '#80ed99', bg: palette.bg, bold: true }]
      : q.inPouch
      ? [`[★ IN ${v.pouch.toUpperCase()}]`, { fg: palette.gold, bg: palette.bg, bold: true }]
      : ['[ON BOARD]', { fg: palette.muted, bg: palette.bg }],
    [`  ${v.realm}: `, { fg: palette.muted, bg: palette.bg }],
    [q.realm || 'General', { fg: palette.accent, bg: palette.bg }],
  ];
  if (q.recurrence) {
    statusSegs.push([`  ⟳ ${CADENCES[q.recurrence]?.label || q.recurrence}`, { fg: palette.ritual, bg: palette.bg, bold: true }]);
  }
  screen.segs(x + 1, cy, statusSegs, w - 2);
  cy += 1;
  screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  cy += 1;

  // Title
  for (const tl of wrap(q.title, w - 3).slice(0, 2)) {
    screen.text(x + 1, cy, tl, { fg: palette.text, bg: palette.bg, bold: true }, w - 2);
    cy += 1;
  }

  // Rewards
  const rewardSegs = [
    ['Bounty: ', { fg: palette.muted, bg: palette.bg }],
    [`+${xpReward} XP  `, { fg: palette.xpBar, bg: palette.bg, bold: true }],
    [`+${goldReward}${v.currencyShort}`, { fg: palette.gold, bg: palette.bg, bold: true }],
  ];
  if (mult > 1) {
    rewardSegs.push([`  ♦ ${q.bountyLabel || `${mult}x FATE`}`, { fg: palette.accent2, bg: palette.bg, bold: true }]);
  }
  screen.segs(x + 1, cy, rewardSegs, w - 2);
  cy += 1;

  // Boss HP or Bloom Growth Bar
  const pct = isBloom ? 100 - hp.pct : hp.pct;
  const barW = Math.max(10, Math.min(22, w - 28));
  let bx = screen.put(x + 1, cy, isBloom ? 'Growth: [' : 'Boss HP:[', { fg: palette.muted, bg: palette.bg });
  const barColor = isBloom ? palette.ritual : hp.pct > 60 ? palette.hpFull : hp.pct > 25 ? palette.hpMid : palette.hpLow;
  drawBar(screen, bx, cy, barW, pct, barColor, darken(palette.muted, 0.45), palette.bg);
  bx += barW;
  const barEnd = isBloom ? `] ${getGrowthLabel(pct)} (${pct}%)` : `] ${hp.current}/${hp.max} (${hp.pct}%)`;
  screen.text(bx, cy, barEnd, { fg: palette.text, bg: palette.bg, bold: true }, x + w - bx);
  cy += 1;

  screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  cy += 1;

  // Sub-steps
  screen.segs(
    x + 1,
    cy,
    [
      ['► SUB-STEPS ', { fg: palette.accent, bg: palette.bg, bold: true }],
      ['([1-9] Strike · [s] Add · [F3] Battle Arena)', { fg: palette.muted, bg: palette.bg }],
    ],
    w - 2
  );
  cy += 1;

  const steps = q.steps || [];
  if (steps.length === 0) {
    screen.text(x + 3, cy, 'No sub-steps yet. Press [s] to add objectives!', { fg: palette.muted, bg: palette.bg }, w - 4);
    cy += 1;
  } else {
    steps.slice(0, 9).forEach((st, idx) => {
      if (cy >= y + h - 3) return;
      screen.segs(
        x + 2,
        cy,
        [
          [st.done ? '[x] ' : `[${idx + 1}] `, { fg: st.done ? '#80ed99' : palette.hpFull, bg: palette.bg, bold: !st.done }],
          [st.text, { fg: st.done ? palette.muted : palette.text, bg: palette.bg }],
        ],
        w - 3
      );
      cy += 1;
    });
  }

  if (cy < y + h - 2) {
    screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
    cy += 1;
    screen.segs(
      x + 1,
      cy,
      [
        ['§ FIELD NOTES ', { fg: palette.accent2, bg: palette.bg, bold: true }],
        ['([m] Add Note)', { fg: palette.muted, bg: palette.bg }],
      ],
      w - 2
    );
    cy += 1;
    const notes = q.notes || [];
    if (notes.length === 0 && cy < y + h) {
      screen.text(x + 3, cy, 'No notes inscribed yet.', { fg: palette.muted, bg: palette.bg }, w - 4);
    } else {
      for (const note of notes) {
        for (const nl of wrap(`• ${note}`, w - 4)) {
          if (cy >= y + h) break;
          screen.text(x + 2, cy, nl, { fg: palette.text, bg: palette.bg }, w - 3);
          cy += 1;
        }
      }
    }
  }
}

function renderRitualList(screen, tui, palette, biome, x, y, w, h) {
  const v = biome.vocab;
  const rituals = tui.getFilteredRituals();
  let cy = y;

  screen.segs(
    x + 1,
    cy,
    [
      [`⟳ ${v.rituals.toUpperCase()} `, { fg: palette.ritual, bg: palette.bg, bold: true }],
      ['([Space] Strike/Charge · [P] Presets · [n] New)', { fg: palette.muted, bg: palette.bg }],
    ],
    w - 2
  );
  cy += 1;
  screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  cy += 1;

  if (rituals.length === 0) {
    screen.text(x + 2, cy + 1, `No ${v.rituals.toLowerCase()} configured yet!`, { fg: palette.muted, bg: palette.bg }, w - 4);
    screen.text(x + 2, cy + 2, '► Press [P] for quick-add presets (Hydrate, Workout, Clean) or [n] for custom.', { fg: palette.accent, bg: palette.bg }, w - 4);
    return;
  }

  const availH = y + h - cy;
  const itemsPerPage = Math.max(1, Math.floor(availH / 2));
  const startIdx = Math.max(
    0,
    Math.min(tui.selectedRitualIndex - Math.floor(itemsPerPage / 2), Math.max(0, rituals.length - itemsPerPage))
  );
  const slice = rituals.slice(startIdx, startIdx + itemsPerPage);

  slice.forEach((r, idx) => {
    const realIdx = startIdx + idx;
    const selected = realIdx === tui.selectedRitualIndex;
    const rowY = cy + idx * 2;
    const bg = selected ? palette.highlightBg : palette.bg;
    if (selected) screen.fill(x, rowY, w, 2, { fg: palette.text, bg });

    const due = isRitualDueToday(r);
    const mastery = getRitualMastery(r.streak);
    const cad = CADENCES[r.cadence]?.short || 'DAILY';

    let lx = x;
    lx = screen.put(lx, rowY, selected ? '►' : ' ', { fg: palette.borderBright, bg, bold: true });
    lx = screen.put(lx, rowY, r.completedToday ? '✔ ' : due ? '⟳ ' : '· ', {
      fg: r.completedToday ? '#80ed99' : due ? palette.ritual : palette.muted,
      bg,
      bold: true,
    });
    const cadBadge = `[${cad}]`;
    const streakBadge = ` ${mastery.badge} ${r.streak || 0}d`;
    const rightLen = strWidth(cadBadge) + strWidth(streakBadge) + 2;
    lx = screen.text(lx, rowY, r.title, { fg: r.completedToday ? palette.muted : palette.text, bg, bold: selected }, Math.max(8, x + w - lx - rightLen));
    screen.segs(
      lx + 1,
      rowY,
      [
        [cadBadge, { fg: palette.accent, bg }],
        [streakBadge, { fg: mastery.hex, bg, bold: r.streak >= 3 }],
      ],
      x + w - lx - 1
    );

    // Line 2: Charge Bar + Realm
    const charge = renderChargeBar(r.progressCount, r.targetCount, 10);
    screen.segs(
      x + 3,
      rowY + 1,
      [
        [charge, { fg: r.completedToday ? '#80ed99' : palette.ritual, bg }],
        [`  ‹${r.realm || 'Homestead'}›`, { fg: palette.muted, bg }],
        !due && !r.completedToday ? [' (Off-duty today)', { fg: palette.muted, bg }] : null,
      ],
      w - 4
    );
  });
}

function renderRitualInspector(screen, tui, palette, biome, x, y, w, h) {
  const r = tui.getSelectedRitual();
  const v = biome.vocab;
  if (!r) {
    screen.text(x + 2, y + 1, `Select a repeating item or press [P] for quick-add presets!`, { fg: palette.muted, bg: palette.bg }, w - 4);
    return;
  }

  const rankMeta = RANKS[r.rank] || RANKS.C;
  const mastery = getRitualMastery(r.streak);
  const cad = CADENCES[r.cadence] || CADENCES.daily;
  const due = isRitualDueToday(r);
  let cy = y;

  screen.segs(
    x + 1,
    cy,
    [
      [` ${r.rank} `, { fg: '#111111', bg: rankMeta.hex, bold: true }],
      [' ', { bg: palette.bg }],
      r.completedToday
        ? ['[✔ COMPLETED TODAY - Press u to Reset]', { fg: '#80ed99', bg: palette.bg, bold: true }]
        : due
        ? ['[⟳ DUE TODAY]', { fg: palette.ritual, bg: palette.bg, bold: true }]
        : ['[REST DAY]', { fg: palette.muted, bg: palette.bg }],
      [`  ${v.realm}: `, { fg: palette.muted, bg: palette.bg }],
      [r.realm || 'Homestead', { fg: palette.accent, bg: palette.bg }],
    ],
    w - 2
  );
  cy += 1;
  screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  cy += 1;

  for (const tl of wrap(r.title, w - 3).slice(0, 2)) {
    screen.text(x + 1, cy, tl, { fg: palette.text, bg: palette.bg, bold: true }, w - 2);
    cy += 1;
  }

  screen.segs(
    x + 1,
    cy,
    [
      ['Cadence: ', { fg: palette.muted, bg: palette.bg }],
      [`${cad.label} `, { fg: palette.accent, bg: palette.bg, bold: true }],
      ['│ Mastery: ', { fg: palette.muted, bg: palette.bg }],
      [`${mastery.badge} ${mastery.label} (${mastery.mult}x Rewards)`, { fg: mastery.hex, bg: palette.bg, bold: true }],
    ],
    w - 2
  );
  cy += 1;

  const pct = Math.round((Math.min(r.progressCount || 0, r.targetCount || 1) / Math.max(1, r.targetCount || 1)) * 100);
  const barW = Math.max(10, Math.min(20, w - 30));
  let bx = screen.put(x + 1, cy, 'Charges:[', { fg: palette.muted, bg: palette.bg });
  drawBar(screen, bx, cy, barW, pct, r.completedToday ? '#80ed99' : palette.ritual, darken(palette.muted, 0.45), palette.bg);
  bx += barW;
  screen.text(bx, cy, `] ${r.progressCount || 0}/${r.targetCount || 1}  (Chain: ${r.streak || 0}d · Total: ${r.totalCompletions || 0})`, { fg: palette.text, bg: palette.bg }, x + w - bx);
  cy += 1;

  screen.hline(x, cy, w, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  cy += 1;

  const xp = Math.round(rankMeta.xp * 0.75 * mastery.mult);
  const gold = Math.round(rankMeta.gold * 0.75 * mastery.mult);
  screen.segs(
    x + 1,
    cy,
    [
      ['Completion Bounty: ', { fg: palette.muted, bg: palette.bg }],
      [`+${xp} XP `, { fg: palette.xpBar, bg: palette.bg, bold: true }],
      [`+${gold}${v.currencyShort}`, { fg: palette.gold, bg: palette.bg, bold: true }],
      r.targetCount > 1 ? [`  (+6 XP per [Space] charge)`, { fg: palette.muted, bg: palette.bg }] : null,
    ],
    w - 2
  );
  cy += 2;

  screen.segs(
    x + 1,
    cy,
    [
      ['§ RITUAL NOTES ', { fg: palette.accent2, bg: palette.bg, bold: true }],
      ['([m] Add Note · [Space] Charge/Complete · [F3] Arena)', { fg: palette.muted, bg: palette.bg }],
    ],
    w - 2
  );
  cy += 1;

  const notes = r.notes || [];
  if (notes.length === 0) {
    screen.text(x + 3, cy, 'No notes yet. Press [m] to add reminders or tips.', { fg: palette.muted, bg: palette.bg }, w - 4);
  } else {
    for (const note of notes) {
      for (const nl of wrap(`• ${note}`, w - 4)) {
        if (cy >= y + h) break;
        screen.text(x + 2, cy, nl, { fg: palette.text, bg: palette.bg }, w - 3);
        cy += 1;
      }
    }
  }
}
