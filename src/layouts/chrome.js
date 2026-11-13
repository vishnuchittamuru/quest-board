// Top Chrome (Hero Status, Biome NPC Banner, Commission Chest Meter, Layout Switcher)
// and Centered Modal Overlays (Help, Relics, Biomes, Tavern Leave, Ritual Presets, Fate d20).

import { darken } from '../color.js';
import { padRight, strWidth, truncate, wrap } from '../text.js';
import { BIOME_LIST, isBiomeUnlocked, streakHeatStyle, getStreakHeatTier } from '../biomes.js';
import {
  RELIC_CATALOG,
  RITUAL_PRESETS,
  CADENCES,
  getHeroTitle,
  xpRequiredForLevel,
  isOnTavernLeave,
  getCommissionStatus,
  formatDisplayDate,
} from '../state.js';
import { formatSeasonWindow, seasonById } from '../seasons.js';

export function drawBar(screen, x, y, width, pct, fillColor, emptyColor, bg) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  for (let i = 0; i < width; i++) {
    screen.set(x + i, y, i < filled ? '█' : '░', {
      fg: i < filled ? fillColor : emptyColor,
      bg,
    });
  }
}

export function renderTopChrome(screen, tui, palette, biome) {
  const w = screen.w;
  const hero = tui.state.hero;
  const v = biome.vocab;
  const layout = hero.layout || 'classic';

  // Row 0: Header Bar — reserve right side for layout switcher pills so they never clip
  screen.fill(0, 0, w, 1, { fg: palette.text, bg: palette.bg });
  const layoutPills = [
    ['classic', '[F1]Board'],
    ['wartable', '[F2]WarTable'],
    ['arena', '[F3]Arena'],
  ];
  const pillsText = layoutPills.map(([, label]) => label).join(' ');
  const pillX = Math.max(20, w - strWidth(pillsText) - 1);
  let px = pillX;
  for (const [id, label] of layoutPills) {
    const active = layout === id;
    px = screen.put(
      px,
      0,
      label,
      active
        ? { fg: palette.bg, bg: palette.borderBright, bold: true }
        : { fg: palette.muted, bg: palette.bg }
    );
    px = screen.put(px, 0, ' ', { bg: palette.bg });
  }

  const maxLeft = pillX - 1;
  let cx = 0;
  cx = screen.text(cx, 0, ` ✦ ${v.title} `, { fg: palette.headerFg, bg: palette.headerBg, bold: true }, maxLeft);
  if (cx < maxLeft) cx = screen.text(cx, 0, ` ${hero.name} `, { fg: palette.accent, bg: palette.bg, bold: true }, maxLeft - cx);
  if (cx < maxLeft - 14) {
    const shortLvl = `[Lv.${hero.level} ${getHeroTitle(hero.level)}] `;
    if (cx + strWidth(shortLvl) + 32 < maxLeft) {
      cx = screen.text(cx, 0, shortLvl, { fg: palette.muted, bg: palette.bg }, maxLeft - cx);
    } else {
      cx = screen.text(cx, 0, `[Lv.${hero.level}] `, { fg: palette.muted, bg: palette.bg }, maxLeft - cx);
    }
  }

  const xpReq = xpRequiredForLevel(hero.level);
  const xpPct = Math.round((hero.xp / xpReq) * 100);
  if (cx + 16 < maxLeft) {
    cx = screen.text(cx, 0, 'XP ', { fg: palette.muted, bg: palette.bg }, maxLeft - cx);
    drawBar(screen, cx, 0, 6, xpPct, palette.xpBar, darken(palette.muted, 0.45), palette.bg);
    cx += 6;
    cx = screen.text(cx, 0, ` ${hero.xp}/${xpReq} `, { fg: palette.text, bg: palette.bg }, maxLeft - cx);
  }
  if (cx + 6 < maxLeft) {
    cx = screen.text(cx, 0, `│ ${hero.gold}${v.currencyShort} `, { fg: palette.gold, bg: palette.bg, bold: true }, maxLeft - cx);
  }

  const leaveActive = isOnTavernLeave(hero);
  if (cx + 8 < maxLeft) {
    if (leaveActive) {
      cx = screen.text(cx, 0, `│ LEAVE→${hero.leaveUntil} `, { fg: '#80ed99', bg: palette.bg }, maxLeft - cx);
    } else {
      const heat = getStreakHeatTier(hero.streak);
      cx = screen.text(cx, 0, `│ ♦ ${hero.streak}d `, { fg: heat.color || palette.accent, bg: palette.bg, bold: hero.streak >= 7 }, maxLeft - cx);
    }
  }

  const now = new Date();
  const dateShort = formatDisplayDate(now, true);
  const dateFull = formatDisplayDate(now, false);
  if (cx + strWidth(dateShort) + 5 < maxLeft) {
    cx = screen.text(cx, 0, `│ ◷ ${dateShort} `, { fg: palette.accent2, bg: palette.bg, bold: true }, maxLeft - cx);
  }

  // Rows 1..3: Streak-Heated NPC & Commission Chest Box (always shows full date on top border)
  const tick = palette.tick || 0;
  const dateBannerTitle = `◷ ${dateFull}${palette.tod ? ` · ${palette.tod.name}` : ''}${palette.season ? ` · ✧ ${palette.season.name}` : ''}`;
  screen.fill(1, 2, Math.max(1, w - 2), 1, { fg: palette.text, bg: palette.panelBg });
  screen.box(0, 1, w, 3, {
    kind: biome.boxKind,
    styleAt: (bx, by) => streakHeatStyle(hero.streak, palette, bx, by, tick),
    title: dateBannerTitle,
    titleSt: { fg: palette.borderBright, bg: palette.bg, bold: true },
  });

  const moodFace = biome.npcMoods[tui.guildSpeech.mood] || biome.npcMoods.idle;
  const npcTag = ` ${moodFace}`;
  let nx = screen.put(1, 2, npcTag, { fg: palette.borderBright, bg: palette.panelBg, bold: true });

  const comm = getCommissionStatus(tui.state);
  const openCount = tui.state.quests.filter((q) => q.status === 'open').length;
  const pouchCount = tui.state.quests.filter((q) => q.status === 'open' && q.inPouch).length;

  const commPips =
    comm.target > 0
      ? `[${'✦'.repeat(Math.min(comm.completedCount, comm.target))}${'○'.repeat(Math.max(0, comm.target - comm.completedCount))}]`
      : '[—]';

  const rightSegs = [];
  if (comm.claimed) {
    rightSegs.push([` │ Chest:OPEN `, { fg: '#80ed99', bg: palette.panelBg, bold: true }]);
  } else {
    rightSegs.push([` │ ${v.rituals}: ${commPips} ${comm.completedCount}/${comm.target} `, { fg: palette.ritual, bg: palette.panelBg }]);
  }
  if (hero.pouchClearedToday) {
    rightSegs.push([`│ ★ FULL CLEAR `, { fg: '#80ed99', bg: palette.panelBg, bold: true }]);
  } else {
    rightSegs.push([`│ ${v.pouch}:${pouchCount}/${openCount} `, { fg: palette.pouchAccent, bg: palette.panelBg }]);
  }

  const rightWidth = rightSegs.reduce((acc, [s]) => acc + strWidth(s), 0);
  const rightX = Math.max(nx + 4, w - 1 - rightWidth);
  const speechMax = Math.max(10, rightX - nx - 1);

  screen.text(nx, 2, tui.guildSpeech.line || '', { fg: palette.text, bg: palette.panelBg }, speechMax);
  screen.segs(rightX, 2, rightSegs, w - 1 - rightX);
}

