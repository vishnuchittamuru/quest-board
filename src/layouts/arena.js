// Layout 3: Battle Arena (Single-Quest / Daily Ritual Focus Mode + Pomodoro Timer).
// Left Pane: Procedural ASCII Monster (or Cozy Cottage growing plant), Boss HP / Bloom bar,
//            Pomodoro Focus Round timer, and Attack Moves (sub-steps 1-9 or Direct Strike).
// Right Pane: Live Combat & Focus Log, Field Notes, and Tactical Hints.

import { darken } from '../color.js';
import { wrap } from '../text.js';
import { RANKS, computeQuestHp, renderChargeBar, getRitualMastery } from '../state.js';
import { generateEncounter } from '../monsters.js';
import { drawBar } from './chrome.js';

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const rem = String(s % 60).padStart(2, '0');
  return `${m}:${rem}`;
}

export function renderArenaLayout(screen, tui, palette, biome) {
  const w = screen.w;
  const h = screen.h;
  const v = biome.vocab;
  const topY = 4;
  const bottomY = h - 2;
  const availH = bottomY - topY;
  if (availH < 10) return;

  const target = tui.getArenaTarget();
  if (!target) {
    screen.fill(0, topY, w, availH, { fg: palette.text, bg: palette.bg });
    screen.box(0, topY, w, availH, {
      kind: biome.boxKind,
      st: { fg: palette.border, bg: palette.bg },
      title: '⚔ BATTLE ARENA — NO TARGET LOCKED',
      titleSt: { fg: palette.accent, bg: palette.bg, bold: true },
    });
    screen.text(3, topY + 3, `No open ${v.quest.toLowerCase()} or ${v.ritual.toLowerCase()} selected.`, { fg: palette.muted, bg: palette.bg }, w - 6);
    screen.text(3, topY + 4, '► Press [F1] Board or [F2] War Table, select a target, and press [Enter] or [F3]!', { fg: palette.accent, bg: palette.bg }, w - 6);
    return;
  }

  const isRitual = target.kind === 'ritual';
  const item = target.item;
  const isBloom = biome.progressMode === 'bloom';

  let pctRemaining = 100;
  let pctProgress = 0;
  if (isRitual) {
    const t = Math.max(1, item.targetCount || 1);
    const done = Math.min(t, item.progressCount || 0);
    pctProgress = Math.round((done / t) * 100);
    pctRemaining = Math.max(0, 100 - pctProgress);
  } else {
    const hp = computeQuestHp(item);
    pctRemaining = hp.pct;
    pctProgress = 100 - hp.pct;
  }

  const encounter = generateEncounter(item, biome, pctProgress);
  const leftW = Math.max(44, Math.floor(w * 0.56));
  const rightW = w - leftW;

  screen.fill(1, topY + 1, leftW - 2, availH - 2, { fg: palette.text, bg: palette.bg });
  screen.fill(leftW + 1, topY + 1, rightW - 2, availH - 2, { fg: palette.text, bg: palette.bg });

  const leftTitle = isBloom
    ? `✿ SANCTUARY GARDEN · ${item.title}`
    : `⚔ BATTLE ARENA · ${item.title}`;
  screen.box(0, topY, leftW, availH, {
    kind: biome.boxKind,
    st: { fg: palette.borderBright, bg: palette.bg },
    title: leftTitle,
    titleSt: { fg: palette.borderBright, bg: palette.bg, bold: true },
  });
  screen.box(leftW, topY, rightW, availH, {
    kind: biome.boxKind,
    st: { fg: palette.border, bg: palette.bg },
    title: isBloom ? '§ TENDING LOG & NOTES' : '§ COMBAT LOG & FIELD NOTES',
    titleSt: { fg: palette.accent2, bg: palette.bg, bold: true },
  });

  // LEFT PANE: Monster / Botanical Art + Stats + Focus Timer + Attack Moves
  let cy = topY + 1;
  const artColor = isBloom
    ? palette.ritual
    : pctRemaining > 60
    ? palette.hpFull
    : pctRemaining > 25
    ? palette.hpMid
    : palette.hpLow;

  const artStartX = 3;
  const infoX = Math.min(leftW - 24, artStartX + 21);
  const infoW = Math.max(12, leftW - infoX - 2);

  // Draw 7-line sprite on the left, stats next to it
  encounter.art.forEach((line, idx) => {
    if (cy + idx < bottomY - 1) {
      screen.text(artStartX, cy + idx, line, { fg: artColor, bg: palette.bg, bold: true }, 19);
    }
  });

  const rankMeta = RANKS[item.rank] || RANKS.C;
  screen.text(infoX, cy, encounter.name, { fg: palette.borderBright, bg: palette.bg, bold: true }, infoW);
  screen.text(infoX, cy + 1, encounter.subtitle, { fg: palette.muted, bg: palette.bg }, infoW);

  const barW = Math.max(10, Math.min(24, infoW - 8));
  const barLabel = isBloom ? 'Bloom:' : 'HP:   ';
  screen.put(infoX, cy + 2, barLabel, { fg: palette.muted, bg: palette.bg });
  drawBar(
    screen,
    infoX + 6,
    cy + 2,
    barW,
    isBloom ? pctProgress : pctRemaining,
    artColor,
    darken(palette.muted, 0.45),
    palette.bg
  );
  const pctStr = isBloom ? `${pctProgress}%` : `${pctRemaining}%`;
  screen.text(infoX + 6 + barW + 1, cy + 2, pctStr, { fg: palette.text, bg: palette.bg, bold: true }, 6);

  // Focus Pomodoro Round Box
  const focus = tui.focus;
  const focusTotal = (focus.durationMins || 25) * 60;
  const focusPct = Math.round(((focusTotal - focus.remainingSec) / focusTotal) * 100);
  const timerState = focus.running ? 'RUNNING' : 'PAUSED';
  const timerColor = focus.running ? '#80ed99' : palette.accent;
  screen.segs(
    infoX,
    cy + 4,
    [
      [`ROUND ${focus.round} `, { fg: palette.gold, bg: palette.bg, bold: true }],
      [`· ${formatTimer(focus.remainingSec)} `, { fg: timerColor, bg: palette.bg, bold: true }],
      [`[${timerState}]`, { fg: timerColor, bg: palette.bg }],
    ],
    infoW
  );
  drawBar(screen, infoX, cy + 5, Math.max(10, Math.min(26, infoW - 2)), focusPct, palette.xpBar, darken(palette.muted, 0.45), palette.bg);
  screen.text(infoX, cy + 6, '[f] Start/Pause  [\\] Mins  [F] Finish Round', { fg: palette.muted, bg: palette.bg }, infoW);

  cy += 8;
  if (cy < bottomY - 2) {
    screen.hline(1, cy, leftW - 2, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
    cy += 1;
  }

  // Attack Moves / Tending Actions
  if (isRitual) {
    const mastery = getRitualMastery(item.streak);
    screen.segs(
      2,
      cy,
      [
        ['⟳ REPEATING CHARGES: ', { fg: palette.ritual, bg: palette.bg, bold: true }],
        [renderChargeBar(item.progressCount, item.targetCount, 12), { fg: palette.text, bg: palette.bg, bold: true }],
        [`  (${mastery.badge} ${item.streak || 0}d chain)`, { fg: mastery.hex, bg: palette.bg }],
      ],
      leftW - 4
    );
    cy += 2;
    if (cy < bottomY - 2) {
      screen.text(3, cy, '► [Space] Log +1 Charge / Strike   [c] Complete Today   [u] Reset', { fg: palette.accent, bg: palette.bg }, leftW - 5);
    }
  } else {
    screen.segs(
      2,
      cy,
      [
        [isBloom ? '✿ TENDING ACTIONS ' : '⚔ ATTACK MOVES ', { fg: palette.accent, bg: palette.bg, bold: true }],
        ['([1-9] Sub-step · [Space] Direct Strike · [c] Final Blow)', { fg: palette.muted, bg: palette.bg }],
      ],
      leftW - 4
    );
    cy += 1;
    const steps = item.steps || [];
    if (steps.length === 0) {
      screen.text(3, cy + 1, 'No sub-steps defined. Press [Space] to deal Direct Strike damage, or [s] to add steps!', { fg: palette.muted, bg: palette.bg }, leftW - 5);
    } else {
      steps.slice(0, 9).forEach((st, idx) => {
        if (cy >= bottomY - 1) return;
        screen.segs(
          3,
          cy,
          [
            [st.done ? '[x] ' : `[${idx + 1}] `, { fg: st.done ? '#80ed99' : palette.hpFull, bg: palette.bg, bold: !st.done }],
            [st.text, { fg: st.done ? palette.muted : palette.text, bg: palette.bg }],
          ],
          leftW - 5
        );
        cy += 1;
      });
    }
  }

  // RIGHT PANE: Combat Log + Field Notes
  let ry = topY + 1;
  const rx = leftW + 2;
  const rw = rightW - 4;

  const taunt =
    pctProgress >= 100
      ? encounter.defeatLine
      : pctProgress > 0
      ? encounter.staggerLine
      : encounter.taunt;
  for (const tl of wrap(taunt, rw).slice(0, 2)) {
    screen.text(rx, ry, tl, { fg: palette.accent2, bg: palette.bg, bold: true }, rw);
    ry += 1;
  }
  screen.hline(leftW + 1, ry, rightW - 2, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
  ry += 1;

  screen.text(rx, ry, isBloom ? '✿ RECENT TENDING LOG' : '⚔ COMBAT & FOCUS LOG', { fg: palette.accent, bg: palette.bg, bold: true }, rw);
  ry += 1;
  const log = (item.combatLog || []).slice(-6);
  if (log.length === 0) {
    screen.text(rx, ry, 'Strike a move or start a Focus Round to record combat events.', { fg: palette.muted, bg: palette.bg }, rw);
    ry += 1;
  } else {
    for (const entry of log) {
      if (ry >= bottomY - 5) break;
      screen.text(rx, ry, entry, { fg: palette.text, bg: palette.bg }, rw);
      ry += 1;
    }
  }

  if (ry < bottomY - 3) {
    screen.hline(leftW + 1, ry, rightW - 2, '─', { fg: darken(palette.muted, 0.35), bg: palette.bg });
    ry += 1;
    screen.text(rx, ry, '§ FIELD NOTES ([m] Add Note)', { fg: palette.accent2, bg: palette.bg, bold: true }, rw);
    ry += 1;
    for (const note of item.notes || []) {
      for (const nl of wrap(`• ${note}`, rw)) {
        if (ry >= bottomY - 1) break;
        screen.text(rx, ry, nl, { fg: palette.text, bg: palette.bg }, rw);
        ry += 1;
      }
    }
  }
}