export function getHelpSections(biome) {
  const v = biome.vocab;
  return [
    {
      id: 'classic',
      tabLabel: '[1] Classic [F1]',
      subtitle: `Split-pane Notice Board (${v.quests}, ${v.pouch}, ${v.rituals}, ${v.archive})`,
      entries: [
        ['[↑/↓] or [k/j]', `Browse ${v.quests} / ${v.rituals} list`, 'Select previous or next task / daily habit'],
        ['[b]', `Open ${v.quests} Board tab`, 'View all open tasks'],
        ['[p]', `Open ${v.pouch} tab`, "View tasks picked for Today's Todo List"],
        ['[y]', `Open ${v.rituals} tab`, 'View repeating daily/weekly habits (water, workout, clean)'],
        ['[a]', `Open ${v.archive} tab`, 'View completed tasks archive / history'],
        ['[Tab] / [S-Tab]', `Cycle ${v.realm} filter (◆ ALL, ...)`, 'Filter tasks by Category / Task Group (fwd / back)'],
        ['[Space]', `Pick for ${v.pouch} [★] / Strike ${v.ritual}`, "Toggle task in Today's List, or log +1 habit count"],
        ['[1] - [9]', 'Strike Sub-step #1-#9 (HP dmg / Crit)', 'Check/uncheck checklist sub-task #1-#9 on selected task'],
        ['[c]', `${v.slay} ${v.quest} / Log ${v.ritual}`, 'Mark selected task or repeating habit as Done'],
        ['[Enter]', 'Enter Battle Arena ([F3]) with selection', 'Open single-task Pomodoro Focus Mode for selected item'],
        ['[d]', `${v.fate} (1.5x-2.0x Bounty)`, 'Randomly pick an open task for today with bonus rewards'],
        ['[n]', `New ${v.quest} or repeating ${v.ritual}`, 'Create a new task or custom repeating habit'],
        ['[P] (Shift+p)', `${v.rituals} Presets quick-add menu`, 'Quick-add preset habits (Water, Workout, Clean, Study)'],
        ['[s] / [m]', 'Add Sub-step [s] · Inscribe Note [m]', 'Add a checklist step [s] or text note/detail [m]'],
        ['[r] / [R]', 'Cycle Rank S-D [r] · Repeat Cadence [R]', 'Change priority S..D [r], or repeat task daily/weekly [R]'],
        ['[o]', 'Sort list (Rank -> HP -> Newest)', 'Cycle task sort order: Priority, Progress, or Newest'],
        ['[e] / [x] / [u]', 'Edit [e] · Remove [x] · Undo/Reopen [u]', 'Edit details [e], delete [x], or reopen/reset item [u]'],
      ],
    },
    {
      id: 'wartable',
      tabLabel: '[2] War Table [F2]',
      subtitle: `Side-by-side ${v.realm} columns + pinned ${v.rituals} column & [DUSTY] alerts`,
      entries: [
        ['[←/→] or [h/l]', `Switch ${v.rituals} & ${v.realm} columns`, 'Move left/right between Task Group Kanban columns'],
        ['[↑/↓] or [k/j]', 'Navigate cards in current column', 'Select previous/next card inside the active column'],
        ['[</>] or [H/L]', `March card to prev/next ${v.realm}`, 'Move selected task card into adjacent Task Group'],
        ['[Space]', `Toggle ${v.pouch} [★] / Charge ${v.ritual}`, "Pick/unpick card for Today's List, or +1 habit count"],
        ['[c]', `${v.slay} card / Complete ${v.ritual}`, 'Mark selected task card or daily habit as Done'],
        ['[Enter]', 'Enter Battle Arena ([F3]) with card', 'Open Pomodoro Focus Mode for selected card'],
        ['[1] - [9]', 'Strike Sub-step #1-#9 on card', 'Check/uncheck checklist step #1-#9 on selected card'],
        ['[n] / [P]', `New ${v.quest}/${v.ritual} [n] · Presets [P]`, 'Create new task/habit [n], or quick-add daily habits [P]'],
        ['[s] / [m] / [e]', '+Step [s] · +Note [m] · Edit card [e]', 'Add checklist step [s], add note [m], or edit card [e]'],
        ['[r] / [R]', 'Cycle Rank S-D [r] · Repeat [R]', 'Change priority [r], or set card to repeat daily/weekly [R]'],
        ['[y] / [a]', `Jump to ${v.rituals} [y] · ${v.archive} [a]`, 'Focus Daily Habits column [y], or open Done popup [a]'],
        ['[d] / [x] / [u]', `${v.fate} [d] · Delete [x] · Reset [u]`, 'Random task pick [d], delete card [x], or reset habit [u]'],
      ],
    },
    {
      id: 'arena',
      tabLabel: '[3] Arena [F3]',
      subtitle: 'Single-task Focus Mode with ASCII Monster/Plant growth & Pomodoro timer',
      entries: [
        ['[f]', 'Start / Pause Focus Round', 'Start or pause the Pomodoro focus countdown timer'],
        ['[\\]', 'Cycle round duration (15m/25m/45m)', 'Change Pomodoro session length (15, 25, or 45 mins)'],
        ['[F] (Shift+f)', `Finish Focus Round (+25 XP, +8${v.currencyShort})`, 'Complete focus session now and claim bonus rewards'],
        ['[1] - [9]', 'Execute Attack Move #1-#9', 'Check off sub-task #1-#9 (deals damage / grows bloom)'],
        ['[Space]', `Direct Strike / +1 ${v.ritual} charge`, 'Hit next sub-task, deal 25% damage, or +1 habit charge'],
        ['[c] / [Enter]', `Deliver Final Blow (${v.slay})`, 'Mark focused task or daily habit as 100% Completed'],
        ['[s] / [m] / [e]', '+Step [s] · +Combat Note [m] · Edit [e]', 'Add checklist step [s], log work note [m], or edit [e]'],
        ['[u]', 'Reset / Reopen locked target', "Reset today's habit count or reopen a completed task"],
        ['[a]', `Open ${v.archive} popup`, 'View completed tasks modal without leaving Arena'],
        ['[Esc]', 'Retreat to previous board', 'Exit Focus Mode and return to Classic Board or War Table'],
      ],
    },
    {
      id: 'global',
      tabLabel: '[4] Global & Vault',
      subtitle: 'Available from any board layout (unless a modal prompt is open)',
      entries: [
        ['[F1] / [F2] / [F3]', 'Switch Board Layout anywhere', 'Switch: Classic Board [F1], Kanban [F2], Focus Arena [F3]'],
        ['[a]', `${v.archive} (Tab on [F1] · Modal on [F2/F3])`, 'View completed tasks archive (stays on F2/F3 as popup)'],
        ['[t]', 'Biomes & Atmosphere ([1-5], [A], [L])', 'Change theme [1-5], toggle animations [A] & lighting [L]'],
        ['[i]', 'Reliquary & Artifact Vault', 'View unlocked achievement badges and passive bonuses'],
        ['[v]', 'Sanctuary Decree (Tavern Leave)', 'Vacation / rest mode: pause & protect streaks 1-90 days'],
        ['[g]', `Speak with ${biome.npcName}`, 'Refresh companion status message / tip in top banner'],
        ['[K] (Shift+k)', 'Re-forge Vault Passphrase', 'Change your AES-256-GCM encryption password'],
        ['[?]', 'Toggle Field Manual (Help)', 'Open or close this dual-language hotkey reference'],
        ['[q] / [Ctrl+C]', 'Seal Vault & Quit', 'Encrypt, save vault to disk, and exit to terminal'],
      ],
    },
  ];
}

function renderHelpModal(screen, tui, palette, biome) {
  const v = biome.vocab;
  const sections = getHelpSections(biome);
  tui.helpTab = Math.max(0, Math.min(sections.length - 1, tui.helpTab || 0));
  const activeSection = sections[tui.helpTab];

  const boxW = Math.min(screen.w - 4, 108);
  const boxH = Math.min(screen.h - 2, 29);
  const sx = Math.max(2, Math.floor((screen.w - boxW) / 2));
  const sy = Math.max(1, Math.floor((screen.h - boxH) / 2));

  screen.fill(sx, sy, boxW, boxH, { fg: palette.text, bg: palette.panelBg, solid: true });
  screen.box(sx, sy, boxW, boxH, {
    kind: biome.boxKind,
    st: { fg: palette.borderBright, bg: palette.panelBg, bold: true },
  });

  const innerX = sx + 2;
  const innerW = boxW - 4;
  let cy = sy + 1;

  // Header & Active Biome Quick Translator
  screen.text(
    innerX,
    cy,
    `✦ FIELD MANUAL — HOTKEYS (${biome.name}: Theme + Normal Language) ✦`,
    { fg: palette.borderBright, bg: palette.panelBg, bold: true },
    innerW
  );
  cy += 1;

  const vocabBanner = `Terms: ${v.quest}=Task · ${v.pouch}=Today · ${v.ritual}=Habit · ${v.realm}=Group · ${v.archive}=Done`;
  screen.text(innerX, cy, vocabBanner, { fg: palette.muted, bg: palette.panelBg }, innerW);
  cy += 1;

  // Section Tabs Row (never overflow past innerX + innerW)
  let tabX = innerX;
  sections.forEach((sec, idx) => {
    const isAct = idx === tui.helpTab;
    const lbl = boxW < 88 ? `[${idx + 1}]${sec.id[0].toUpperCase() + sec.id.slice(1)}` : sec.tabLabel;
    const pill = ` ${lbl} `;
    if (tabX + strWidth(pill) > innerX + innerW) return;
    tabX = screen.put(
      tabX,
      cy,
      pill,
      isAct ? { fg: palette.bg, bg: palette.accent, bold: true } : { fg: palette.muted, bg: palette.bg }
    );
    if (tabX + 1 <= innerX + innerW) {
      tabX = screen.put(tabX, cy, ' ', { bg: palette.panelBg });
    }
  });
  cy += 1;

  // Active Board Subtitle + Table Header
  screen.text(innerX, cy, `» ${activeSection.subtitle}`, { fg: palette.accent2, bg: palette.panelBg, bold: true }, innerW);
  cy += 1;

  const keyColW = Math.min(20, Math.max(15, Math.floor(innerW * 0.2)));
  const remW = Math.max(20, innerW - keyColW - 6);
  const themeColW = Math.floor(remW * 0.48);
  const normalColW = remW - themeColW;

  const headerLine = `${padRight('KEY', keyColW)} │ ${padRight(`THEME (${biome.name})`, themeColW)} │ ${padRight('NORMAL / PLAIN MEANING', normalColW)}`;
  screen.text(innerX, cy, headerLine, { fg: palette.gold, bg: palette.panelBg, bold: true }, innerW);
  cy += 1;
  screen.hline(innerX, cy, innerW, '─', { fg: darken(palette.border, 0.25), bg: palette.panelBg });
  cy += 1;

  // Build wrapped table rows
  const renderedRows = [];
  for (const [keyStr, themeStr, normalStr] of activeSection.entries) {
    const tLines = wrap(themeStr, themeColW);
    const nLines = wrap(normalStr, normalColW);
    const rowCount = Math.max(tLines.length, nLines.length);
    for (let i = 0; i < rowCount; i++) {
      renderedRows.push([
        [padRight(i === 0 ? keyStr : '', keyColW), { fg: palette.accent, bg: palette.panelBg, bold: i === 0 }],
        [' │ ', { fg: palette.muted, bg: palette.panelBg }],
        [padRight(tLines[i] || '', themeColW), { fg: palette.text, bg: palette.panelBg }],
        [' │ ', { fg: palette.muted, bg: palette.panelBg }],
        [padRight(nLines[i] || '', normalColW), { fg: '#b8e0d2', bg: palette.panelBg }],
      ]);
    }
  }

  const footerY = sy + boxH - 2;
  const bodyH = Math.max(1, footerY - cy - 1);
  const maxScroll = Math.max(0, renderedRows.length - bodyH);
  tui.helpScroll = Math.max(0, Math.min(maxScroll, tui.helpScroll || 0));

  for (let i = 0; i < bodyH; i++) {
    const row = renderedRows[tui.helpScroll + i];
    if (!row) break;
    screen.segs(innerX, cy + i, row, innerW);
  }

  // Footer
  screen.hline(innerX, footerY - 1, innerW, '─', { fg: darken(palette.border, 0.25), bg: palette.panelBg });
  const rangeStr =
    renderedRows.length > bodyH
      ? `Lines ${tui.helpScroll + 1}-${Math.min(renderedRows.length, tui.helpScroll + bodyH)}/${renderedRows.length}`
      : `${activeSection.entries.length} keys`;
  const footerMsg = `[1-4]/[Tab]/[←/→] Switch Board Tab  ·  [↑/↓] Scroll (${rangeStr})  ·  [Esc]/[Enter]/[?] Close`;
  screen.text(innerX, footerY, truncate(footerMsg, innerW), { fg: palette.muted, bg: palette.panelBg }, innerW);
}

function renderLegendsModal(screen, tui, palette, biome) {
  const hero = tui.state.hero;
  const v = biome.vocab;
  const doneQuests = (tui.state.quests || [])
    .filter((q) => q.status === 'done')
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0));

  const boxW = Math.min(screen.w - 4, 96);
  const boxH = Math.min(screen.h - 4, 24);
  const sx = Math.max(2, Math.floor((screen.w - boxW) / 2));
  const sy = Math.max(2, Math.floor((screen.h - boxH) / 2));
  const innerX = sx + 2;
  const innerW = boxW - 4;

  screen.fill(sx, sy, boxW, boxH, { fg: palette.text, bg: palette.panelBg, solid: true });
  screen.box(sx, sy, boxW, boxH, {
    kind: biome.boxKind,
    st: { fg: '#80ed99', bg: palette.panelBg, bold: true },
  });

  let cy = sy + 1;
  screen.text(
    innerX,
    cy,
    `✦ ${v.archive.toUpperCase()} — COMPLETED CHRONICLES (${doneQuests.length}) ✦`,
    { fg: '#80ed99', bg: palette.panelBg, bold: true },
    innerW
  );
  cy += 1;

  const statsLine = `Lifetime Slain: ${hero.totalCompleted || doneQuests.length}  │  Best Streak: ${hero.bestStreak || 1}d  │  Critical Hits: ${hero.critsLanded || 0}  │  Relics: ${(hero.relics || []).length}/${RELIC_CATALOG.length}`;
  screen.text(innerX, cy, statsLine, { fg: palette.gold, bg: palette.panelBg }, innerW);
  cy += 1;
  screen.hline(innerX, cy, innerW, '─', { fg: darken(palette.border, 0.25), bg: palette.panelBg });
  cy += 1;

  const footerY = sy + boxH - 2;
  const listH = Math.max(1, footerY - cy - 1);

  if (doneQuests.length === 0) {
    screen.text(innerX + 1, cy + 1, `No completed ${v.quests.toLowerCase()} in ${v.archive} yet.`, { fg: palette.muted, bg: palette.panelBg }, innerW - 2);
    screen.text(innerX + 1, cy + 2, `► Press [c] on any ${v.quest.toLowerCase()} to complete it and immortalize it here!`, { fg: palette.accent, bg: palette.panelBg }, innerW - 2);
  } else {
    tui.legendsIndex = Math.max(0, Math.min(doneQuests.length - 1, tui.legendsIndex || 0));
    const start = Math.max(0, Math.min(tui.legendsIndex - Math.floor(listH / 2), Math.max(0, doneQuests.length - listH)));
    const slice = doneQuests.slice(start, start + listH);
    slice.forEach((q, idx) => {
      const realIdx = start + idx;
      const sel = realIdx === tui.legendsIndex;
      const bg = sel ? palette.highlightBg : palette.panelBg;
      if (sel) screen.fill(innerX, cy + idx, innerW, 1, { fg: palette.text, bg });
      const dateStr = q.completedAt ? String(q.completedAt).slice(0, 10) : '';
      const realmTag = `‹${truncate(q.realm || 'General', 14)}›`;
      const tail = dateStr ? `  ${realmTag}  ${dateStr}` : `  ${realmTag}`;
      const titleMax = Math.max(10, innerW - 9 - strWidth(tail));
      screen.segs(
        innerX,
        cy + idx,
        [
          [sel ? '► ' : '  ', { fg: palette.borderBright, bg, bold: true }],
          ['✔ ', { fg: '#80ed99', bg, bold: true }],
          [`[${q.rank || 'C'}] `, { fg: palette.gold, bg, bold: true }],
          [truncate(q.title, titleMax), { fg: palette.text, bg, bold: sel }],
          [tail, { fg: palette.muted, bg }],
        ],
        innerW
      );
    });
  }

  screen.hline(innerX, footerY - 1, innerW, '─', { fg: darken(palette.border, 0.25), bg: palette.panelBg });
  const hint = `[↑/↓] Select  ·  [u] Reopen to Board  ·  [x] Delete  ·  [a]/[Esc]/[Enter] Close`;
  screen.text(innerX, footerY, truncate(hint, innerW), { fg: palette.muted, bg: palette.panelBg }, innerW);
}

export function renderModalOverlay(screen, tui, palette, biome) {
  const modal = tui.activeModal;
  if (!modal) return;

  if (modal === 'help') {
    renderHelpModal(screen, tui, palette, biome);
    return;
  }
  if (modal === 'legends') {
    renderLegendsModal(screen, tui, palette, biome);
    return;
  }

  const hero = tui.state.hero;
  const v = biome.vocab;
  const lines = []; // each item: array of [text, style] segments

  if (modal === 'relics') {
    lines.push([[`★ RELIQUARY & ARTIFACT VAULT (${hero.relics.length}/${RELIC_CATALOG.length}) ★`, { fg: palette.borderBright, bold: true }]]);
    lines.push([['Complete high-rank contracts, Fate Bounties & Seasonal events to unearth relics.', { fg: palette.muted }]]);
    lines.push([['', {}]]);
    for (const relic of RELIC_CATALOG) {
      const owned = hero.relics.includes(relic.id);
      if (owned) {
        lines.push([
          [`${relic.art} `, { fg: palette.gold, bold: true }],
          [`${relic.name} `, { fg: palette.text, bold: true }],
          [`[${relic.rarity}] `, { fg: palette.accent }],
          [`— ${relic.bonusText}`, { fg: '#80ed99' }],
        ]);
      } else {
        const sObj = relic.seasonId ? seasonById(relic.seasonId) : null;
        const hint = sObj ? ` (Drops during ${sObj.name}: ${formatSeasonWindow(sObj)})` : '';
        lines.push([[` [???]  Undiscovered [${relic.rarity}]${hint}`, { fg: palette.muted }]]);
      }
    }
    lines.push([['', {}]]);
    lines.push([['Press [Esc] or [i] to close.', { fg: palette.muted }]]);
  } else if (modal === 'biomes') {
    const settings = hero.settings || {};
    lines.push([[`✦ BIOMES & DYNAMIC ATMOSPHERE (${hero.gold}${v.currencyShort}) ✦`, { fg: palette.borderBright, bold: true }]]);
    lines.push([['Each Biome transforms colors, vocabulary, NPC & progress metaphors.', { fg: palette.muted }]]);
    lines.push([['', {}]]);
    BIOME_LIST.forEach((b, idx) => {
      const unlocked = isBiomeUnlocked(hero, b);
      const active = hero.activeBiome === b.id;
      const status = active
        ? [`[EQUIPPED]`, { fg: '#80ed99', bold: true }]
        : unlocked
        ? [`[UNLOCKED]`, { fg: palette.accent }]
        : [`[${b.cost}${v.currencyShort} or Deed]`, { fg: palette.gold }];
      lines.push([
        [`[${idx + 1}] `, { fg: palette.borderBright, bold: true }],
        [`${b.name} `, { fg: b.palette.accent, bold: true }],
        status,
      ]);
      lines.push([[`    ${b.desc} (${b.deedDesc})`, { fg: palette.muted }]]);
    });
    lines.push([['', {}]]);
    lines.push([
      ['[A] ', { fg: palette.borderBright, bold: true }],
      [`Ambient Animations: ${settings.animations !== false ? 'ON' : 'OFF'}   `, { fg: palette.text }],
      ['[L] ', { fg: palette.borderBright, bold: true }],
      [`Time-of-Day Lighting: ${settings.lighting !== false ? 'ON' : 'OFF'}`, { fg: palette.text }],
    ]);
    lines.push([['Press [1]-[5] to select Biome, [A]/[L] to toggle effects, or [Esc] to close.', { fg: palette.muted }]]);
  } else if (modal === 'leave') {
    const activeLeave = isOnTavernLeave(hero);
    lines.push([[`✦ SANCTUARY DECREE — PLANNED TAVERN LEAVE ✦`, { fg: palette.accent, bold: true }]]);
    lines.push([[`Protect your ${hero.streak}-day streak & ritual chains before stepping away.`, { fg: palette.text }]]);
    lines.push([['', {}]]);
    lines.push([
      ['Status: ', { fg: palette.muted }],
      activeLeave
        ? [`ON LEAVE UNTIL ${hero.leaveUntil}`, { fg: '#80ed99', bold: true }]
        : ['Active Duty', { fg: palette.accent }],
    ]);
    lines.push([['', {}]]);
    lines.push([['[1] ', { fg: palette.borderBright, bold: true }], ['1 Day (Rest Tomorrow)', { fg: palette.text }]]);
    lines.push([['[2] ', { fg: palette.borderBright, bold: true }], ['3 Days (Long Weekend)', { fg: palette.text }]]);
    lines.push([['[3] ', { fg: palette.borderBright, bold: true }], ['7 Days (Full Week Vacation)', { fg: palette.text }]]);
    lines.push([['[4] ', { fg: palette.borderBright, bold: true }], ['14 Days (Fortnight Expedition)', { fg: palette.text }]]);
    lines.push([['[5] ', { fg: palette.borderBright, bold: true }], ['Custom Number of Days...', { fg: palette.text }]]);
    lines.push([['[0] ', { fg: palette.borderBright, bold: true }], ['Resume Active Duty Immediately', { fg: palette.text }]]);
    lines.push([['', {}]]);
    lines.push([['Press [1]-[5], [0], or [Esc] to close.', { fg: palette.muted }]]);
  } else if (modal === 'ritual_presets') {
    lines.push([[`⟳ QUICK-ADD ${v.rituals.toUpperCase()} (REPEATING HABITS) ⟳`, { fg: palette.ritual, bold: true }]]);
    lines.push([['Press [1]-[8] to add a ready-made repeating ritual to your board:', { fg: palette.muted }]]);
    lines.push([['', {}]]);
    RITUAL_PRESETS.forEach((p, idx) => {
      const exists = (tui.state.rituals || []).some(
        (r) => r.title.toLowerCase() === p.title.toLowerCase()
      );
      const cad = CADENCES[p.cadence]?.short || 'DAILY';
      lines.push([
        [`[${idx + 1}] `, { fg: palette.borderBright, bold: true }],
        [`${p.title} `, { fg: exists ? palette.muted : palette.text, bold: !exists }],
        [`[${cad} · ${p.targetCount}x] `, { fg: palette.accent }],
        exists ? ['(Already Added)', { fg: '#80ed99' }] : ['', {}],
      ]);
    });
    lines.push([['', {}]]);
    lines.push([['Press [1]-[8] to add, [n] for custom, or [Esc] to close.', { fg: palette.muted }]]);
  } else if (modal === 'fate_rolling') {
    const face = String(tui.rollingDieValue || 20).padStart(2, ' ');
    lines.push([[`✦ ${v.fate.toUpperCase()}... ✦`, { fg: palette.accent2, bold: true }]]);
    lines.push([['', {}]]);
    lines.push([[`            /\\            `, { fg: palette.gold, bold: true }]]);
    lines.push([[`           /  \\           `, { fg: palette.gold, bold: true }]]);
    lines.push([[`          / ${face} \\          `, { fg: palette.borderBright, bold: true }]]);
    lines.push([[`          \\    /          `, { fg: palette.gold, bold: true }]]);
    lines.push([[`           \\  /           `, { fg: palette.gold, bold: true }]]);
    lines.push([[`            \\/            `, { fg: palette.gold, bold: true }]]);
    lines.push([['', {}]]);
    lines.push([['The Fates are selecting your next contract...', { fg: palette.muted }]]);
  }

  const boxW = Math.min(screen.w - 4, 80);
  const boxH = Math.min(screen.h - 4, lines.length + 4);
  const sx = Math.max(2, Math.floor((screen.w - boxW) / 2));
  const sy = Math.max(2, Math.floor((screen.h - boxH) / 2));

  screen.fill(sx, sy, boxW, boxH, { fg: palette.text, bg: palette.panelBg, solid: true });
  screen.box(sx, sy, boxW, boxH, {
    kind: biome.boxKind,
    st: { fg: palette.borderBright, bg: palette.panelBg, bold: true },
  });

  const maxLines = boxH - 2;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    screen.segs(sx + 2, sy + 1 + i, lines[i], boxW - 4);
  }
}

export function renderFooter(screen, tui, palette, biome) {
  const y1 = screen.h - 2;
  const y2 = screen.h - 1;
  if (y1 < 0) return;

  const layout = tui.state.hero.layout || 'classic';
  const v = biome.vocab;
  screen.fill(0, y1, screen.w, 2, { fg: palette.muted, bg: palette.bg });

  let r1 = [];
  if (layout === 'wartable') {
    r1 = [
      [' [↑/↓]', palette.borderBright], ['Card ', palette.muted],
      ['[←/→]', palette.borderBright], ['Column ', palette.muted],
      ['[</>]', palette.borderBright], [`Move ${v.realm} `, palette.muted],
      ['[Space]', palette.borderBright], ['Pick/Charge ', palette.muted],
      ['[c]', palette.borderBright], [`${v.slay} `, palette.muted],
      ['[Enter]', palette.borderBright], ['Arena ', palette.muted],
      ['[n]', palette.borderBright], ['New ', palette.muted],
      ['[P]', palette.ritual], ['Ritual Presets', palette.muted],
    ];
  } else if (layout === 'arena') {
    r1 = [
      [' [1-9]', palette.borderBright], ['Attack Move ', palette.muted],
      ['[Space]', palette.borderBright], ['Direct Strike ', palette.muted],
      ['[f]', palette.accent], ['Start/Pause Focus ', palette.muted],
      ['[\\]', palette.borderBright], ['Cycle Timer ', palette.muted],
      ['[F]', palette.borderBright], ['Finish Round ', palette.muted],
      ['[c]', palette.borderBright], ['Final Blow ', palette.muted],
      ['[m]', palette.borderBright], ['+Note ', palette.muted],
      ['[Esc]', palette.borderBright], ['Retreat', palette.muted],
    ];
  } else {
    r1 = [
      [' [↑/↓]', palette.borderBright], ['Select ', palette.muted],
      ['[Space]', palette.borderBright], ['Pick/Charge ', palette.muted],
      ['[1-9]', palette.borderBright], ['Strike ', palette.muted],
      ['[c]', palette.borderBright], [`${v.slay} `, palette.muted],
      ['[Enter]', palette.borderBright], ['Arena ', palette.muted],
      ['[d]', palette.accent], [`${v.fate} `, palette.muted],
      ['[n]', palette.borderBright], ['New ', palette.muted],
      ['[s/m]', palette.borderBright], ['+Step/+Note', palette.muted],
    ];
  }

  let r2 = [];
  if (layout === 'classic') {
    // Classic layout displays [b], [p], [y], [a] tabs on Row 4 — omit duplicates from footer
    r2 = [
      [' [Tab]', palette.borderBright], [`${v.realm} `, palette.muted],
      ['[r/R]', palette.borderBright], ['Rank/Repeat ', palette.muted],
      ['[o]', palette.borderBright], ['Sort ', palette.muted],
      ['[e/x/u]', palette.borderBright], ['Edit/Del ', palette.muted],
      ['[P]', palette.ritual], ['Presets ', palette.muted],
      ['[v]', '#80ed99'], ['Leave ', palette.muted],
      ['[i]', palette.borderBright], ['Relics ', palette.muted],
      ['[t]', palette.borderBright], ['Biomes ', palette.muted],
      ['[?]', palette.borderBright], ['Help ', palette.muted],
      ['[q]', palette.borderBright], ['Quit', palette.muted],
    ];
  } else {
    r2 = [
      [' [a]', '#80ed99'], ['Legends ', palette.muted],
      ['[r/R]', palette.borderBright], ['Rank/Repeat ', palette.muted],
      ['[e/x/u]', palette.borderBright], ['Edit/Del ', palette.muted],
      ['[v]', '#80ed99'], ['Leave ', palette.muted],
      ['[i]', palette.borderBright], ['Relics ', palette.muted],
      ['[t]', palette.borderBright], ['Biomes ', palette.muted],
      ['[?]', palette.borderBright], ['Help ', palette.muted],
      ['[q]', palette.borderBright], ['Quit', palette.muted],
    ];
  }

  const drawSegList = (y, pairs) => {
    const segs = pairs.map(([txt, fg]) => [txt, { fg, bg: palette.bg }]);
    screen.segs(0, y, segs, screen.w);
  };
  drawSegList(y1, r1);
  drawSegList(y2, r2);
}
