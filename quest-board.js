#!/usr/bin/env node
/**
 * ============================================================================
 *  AETHORIA GUILDHALL v2 — ENCRYPTED TERMINAL QUEST BOARD
 * ============================================================================
 *  Zero-dependency, AES-256-GCM encrypted RPG Quest Board & Daily Rituals TUI.
 *  Layouts: [F1] Classic Board  |  [F2] War Table Kanban  |  [F3] Battle Arena
 * ============================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { SEQ, paint } from './src/color.js';
import { Screen } from './src/screen.js';
import { saveVaultToFile, loadVaultFromFile } from './src/crypto.js';
import {
  BIOMES,
  BIOME_LIST,
  getBiome,
  isBiomeUnlocked,
  resolvePalette,
  renderAmbientParticles,
} from './src/biomes.js';
import {
  RANKS,
  RANK_KEYS,
  CADENCES,
  CADENCE_KEYS,
  RITUAL_PRESETS,
  createInitialState,
  reconcileDailyState,
  scheduleTavernLeave,
  isOnTavernLeave,
  xpRequiredForLevel,
  getHeroTitle,
  computeQuestHp,
  hasRelic,
  awardXpAndGold,
  completeQuest,
  strikeRitual,
  resetRitualProgress,
  cycleQuestRecurrence,
  isRitualDueToday,
  renderChargeBar,
  getCommissionStatus,
  generateGuildmasterSpeech,
  getLocalDateKey,
  formatDisplayDate,
} from './src/state.js';
import { activeSeason } from './src/seasons.js';
import { renderTopChrome, renderFooter, renderModalOverlay } from './src/layouts/chrome.js';
import { renderClassicLayout } from './src/layouts/classic.js';
import { renderWarTableLayout, buildWarTableColumns } from './src/layouts/warTable.js';
import { renderArenaLayout } from './src/layouts/arena.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_VAULT_PATH = path.join(__dirname, '.quest-vault.enc.json');

// ============================================================================
// TERMINAL INPUT HELPERS (PASSWORD & WIZARD PROMPTS)
// ============================================================================

function promptHiddenPassword(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    let password = '';

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = (chunk) => {
      const str = chunk.toString('utf8');
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const code = ch.charCodeAt(0);

        if (ch === '\r' || ch === '\n') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(Boolean(wasRaw));
          }
          process.stdout.write('\n');
          resolve(password);
          return;
        } else if (code === 3) {
          process.stdout.write('\n');
          process.exit(0);
        } else if (code === 127 || code === 8) {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (code >= 32) {
          password += ch;
          process.stdout.write(paint('✦', { fg: '#ffd166' }));
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

function promptLine(questionText, defaultVal = '', palette = null) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const hasAnsi = /\x1b\[/.test(questionText);
    const label = palette && !hasAnsi ? paint(questionText, { fg: palette.text }) : questionText;
    const suffix = defaultVal
      ? palette
        ? ` ${paint(`(${defaultVal})`, { fg: palette.borderBright, bold: true })}: `
        : ` (${defaultVal}): `
      : ': ';
    rl.question(`${label}${suffix}`, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultVal);
    });
  });
}

export function resolveRealmInput(rawInput, availableRealms, defaultRealm = 'Main Campaign') {
  const s = String(rawInput ?? '').trim();
  if (!s) return defaultRealm;
  if (/^\d+$/.test(s)) {
    const idx = parseInt(s, 10) - 1;
    if (idx >= 0 && idx < availableRealms.length) {
      return availableRealms[idx];
    }
  }
  const lower = s.toLowerCase();
  const exact = availableRealms.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;
  const prefix = availableRealms.find((r) => r.toLowerCase().startsWith(lower));
  if (prefix) return prefix;
  return s;
}

export function resolveCadenceInput(rawInput, defaultCadence = 'daily', allowNone = false) {
  const s = String(rawInput ?? '').trim().toLowerCase();
  if (!s) return defaultCadence === 'none' ? null : defaultCadence;
  if (allowNone && (s === '0' || s === 'none' || s === 'once')) return null;
  if (/^[1-9]\d*$/.test(s)) {
    const idx = parseInt(s, 10) - 1;
    if (idx >= 0 && idx < CADENCE_KEYS.length) return CADENCE_KEYS[idx];
  }
  if (CADENCE_KEYS.includes(s)) return s;
  const prefix = CADENCE_KEYS.find((k) => k.startsWith(s));
  if (prefix) return prefix;
  return allowNone ? (defaultCadence === 'none' ? null : defaultCadence) : defaultCadence;
}

// ============================================================================
// VAULT BOOTSTRAP
// ============================================================================

async function unlockOrInitializeVault(vaultPath, cliPassword = null) {
  const exists = fs.existsSync(vaultPath);

  if (!exists) {
    if (cliPassword) {
      const state = createInitialState('Adventurer');
      saveVaultToFile(vaultPath, state, cliPassword);
      return { state, password: cliPassword };
    }

    console.clear();
    console.log(paint('╔══════════════════════════════════════════════════════════════════════════╗', { fg: '#ffd166', bold: true }));
    console.log(paint('║         ✦  WELCOME TO AETHORIA GUILDHALL — NEW QUEST VAULT  ✦            ║', { fg: '#ffd166', bold: true }));
    console.log(paint('╚══════════════════════════════════════════════════════════════════════════╝', { fg: '#ffd166', bold: true }));
    console.log(`  No encrypted Quest Vault found at: ${paint(path.basename(vaultPath), { fg: '#4cc9f0' })}`);
    console.log('  Forging your Adventurer Seal (AES-256-GCM + scrypt encryption).\n');

    const heroName = await promptLine(`  ${paint('► Enter your Adventurer Name', { fg: '#f09d38' })}`, 'Wayfarer');

    let password = '';
    while (true) {
      const pw1 = await promptHiddenPassword(`  ${paint('► Set your Guild Vault Passphrase: ', { fg: '#f09d38' })}`);
      if (!pw1) {
        console.log(paint('  Passphrase cannot be empty.', { fg: '#ff3b5c' }));
        continue;
      }
      const pw2 = await promptHiddenPassword(`  ${paint('► Confirm Guild Vault Passphrase : ', { fg: '#f09d38' })}`);
      if (pw1 !== pw2) {
        console.log(paint('  Passphrases did not match! Try again.\n', { fg: '#ff3b5c' }));
        continue;
      }
      password = pw1;
      break;
    }

    const state = createInitialState(heroName);
    saveVaultToFile(vaultPath, state, password);
    console.log(paint('\n  ✔ Arcane Seal forged and encrypted! Opening the Guildhall...', { fg: '#80ed99' }));
    await new Promise((r) => setTimeout(r, 500));
    return { state, password };
  }

  if (cliPassword) {
    const state = loadVaultFromFile(vaultPath, cliPassword);
    reconcileDailyState(state);
    return { state, password: cliPassword };
  }

  console.clear();
  console.log(paint('╔══════════════════════════════════════════════════════════════════════════╗', { fg: '#b5843a', bold: true }));
  console.log(paint('║            ⚔  AETHORIA GUILDHALL — ARCANE VAULT SEALED  ⚔                ║', { fg: '#b5843a', bold: true }));
  console.log(paint('╚══════════════════════════════════════════════════════════════════════════╝', { fg: '#b5843a', bold: true }));
  console.log(`  Vault File : ${vaultPath}`);
  console.log(`  Cipher     : ${paint('AES-256-GCM (Authenticated Scrypt Key Derivation)', { fg: '#4cc9f0' })}\n`);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const pw = await promptHiddenPassword(
      `  ${paint(`🔑 Speak your Guild Passphrase to unseal (${attempt}/5): `, { fg: '#ffd166' })}`
    );
    try {
      const state = loadVaultFromFile(vaultPath, pw);
      reconcileDailyState(state);
      saveVaultToFile(vaultPath, state, pw);
      return { state, password: pw };
    } catch {
      console.log(paint('  ✖ The Arcane Seal flares crimson! Incorrect passphrase.\n', { fg: '#ff3b5c' }));
    }
  }

  console.log(paint('  Too many failed attempts. The Guildhall doors remain bolted.', { fg: '#ff3b5c' }));
  process.exit(1);
}

// ============================================================================
// INTERACTIVE FULL-SCREEN TUI APPLICATION
// ============================================================================

class QuestBoardTUI {
  constructor(vaultPath, state, password, opts = {}) {
    this.vaultPath = vaultPath;
    this.state = state;
    this.password = password;

    this.viewTab = opts.view || 'board'; // 'board' | 'pouch' | 'rituals' | 'archive'
    this.realmFilter = 'ALL';
    this.sortMode = 'rank';
    this.selectedIndex = 0;
    this.selectedRitualIndex = 0;

    // War Table cursor
    this.warCol = 0;
    this.warRow = 0;

    // Battle Arena target & Pomodoro Focus Timer
    this.prevLayout = 'classic';
    this.arenaTarget = null; // { kind: 'quest'|'ritual', id: string }
    this.focus = {
      durationMins: 25,
      remainingSec: 25 * 60,
      running: false,
      round: 1,
    };

    this.guildSpeech = generateGuildmasterSpeech(this.state);
    this.activeModal = null;
    this.helpTab = 0;
    this.helpScroll = 0;
    this.legendsIndex = 0;
    this.rollingDieValue = 20;
    this.isPrompting = false;
    this.tick = 0;

    const cols = Math.max(80, process.stdout.columns || 110);
    const rows = Math.max(24, process.stdout.rows || 32);
    this.screen = new Screen(cols, rows);
  }

  save() {
    saveVaultToFile(this.vaultPath, this.state, this.password);
  }

  getRealmsList() {
    const set = new Set(this.state.realms || []);
    for (const q of this.state.quests || []) {
      if (q.realm) set.add(q.realm);
    }
    for (const r of this.state.rituals || []) {
      if (r.realm) set.add(r.realm);
    }
    return ['ALL', ...Array.from(set)];
  }

  getFilteredQuests() {
    let list = this.state.quests.filter((q) => {
      if (this.viewTab === 'archive') return q.status === 'done';
      if (this.viewTab === 'pouch') return q.status === 'open' && q.inPouch;
      return q.status === 'open';
    });

    if (this.realmFilter !== 'ALL') {
      list = list.filter((q) => q.realm === this.realmFilter);
    }

    list.sort((a, b) => {
      if (this.sortMode === 'rank') {
        if (a.inPouch !== b.inPouch && this.viewTab === 'board') {
          return a.inPouch ? -1 : 1;
        }
        const rA = (RANKS[a.rank] || RANKS.C).order;
        const rB = (RANKS[b.rank] || RANKS.C).order;
        if (rA !== rB) return rA - rB;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (this.sortMode === 'hp') {
        return computeQuestHp(a).pct - computeQuestHp(b).pct;
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return list;
  }

  getFilteredRituals() {
    let list = [...(this.state.rituals || [])];
    if (this.realmFilter !== 'ALL') {
      list = list.filter((r) => r.realm === this.realmFilter);
    }
    list.sort((a, b) => {
      const aDue = isRitualDueToday(a) ? 0 : 1;
      const bDue = isRitualDueToday(b) ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
      return (b.streak || 0) - (a.streak || 0);
    });
    return list;
  }

  getSelectedQuest() {
    const list = this.getFilteredQuests();
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, Math.max(0, list.length - 1)));
    return list[this.selectedIndex] || null;
  }

  getSelectedRitual() {
    const list = this.getFilteredRituals();
    this.selectedRitualIndex = Math.max(
      0,
      Math.min(this.selectedRitualIndex, Math.max(0, list.length - 1))
    );
    return list[this.selectedRitualIndex] || null;
  }

  getFocusedItem() {
    const layout = this.state.hero.layout || 'classic';
    if (layout === 'wartable') {
      const cols = buildWarTableColumns(this.state);
      const col = cols[this.warCol];
      if (!col || col.items.length === 0) return null;
      const item = col.items[Math.min(this.warRow, col.items.length - 1)];
      return item ? { kind: col.isRituals ? 'ritual' : 'quest', item } : null;
    }
    if (layout === 'arena') {
      return this.getArenaTarget();
    }
    if (this.viewTab === 'rituals') {
      const r = this.getSelectedRitual();
      return r ? { kind: 'ritual', item: r } : null;
    }
    const q = this.getSelectedQuest();
    return q ? { kind: 'quest', item: q } : null;
  }

  getArenaTarget() {
    if (this.arenaTarget) {
      if (this.arenaTarget.kind === 'ritual') {
        const r = (this.state.rituals || []).find((x) => x.id === this.arenaTarget.id);
        if (r) return { kind: 'ritual', item: r };
      } else {
        const q = this.state.quests.find((x) => x.id === this.arenaTarget.id);
        if (q) return { kind: 'quest', item: q };
      }
    }
    const firstOpen = this.state.quests.find((q) => q.status === 'open' && q.inPouch) ||
      this.state.quests.find((q) => q.status === 'open');
    if (firstOpen) {
      this.arenaTarget = { kind: 'quest', id: firstOpen.id };
      return { kind: 'quest', item: firstOpen };
    }
    const firstRit = (this.state.rituals || [])[0];
    if (firstRit) {
      this.arenaTarget = { kind: 'ritual', id: firstRit.id };
      return { kind: 'ritual', item: firstRit };
    }
    return null;
  }

  enterArenaWithFocus() {
    const focused = this.getFocusedItem();
    if (focused) {
      this.arenaTarget = { kind: focused.kind, id: focused.item.id };
    }
    if (this.state.hero.layout !== 'arena') {
      this.prevLayout = this.state.hero.layout || 'classic';
      this.state.hero.layout = 'arena';
      this.save();
    }
    this.render();
  }

  setCombatBanner(text, mood = 'hype') {
    this.guildSpeech = { mood, line: text };
  }

  pushArenaLog(item, line) {
    if (!item) return;
    if (!Array.isArray(item.combatLog)) item.combatLog = [];
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.combatLog.push(`${stamp}  ${line}`);
    if (item.combatLog.length > 30) item.combatLog = item.combatLog.slice(-30);
  }

  renderToScreen(cols, rows) {
    if (this.screen.w !== cols || this.screen.h !== rows) {
      this.screen.resize(cols, rows);
    } else {
      this.screen.clear();
    }

    const biome = getBiome(this.state);
    const palette = resolvePalette(this.state, new Date(), this.tick);
    this.screen.fill(0, 0, cols, rows, { fg: palette.text, bg: palette.bg, solid: false });

    renderTopChrome(this.screen, this, palette, biome);

    const layout = this.state.hero.layout || 'classic';
    if (layout === 'wartable') {
      renderWarTableLayout(this.screen, this, palette, biome);
    } else if (layout === 'arena') {
      renderArenaLayout(this.screen, this, palette, biome);
    } else {
      renderClassicLayout(this.screen, this, palette, biome);
    }

    renderFooter(this.screen, this, palette, biome);
    renderAmbientParticles(this.screen, this.state, palette, this.tick);
    renderModalOverlay(this.screen, this, palette, biome);
    return this.screen;
  }

  render() {
    if (this.isPrompting) return;
    const cols = Math.max(80, process.stdout.columns || 110);
    const rows = Math.max(24, process.stdout.rows || 32);
    this.renderToScreen(cols, rows);
    this.screen.flush(process.stdout);
  }

  // --------------------------------------------------------------------------
  // ACTIONS & WIZARDS
  // --------------------------------------------------------------------------

  async withPromptMode(fn) {
    this.isPrompting = true;
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write(SEQ.showCursor + SEQ.clear);
    try {
      await fn();
    } finally {
      this.save();
      this.screen.invalidate();
      process.stdout.write(SEQ.hideCursor);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.resume();
      this.isPrompting = false;
      this.render();
    }
  }

  printWizardHeader(title, subtitle = '') {
    const biome = getBiome(this.state);
    const p = biome.palette;
    const v = biome.vocab;
    const bannerText = `✦ ${v.title} (${biome.name}) — ${title} ✦`;
    const innerW = Math.max(54, bannerText.length + 4);
    const bar = '═'.repeat(innerW);
    console.log('');
    console.log(paint(`╔${bar}╗`, { fg: p.borderBright, bold: true }));
    console.log(paint(`║  ${bannerText.padEnd(innerW - 2)}║`, { fg: p.headerFg, bg: p.headerBg, bold: true }));
    console.log(paint(`╚${bar}╝`, { fg: p.borderBright, bold: true }));
    const companion = `${paint(biome.npcMoods.idle.trim(), { fg: p.accent, bold: true })} ${paint(biome.npcName, { fg: p.accent2, bold: true })}`;
    const sub = subtitle ? paint(` · ${subtitle}`, { fg: p.muted }) : '';
    console.log(`  ${companion}${sub}\n`);
    return biome;
  }

  async promptRealmSelection(stepLabel, defaultRealm = 'Main Campaign') {
    const biome = getBiome(this.state);
    const p = biome.palette;
    const v = biome.vocab;
    const realms = this.getRealmsList().filter((r) => r !== 'ALL');

    console.log(paint(`     Available ${v.realm}s (Task Groups):`, { fg: p.accent, bold: true }));
    const chips = realms.map((r, i) => {
      const tag = `[${i + 1}] ${r}`;
      return r === defaultRealm
        ? paint(tag, { fg: p.borderBright, bold: true })
        : paint(tag, { fg: p.text });
    });
    for (let i = 0; i < chips.length; i += 3) {
      console.log(`       ${chips.slice(i, i + 3).join('   ')}`);
    }
    console.log(
      paint(`     (Enter 1-${realms.length} to pick, type a new group name to add one, or Enter for '${defaultRealm}')`, { fg: p.muted })
    );

    const raw = await promptLine(stepLabel, defaultRealm, p);
    const picked = resolveRealmInput(raw, realms, defaultRealm);
    if (picked && !this.state.realms.includes(picked)) {
      this.state.realms.push(picked);
    }
    return picked || defaultRealm;
  }

  async promptCadenceSelection(stepLabel, defaultCadence = 'daily', allowNone = false) {
    const biome = getBiome(this.state);
    const p = biome.palette;
    const opts = [];
    if (allowNone) {
      opts.push(paint('[0] none (One-time)', { fg: p.muted }));
    }
    CADENCE_KEYS.forEach((k, idx) => {
      const label = `[${idx + 1}] ${k}`;
      opts.push(k === defaultCadence ? paint(label, { fg: p.borderBright, bold: true }) : paint(label, { fg: p.text }));
    });
    console.log(`     ${paint('Repeat Cadence Options:', { fg: p.accent, bold: true })} ${opts.join('  ')}`);
    const defDisplay = defaultCadence || 'none';
    const raw = await promptLine(stepLabel, defDisplay, p);
    return resolveCadenceInput(raw, defDisplay, allowNone);
  }

  async createItemWizard(forceRitual = false) {
    await this.withPromptMode(async () => {
      const biome = getBiome(this.state);
      const v = biome.vocab;
      const p = biome.palette;
      const inRituals =
        forceRitual ||
        (this.state.hero.layout === 'classic' && this.viewTab === 'rituals') ||
        (this.state.hero.layout === 'wartable' && this.warCol === 0);

      let kind = inRituals ? 'r' : 'q';
      if (!forceRitual) {
        this.printWizardHeader(
          `NEW ${v.quest.toUpperCase()} OR ${v.ritual.toUpperCase()}`,
          `Theme: ${biome.name}`
        );
        const choice = (
          await promptLine(
            `  ${paint(`Create [q] ${v.quest} (Task) or [r] Repeating ${v.ritual} (Daily Habit)`, { fg: p.accent, bold: true })}`,
            inRituals ? 'r' : 'q',
            p
          )
        ).toLowerCase();
        kind = choice === 'r' ? 'r' : 'q';
      }

      if (kind === 'r') {
        if (forceRitual) {
          this.printWizardHeader(
            `NEW REPEATING ${v.ritual.toUpperCase()} (HABIT)`,
            `Resets automatically by schedule`
          );
        } else {
          console.log(paint(`\n  ── Forging Repeating ${v.ritual} (Daily Habit) ──\n`, { fg: p.ritual, bold: true }));
        }
        const title = await promptLine(`  1. ${v.ritual} Title (blank to cancel)`, '', p);
        if (!title) return;
        const countStr = await promptLine('  2. Daily Target Charges (e.g. 1 for Workout, 8 for Water)', '1', p);
        const targetCount = Math.max(1, Math.min(30, parseInt(countStr, 10) || 1));
        const cadence = await this.promptCadenceSelection('  3. Repeat Cadence', 'daily', false);
        const rankIn = (await promptLine('  4. Priority Rank [S / A / B / C / D]', 'C', p)).toUpperCase();
        const rank = RANK_KEYS.includes(rankIn) ? rankIn : 'C';
        const defaultRealm = this.realmFilter !== 'ALL' ? this.realmFilter : 'Homestead';
        const realm = await this.promptRealmSelection(`  5. ${v.realm} (Task Group)`, defaultRealm);
        const note = await promptLine('  6. Note / Cue (optional)', '', p);

        this.state.rituals.unshift({
          id: 'rit-' + crypto.randomBytes(4).toString('hex'),
          title,
          cadence,
          targetCount,
          progressCount: 0,
          completedToday: false,
          lastCompletedDate: null,
          rank,
          realm,
          streak: 0,
          bestStreak: 0,
          totalCompletions: 0,
          createdAt: new Date().toISOString(),
          notes: note ? [note] : [],
        });
        this.selectedRitualIndex = 0;
        this.setCombatBanner(`"Added repeating ${v.ritual}: '${title}' (${CADENCES[cadence].label}, ${targetCount}x)!"`, 'hype');
        return;
      }

      if (!forceRitual) {
        console.log(paint(`\n  ── Posting New ${v.quest} (Task) ──\n`, { fg: p.borderBright, bold: true }));
      }
      const title = await promptLine(`  1. ${v.quest} Title (blank to cancel)`, '', p);
      if (!title) return;
      const rankIn = (await promptLine('  2. Priority Rank [S / A / B / C / D]', 'B', p)).toUpperCase();
      const rank = RANK_KEYS.includes(rankIn) ? rankIn : 'B';
      const defaultRealm = this.realmFilter !== 'ALL' ? this.realmFilter : 'Main Campaign';
      const realm = await this.promptRealmSelection(`  3. ${v.realm} (Task Group)`, defaultRealm);
      const stepsRaw = await promptLine('  4. Sub-Steps (comma-separated, optional)', '', p);
      const steps = stepsRaw
        ? stepsRaw.split(',').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false }))
        : [];
      const recurrence = await this.promptCadenceSelection('  5. Repeat Cadence', 'none', true);
      const noteRaw = await promptLine('  6. Field Note (optional)', '', p);
      const pickNow = (await promptLine(`  7. Add to Today's ${v.pouch} (Today's List)? [Y/n]`, 'Y', p)).toLowerCase();

      this.state.quests.unshift({
        id: 'q-' + crypto.randomBytes(4).toString('hex'),
        title,
        rank,
        realm,
        inPouch: pickNow !== 'n',
        status: 'open',
        recurrence,
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: new Date().toISOString(),
        notes: noteRaw ? [noteRaw] : [],
        steps,
        combatLog: [],
      });
      this.selectedIndex = 0;
      this.setCombatBanner(`"Posted [${rank}-Rank] '${title}' to ${realm}!"`, 'hype');
    });
  }

  async editFocusedWizard() {
    const focused = this.getFocusedItem();
    if (!focused) return;
    await this.withPromptMode(async () => {
      const item = focused.item;
      const isRitual = focused.kind === 'ritual';
      const biome = getBiome(this.state);
      const v = biome.vocab;
      const p = biome.palette;

      this.printWizardHeader(
        isRitual
          ? `EDIT ${v.ritual.toUpperCase()} (HABIT)`
          : `EDIT ${v.quest.toUpperCase()} (TASK)`,
        `Editing: ${item.title}`
      );

      item.title = await promptLine(`  1. ${isRitual ? v.ritual : v.quest} Title`, item.title, p);
      const rIn = (await promptLine('  2. Priority Rank [S / A / B / C / D]', item.rank || 'B', p)).toUpperCase();
      if (RANK_KEYS.includes(rIn)) item.rank = rIn;
      const realm = await this.promptRealmSelection(`  3. ${v.realm} (Task Group)`, item.realm || 'Main Campaign');
      if (realm) item.realm = realm;

      if (isRitual) {
        const cStr = await promptLine('  4. Daily Target Count', String(item.targetCount || 1), p);
        item.targetCount = Math.max(1, Math.min(30, parseInt(cStr, 10) || 1));
        item.cadence = await this.promptCadenceSelection('  5. Repeat Cadence', item.cadence || 'daily', false);
      } else {
        item.recurrence = await this.promptCadenceSelection('  4. Repeat Cadence', item.recurrence || 'none', true);
        const curInPouch = item.inPouch ? 'Y' : 'n';
        const pickAns = (await promptLine(`  5. In Today's ${v.pouch} (Today's List)? [Y/n]`, curInPouch, p)).toLowerCase();
        item.inPouch = pickAns !== 'n';
      }
      this.setCombatBanner(`"Updated details for '${item.title}'!"`, 'idle');
    });
  }

  async addSubStepWizard() {
    const focused = this.getFocusedItem();
    if (!focused || focused.kind !== 'quest' || focused.item.status === 'done') return;
    const quest = focused.item;
    await this.withPromptMode(async () => {
      const biome = getBiome(this.state);
      const v = biome.vocab;
      const p = biome.palette;
      this.printWizardHeader(`ADD SUB-STEP TO ${v.quest.toUpperCase()}`, quest.title);
      const text = await promptLine('  New Sub-Step (blank to cancel)', '', p);
      if (text) {
        if (!quest.steps) quest.steps = [];
        quest.steps.push({ text, done: false });
        this.setCombatBanner(`"Added objective '${text}'!"`, 'idle');
      }
    });
  }

  async addNoteWizard() {
    const focused = this.getFocusedItem();
    if (!focused) return;
    const item = focused.item;
    await this.withPromptMode(async () => {
      const biome = getBiome(this.state);
      const p = biome.palette;
      this.printWizardHeader('ADD FIELD NOTE / DETAIL', item.title);
      const text = await promptLine('  Note / Detail (blank to cancel)', '', p);
      if (text) {
        if (!item.notes) item.notes = [];
        const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        item.notes.push(`[${stamp}] ${text}`);
        this.setCombatBanner(`"Field note inscribed onto '${item.title}'."`, 'idle');
      }
    });
  }

  async changePassphraseWizard() {
    await this.withPromptMode(async () => {
      const biome = getBiome(this.state);
      const p = biome.palette;
      this.printWizardHeader('RE-FORGE VAULT PASSPHRASE', 'AES-256-GCM Encryption Key');
      const cur = await promptHiddenPassword(`  ${paint('Current Passphrase:', { fg: p.accent, bold: true })} `);
      if (cur !== this.password) {
        console.log(paint('\n  ✖ Incorrect current passphrase!', { fg: '#ff3b5c' }));
        await new Promise((r) => setTimeout(r, 1100));
        return;
      }
      const next1 = await promptHiddenPassword(`  ${paint('New Passphrase    :', { fg: p.accent, bold: true })} `);
      if (!next1) return;
      const next2 = await promptHiddenPassword(`  ${paint('Confirm Passphrase:', { fg: p.accent, bold: true })} `);
      if (next1 !== next2) {
        console.log(paint('\n  ✖ Passphrases did not match!', { fg: '#ff3b5c' }));
        await new Promise((r) => setTimeout(r, 1100));
        return;
      }
      this.password = next1;
      this.save();
      this.setCombatBanner('"Arcane Vault Seal re-forged with your new passphrase!"', 'hype');
    });
  }

  async rollForFateAnimation() {
    const candidates = this.state.quests.filter((q) => q.status === 'open');
    if (candidates.length === 0) {
      this.setCombatBanner('"No open contracts to roll for! Press [n] to create one."', 'tease');
      this.render();
      return;
    }

    const unpicked = candidates.filter((q) => !q.inPouch);
    const pool = unpicked.length > 0 ? unpicked : candidates;
    const finalRoll = Math.floor(Math.random() * 20) + 1;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    this.activeModal = 'fate_rolling';
    for (let i = 0; i < 7; i++) {
      this.rollingDieValue = i === 6 ? finalRoll : Math.floor(Math.random() * 20) + 1;
      this.render();
      await new Promise((r) => setTimeout(r, 70));
    }
    this.activeModal = null;

    const isNat20 = finalRoll === 20;
    chosen.inPouch = true;
    chosen.bountyMultiplier = isNat20 ? 2.0 : 1.5;
    chosen.bountyLabel = isNat20
      ? 'NAT 20 MYTHIC BOUNTY (2.0x + Relic!)'
      : `d20=${finalRoll} FATE BOUNTY (1.5x)`;
    this.state.hero.fateRolls = (this.state.hero.fateRolls || 0) + 1;

    this.save();
    const list = this.getFilteredQuests();
    const idx = list.findIndex((q) => q.id === chosen.id);
    if (idx >= 0) this.selectedIndex = idx;

    this.setCombatBanner(
      isNat20
        ? `★ NATURAL 20!! '${chosen.title}' gets a 2.0x MYTHIC BOUNTY & guaranteed Relic!`
        : `♦ Rolled d20=[${finalRoll}]! '${chosen.title}' added with a 1.5x Bounty!`,
      'fate'
    );
    this.render();
  }

  handleStrikeSubStep(stepIdx) {
    const focused = this.getFocusedItem();
    if (!focused || focused.kind !== 'quest' || focused.item.status === 'done') return;
    const quest = focused.item;
    if (!quest.steps || !quest.steps[stepIdx]) return;

    const step = quest.steps[stepIdx];
    step.done = !step.done;

    if (step.done) {
      const isCrit = Math.random() < 0.35;
      const chipXp = (isCrit ? 15 : 8) + (hasRelic(this.state.hero, 'featherquill_blade') ? 5 : 0);
      if (isCrit) this.state.hero.critsLanded = (this.state.hero.critsLanded || 0) + 1;
      awardXpAndGold(this.state, chipXp, isCrit ? 4 : 2);
      const hp = computeQuestHp(quest);
      const msg = isCrit
        ? `★ CRITICAL STRIKE! '${step.text}' (+${chipXp} XP) -> ${hp.pct}% HP left!`
        : `► Direct Hit! '${step.text}' (+${chipXp} XP) -> ${hp.pct}% HP left.`;
      this.pushArenaLog(quest, `${isCrit ? 'CRIT!' : 'HIT'} ${step.text} (+${chipXp} XP)`);
      this.setCombatBanner(msg, 'crit');
    } else {
      this.setCombatBanner(`"Re-opened sub-step '${step.text}'."`, 'idle');
    }

    this.save();
    this.render();
  }

  handleDirectStrikeOrPick() {
    const layout = this.state.hero.layout || 'classic';
    const focused = this.getFocusedItem();
    if (!focused) return;

    if (focused.kind === 'ritual') {
      const r = focused.item;
      const res = strikeRitual(this.state, r);
      if (!res) return;
      if (res.alreadyDone) {
        this.setCombatBanner(`"'${r.title}' is already completed today! Press [u] to reset."`, 'idle');
      } else if (!res.completed) {
        this.pushArenaLog(r, `Charge ${res.progressCount}/${res.targetCount} (+${res.finalXp} XP)`);
        this.setCombatBanner(
          `⟳ '${r.title}' charged: ${renderChargeBar(res.progressCount, res.targetCount)} (+${res.finalXp} XP)`,
          'crit'
        );
      } else {
        this.pushArenaLog(r, `COMPLETED! Chain ${r.streak}d (+${res.finalXp} XP)`);
        let msg = `✔ DAILY RITUAL DONE! '${r.title}' (${r.streak}d Chain!) +${res.finalXp} XP, +${res.finalGold}g`;
        if (res.chestOpened) msg += ' ★ COMMISSION CHEST OPENED (+60 XP, +30g)!';
        if (res.chestDrop) msg += ` ✦ RELIC: [${res.chestDrop.name}]!`;
        this.setCombatBanner(msg, 'hype');
      }
      this.save();
      this.render();
      return;
    }

    const q = focused.item;
    if (layout === 'arena') {
      if (q.status === 'done') return;
      const nextStepIdx = (q.steps || []).findIndex((s) => !s.done);
      if (nextStepIdx >= 0) {
        this.handleStrikeSubStep(nextStepIdx);
        return;
      }
      const rankHp = { S: 500, A: 350, B: 200, C: 120, D: 60 }[q.rank] || 150;
      const chunk = Math.ceil(rankHp * 0.25);
      q.directDamage = Math.min(rankHp, (q.directDamage || 0) + chunk);
      const isCrit = Math.random() < 0.35;
      if (isCrit) this.state.hero.critsLanded = (this.state.hero.critsLanded || 0) + 1;
      const xp = isCrit ? 14 : 8;
      awardXpAndGold(this.state, xp, 2);
      const hp = computeQuestHp(q);
      this.pushArenaLog(q, `${isCrit ? 'CRIT' : 'STRIKE'} -${chunk} HP (+${xp} XP)`);
      this.setCombatBanner(
        hp.pct <= 0
          ? `★ BOSS STAGGERED AT 0% HP! Press [c] to deal the Final Blow!`
          : `⚔ ${isCrit ? 'CRIT!' : 'Strike!'} Dealt ${chunk} dmg (+${xp} XP) -> ${hp.pct}% HP left!`,
        'crit'
      );
      this.save();
      this.render();
      return;
    }

    // Classic / WarTable: toggle Active Pouch
    if (q.status === 'open') {
      q.inPouch = !q.inPouch;
      this.save();
      this.setCombatBanner(
        q.inPouch
          ? `★ Added '${q.title}' to Today's ${getBiome(this.state).vocab.pouch}!`
          : `Returned '${q.title}' to the board.`,
        q.inPouch ? 'hype' : 'idle'
      );
      this.render();
    }
  }

  handleCompleteItem() {
    const focused = this.getFocusedItem();
    if (!focused) return;

    if (focused.kind === 'ritual') {
      const r = focused.item;
      r.progressCount = Math.max(0, (r.targetCount || 1) - 1);
      const res = strikeRitual(this.state, r);
      if (res && !res.alreadyDone) {
        let msg = `✔ '${r.title}' completed! (${r.streak}d Chain) +${res.finalXp} XP, +${res.finalGold}g`;
        if (res.chestOpened) msg += ' ★ DAILY COMMISSION CHEST OPENED!';
        if (res.chestDrop) msg += ` ✦ RELIC: [${res.chestDrop.name}]!`;
        this.setCombatBanner(msg, 'hype');
        this.save();
        this.render();
      }
      return;
    }

    const q = focused.item;
    if (q.status === 'done') return;
    const res = completeQuest(this.state, q);
    this.save();
    let msg = `★ SLAIN! '${q.title}' -> +${res.finalXp} XP, +${res.finalGold}g!`;
    if (res.leveledUp) msg += ` ★ LEVEL UP Lv.${res.newLevel}!`;
    if (res.fullClearTriggered) msg += ' ★ FULL-CLEAR COMBO!';
    if (res.droppedRelic) msg += ` ✦ RELIC: [${res.droppedRelic.name}]!`;
    this.setCombatBanner(msg, 'hype');
    this.render();
  }

  finishFocusRound(autoComplete = false) {
    const target = this.getArenaTarget();
    const season = activeSeason();
    const bonus = (season?.focusBonus || 0) + (hasRelic(this.state.hero, 'firefly_jar') ? 10 : 0);
    const reward = awardXpAndGold(this.state, 25 + bonus, 8);
    if (target) {
      this.pushArenaLog(target.item, `Focus Round ${this.focus.round} complete (+${reward.finalXp} XP)`);
    }
    this.focus.running = false;
    this.focus.round += 1;
    this.focus.remainingSec = this.focus.durationMins * 60;
    this.save();
    this.setCombatBanner(
      `${autoComplete ? '⏳ FOCUS ROUND COMPLETE!' : '★ FOCUS BURST LOGGED!'} +${reward.finalXp} XP, +${reward.finalGold}g!`,
      'hype'
    );
    this.render();
  }

  // --------------------------------------------------------------------------
  // KEYBOARD & TIMER EVENT LOOP
  // --------------------------------------------------------------------------

  start() {
    process.stdout.write(SEQ.altOn + SEQ.hideCursor + SEQ.clear);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    let secAccum = 0;
    const interval = setInterval(() => {
      if (this.isPrompting) return;
      this.tick += 1;
      let shouldRender = this.state.hero.settings?.animations !== false;

      // Live midnight rollover: reset daily rituals & respawn due recurring quests
      const todayKey = getLocalDateKey();
      if (this.state.hero.dailyLogDate !== todayKey) {
        reconcileDailyState(this.state);
        this.save();
        this.setCombatBanner('☀ A new day dawns! Daily Rituals and recurring quests have refreshed for today.', 'hype');
        shouldRender = true;
      }

      if (this.focus.running && this.state.hero.layout === 'arena') {
        secAccum += 250;
        if (secAccum >= 1000) {
          secAccum -= 1000;
          this.focus.remainingSec = Math.max(0, this.focus.remainingSec - 1);
          shouldRender = true;
          if (this.focus.remainingSec === 0) {
            process.stdout.write(SEQ.bell);
            this.finishFocusRound(true);
            return;
          }
        }
      }
      if (shouldRender) this.render();
    }, 250);

    const onResize = () => this.render();
    process.stdout.on('resize', onResize);

    const cleanupAndExit = () => {
      clearInterval(interval);
      this.save();
      process.stdout.write(SEQ.showCursor + SEQ.altOff);
      process.exit(0);
    };
    process.on('SIGINT', cleanupAndExit);

    process.stdin.on('keypress', async (str, key) => {
      if (this.isPrompting || !key) return;
      if (key.ctrl && key.name === 'c') {
        cleanupAndExit();
        return;
      }

      if (this.activeModal) {
        await this.handleModalKeypress(str, key);
        return;
      }

      // Global Layout Switching (F1/F2/F3)
      if (key.name === 'f1') {
        this.state.hero.layout = 'classic';
        this.save();
        this.render();
        return;
      }
      if (key.name === 'f2') {
        this.state.hero.layout = 'wartable';
        this.save();
        this.render();
        return;
      }
      if (key.name === 'f3') {
        this.enterArenaWithFocus();
        return;
      }

      const layout = this.state.hero.layout || 'classic';

      if (key.name === 'q') {
        cleanupAndExit();
        return;
      }

      // Navigation
      if (layout === 'wartable') {
        const cols = buildWarTableColumns(this.state);
        const curCol = cols[this.warCol];
        if (key.name === 'left' || str === 'h') {
          this.warCol = Math.max(0, this.warCol - 1);
          this.warRow = 0;
          this.render();
          return;
        }
        if (key.name === 'right' || str === 'l') {
          this.warCol = Math.min(cols.length - 1, this.warCol + 1);
          this.warRow = 0;
          this.render();
          return;
        }
        if (key.name === 'up' || str === 'k') {
          this.warRow = Math.max(0, this.warRow - 1);
          this.render();
          return;
        }
        if (key.name === 'down' || str === 'j') {
          const maxR = Math.max(0, (curCol?.items.length || 1) - 1);
          this.warRow = Math.min(maxR, this.warRow + 1);
          this.render();
          return;
        }
        if (str === '<' || str === '>' || str === 'H' || str === 'L') {
          if (curCol && !curCol.isRituals && curCol.items[this.warRow]) {
            const q = curCol.items[this.warRow];
            const dir = str === '<' || str === 'H' ? -1 : 1;
            const realmCols = cols.slice(1);
            const rIdx = realmCols.findIndex((c) => c.id === curCol.id);
            const nextIdx = Math.max(0, Math.min(realmCols.length - 1, rIdx + dir));
            if (nextIdx !== rIdx) {
              q.realm = realmCols[nextIdx].id;
              this.warCol = nextIdx + 1;
              this.warRow = 0;
              this.save();
              this.setCombatBanner(`"Moved '${q.title}' to ${q.realm}!"`, 'idle');
              this.render();
            }
          }
          return;
        }
      } else if (layout === 'classic') {
        const activeList =
          this.viewTab === 'rituals' ? this.getFilteredRituals() : this.getFilteredQuests();
        if (key.name === 'up' || str === 'k') {
          if (this.viewTab === 'rituals') {
            this.selectedRitualIndex = Math.max(0, this.selectedRitualIndex - 1);
          } else {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          }
          this.render();
          return;
        }
        if (key.name === 'down' || str === 'j') {
          const maxIdx = Math.max(0, activeList.length - 1);
          if (this.viewTab === 'rituals') {
            this.selectedRitualIndex = Math.min(maxIdx, this.selectedRitualIndex + 1);
          } else {
            this.selectedIndex = Math.min(maxIdx, this.selectedIndex + 1);
          }
          this.render();
          return;
        }
      }

      // Arena Retreat & Focus Timer Controls
      if (layout === 'arena') {
        if (key.name === 'escape') {
          this.state.hero.layout = this.prevLayout || 'classic';
          this.save();
          this.render();
          return;
        }
        if (str === 'f') {
          this.focus.running = !this.focus.running;
          this.setCombatBanner(
            this.focus.running
              ? `⏳ Focus Round ${this.focus.round} started (${this.focus.durationMins}m)!`
              : '⏸ Focus Round paused.',
            'idle'
          );
          this.render();
          return;
        }
        if (str === '\\') {
          const minsList = [15, 25, 45];
          const next = minsList[(minsList.indexOf(this.focus.durationMins) + 1) % minsList.length];
          this.focus.durationMins = next;
          this.focus.running = false;
          this.focus.remainingSec = next * 60;
          this.setCombatBanner(`"Focus round length set to ${next} minutes."`, 'idle');
          this.render();
          return;
        }
        if (str === 'F') {
          this.finishFocusRound(false);
          return;
        }
      }

      // Classic Sub-Tabs & Popup Legends on War Table / Arena
      if (str === 'b') {
        if (layout === 'classic') {
          this.viewTab = 'board';
          this.selectedIndex = 0;
          this.render();
        }
      } else if (str === 'p') {
        if (layout === 'classic') {
          this.viewTab = 'pouch';
          this.selectedIndex = 0;
          this.render();
        }
      } else if (str === 'y') {
        if (layout === 'classic') {
          this.viewTab = 'rituals';
          this.selectedRitualIndex = 0;
          this.render();
        } else if (layout === 'wartable') {
          this.warCol = 0;
          this.warRow = 0;
          this.render();
        }
      } else if (str === 'a') {
        if (layout === 'classic') {
          this.viewTab = 'archive';
          this.selectedIndex = 0;
          this.render();
        } else {
          this.legendsIndex = 0;
          this.activeModal = 'legends';
          this.render();
        }
      } else if (key.name === 'tab') {
        const realms = this.getRealmsList();
        const curIdx = realms.indexOf(this.realmFilter);
        const step = key.shift ? -1 : 1;
        const nextIdx = (curIdx + step + realms.length) % realms.length;
        this.realmFilter = realms[nextIdx];
        this.selectedIndex = 0;
        this.selectedRitualIndex = 0;
        this.render();
      } else if (key.name === 'return') {
        if (layout === 'arena') this.handleCompleteItem();
        else this.enterArenaWithFocus();
      } else if (key.name === 'space') {
        this.handleDirectStrikeOrPick();
      } else if (str >= '1' && str <= '9') {
        this.handleStrikeSubStep(parseInt(str, 10) - 1);
      } else if (str === 'c') {
        this.handleCompleteItem();
      } else if (str === 'u') {
        const focused = this.getFocusedItem();
        if (focused?.kind === 'ritual') {
          resetRitualProgress(focused.item);
          this.save();
          this.setCombatBanner(`"Reset today's progress for '${focused.item.title}'."`, 'idle');
          this.render();
        } else if (focused?.kind === 'quest' && focused.item.status === 'done') {
          focused.item.status = 'open';
          focused.item.directDamage = 0;
          if (Array.isArray(focused.item.steps)) focused.item.steps.forEach((s) => (s.done = false));
          this.save();
          this.setCombatBanner(`"Re-opened '${focused.item.title}' on the board!"`, 'idle');
          this.render();
        }
      } else if (str === 'd') {
        await this.rollForFateAnimation();
      } else if (str === 'n') {
        await this.createItemWizard(false);
      } else if (str === 'P') {
        this.activeModal = 'ritual_presets';
        this.render();
      } else if (str === 's') {
        await this.addSubStepWizard();
      } else if (str === 'm') {
        await this.addNoteWizard();
      } else if (str === 'e') {
        await this.editFocusedWizard();
      } else if (str === 'r') {
        const focused = this.getFocusedItem();
        if (focused) {
          const idx = RANK_KEYS.indexOf(focused.item.rank || 'B');
          focused.item.rank = RANK_KEYS[(idx + 1) % RANK_KEYS.length];
          this.save();
          this.setCombatBanner(`"Priority rank set to [${focused.item.rank}-Rank]."`, 'idle');
          this.render();
        }
      } else if (str === 'R') {
        const focused = this.getFocusedItem();
        if (focused?.kind === 'quest') {
          const next = cycleQuestRecurrence(focused.item);
          this.save();
          this.setCombatBanner(
            next
              ? `"Quest set to repeat: ${CADENCES[next]?.label || next}!"`
              : `"Quest set to one-time (repeat cleared)."`,
            'idle'
          );
          this.render();
        }
      } else if (str === 'o') {
        const modes = ['rank', 'hp', 'newest'];
        this.sortMode = modes[(modes.indexOf(this.sortMode) + 1) % modes.length];
        this.setCombatBanner(`"Sorted by: ${this.sortMode.toUpperCase()}."`, 'idle');
        this.render();
      } else if (str === 'x') {
        const focused = this.getFocusedItem();
        if (focused?.kind === 'ritual') {
          this.state.rituals = this.state.rituals.filter((r) => r.id !== focused.item.id);
          this.save();
          this.setCombatBanner(`"Removed repeating ritual '${focused.item.title}'."`, 'idle');
          this.render();
        } else if (focused?.kind === 'quest') {
          this.state.quests = this.state.quests.filter((q) => q.id !== focused.item.id);
          this.save();
          this.setCombatBanner(`"Removed '${focused.item.title}' from the board."`, 'idle');
          this.render();
        }
      } else if (str === 'g') {
        this.guildSpeech = generateGuildmasterSpeech(this.state);
        this.render();
      } else if (str === 'i') {
        this.activeModal = 'relics';
        this.render();
      } else if (str === 't') {
        this.activeModal = 'biomes';
        this.render();
      } else if (str === 'v') {
        this.activeModal = 'leave';
        this.render();
      } else if (str === '?') {
        const curLayout = this.state.hero.layout || 'classic';
        this.helpTab = curLayout === 'wartable' ? 1 : curLayout === 'arena' ? 2 : 0;
        this.helpScroll = 0;
        this.activeModal = 'help';
        this.render();
      } else if (str === 'K') {
        await this.changePassphraseWizard();
      }
    });

    this.render();
  }

  async handleModalKeypress(str, key) {
    if (key.name === 'escape' || key.name === 'return' || str === 'q') {
      this.activeModal = null;
      this.render();
      return;
    }

    if (this.activeModal === 'help') {
      if (str === '?') {
        this.activeModal = null;
        this.render();
        return;
      }
      if (str >= '1' && str <= '4') {
        this.helpTab = parseInt(str, 10) - 1;
        this.helpScroll = 0;
        this.render();
        return;
      }
      if (key.name === 'f1' || key.name === 'f2' || key.name === 'f3') {
        this.helpTab = key.name === 'f1' ? 0 : key.name === 'f2' ? 1 : 2;
        this.helpScroll = 0;
        this.render();
        return;
      }
      if (key.name === 'left' || str === 'h' || (key.name === 'tab' && key.shift)) {
        this.helpTab = (this.helpTab + 3) % 4;
        this.helpScroll = 0;
        this.render();
        return;
      }
      if (key.name === 'right' || str === 'l' || key.name === 'tab') {
        this.helpTab = (this.helpTab + 1) % 4;
        this.helpScroll = 0;
        this.render();
        return;
      }
      if (key.name === 'up' || str === 'k') {
        this.helpScroll = Math.max(0, (this.helpScroll || 0) - 1);
        this.render();
        return;
      }
      if (key.name === 'down' || str === 'j') {
        this.helpScroll = (this.helpScroll || 0) + 1;
        this.render();
        return;
      }
      return;
    }

    if (this.activeModal === 'relics' && str === 'i') {
      this.activeModal = null;
      this.render();
      return;
    }

    if (this.activeModal === 'legends') {
      if (str === 'a') {
        this.activeModal = null;
        this.render();
        return;
      }
      const doneQuests = (this.state.quests || [])
        .filter((q) => q.status === 'done')
        .sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0));
      if (key.name === 'up' || str === 'k') {
        this.legendsIndex = Math.max(0, (this.legendsIndex || 0) - 1);
        this.render();
        return;
      }
      if (key.name === 'down' || str === 'j') {
        this.legendsIndex = Math.min(Math.max(0, doneQuests.length - 1), (this.legendsIndex || 0) + 1);
        this.render();
        return;
      }
      const target = doneQuests[Math.min(this.legendsIndex || 0, Math.max(0, doneQuests.length - 1))];
      if (str === 'u' && target) {
        target.status = 'open';
        target.directDamage = 0;
        if (Array.isArray(target.steps)) target.steps.forEach((s) => (s.done = false));
        this.save();
        this.setCombatBanner(`"Re-opened '${target.title}' on the board!"`, 'idle');
        this.render();
        return;
      }
      if (str === 'x' && target) {
        this.state.quests = this.state.quests.filter((q) => q.id !== target.id);
        this.save();
        this.setCombatBanner(`"Removed '${target.title}' from Legends."`, 'idle');
        this.render();
        return;
      }
      return;
    }

    if (this.activeModal === 'biomes') {
      if (str === 'A') {
        this.state.hero.settings.animations = this.state.hero.settings.animations === false;
        this.save();
        this.render();
        return;
      }
      if (str === 'L') {
        this.state.hero.settings.lighting = this.state.hero.settings.lighting === false;
        this.save();
        this.render();
        return;
      }
      if (str >= '1' && str <= String(BIOME_LIST.length)) {
        const picked = BIOME_LIST[parseInt(str, 10) - 1];
        const hero = this.state.hero;
        if (!hero.unlockedBiomes) hero.unlockedBiomes = ['tavern', 'crt'];
        if (isBiomeUnlocked(hero, picked)) {
          hero.activeBiome = picked.id;
          this.save();
          this.setCombatBanner(`"Switched Biome to ${picked.name}!"`, 'hype');
          this.activeModal = null;
        } else if (hero.gold >= picked.cost) {
          hero.gold -= picked.cost;
          hero.unlockedBiomes.push(picked.id);
          hero.activeBiome = picked.id;
          this.save();
          this.setCombatBanner(`"Unlocked & equipped '${picked.name}' for ${picked.cost}g!"`, 'hype');
          this.activeModal = null;
        } else {
          this.setCombatBanner(`"Need ${picked.cost}g or deed (${picked.deedDesc}) for ${picked.name}!"`, 'tease');
          this.activeModal = null;
        }
        this.render();
      }
      return;
    }

    if (this.activeModal === 'ritual_presets') {
      if (str === 'n') {
        this.activeModal = null;
        await this.createItemWizard(true);
        return;
      }
      if (str >= '1' && str <= String(RITUAL_PRESETS.length)) {
        const p = RITUAL_PRESETS[parseInt(str, 10) - 1];
        const exists = (this.state.rituals || []).some(
          (r) => r.title.toLowerCase() === p.title.toLowerCase()
        );
        if (!exists) {
          if (p.realm && !this.state.realms.includes(p.realm)) this.state.realms.push(p.realm);
          this.state.rituals.unshift({
            id: 'rit-' + crypto.randomBytes(4).toString('hex'),
            title: p.title,
            cadence: p.cadence,
            targetCount: p.targetCount,
            progressCount: 0,
            completedToday: false,
            lastCompletedDate: null,
            rank: p.rank,
            realm: p.realm,
            streak: 0,
            bestStreak: 0,
            totalCompletions: 0,
            createdAt: new Date().toISOString(),
            notes: p.note ? [p.note] : [],
          });
          this.save();
          this.setCombatBanner(`"Added Daily Ritual '${p.title}'!"`, 'hype');
        } else {
          this.setCombatBanner(`"'${p.title}' is already on your Daily Rituals list."`, 'idle');
        }
        this.activeModal = null;
        this.viewTab = 'rituals';
        this.render();
      }
      return;
    }

    if (this.activeModal === 'leave') {
      const presets = { '1': 1, '2': 3, '3': 7, '4': 14 };
      if (str === '0') {
        scheduleTavernLeave(this.state, 0);
        this.save();
        this.activeModal = null;
        this.setCombatBanner('"Welcome back from Tavern Leave! Ready for action!"', 'hype');
        this.render();
      } else if (presets[str]) {
        const days = presets[str];
        const until = scheduleTavernLeave(this.state, days);
        this.save();
        this.activeModal = null;
        this.setCombatBanner(`✦ Leave signed! Streak & ritual chains protected until ${until}.`, 'leave');
        this.render();
      } else if (str === '5') {
        this.activeModal = null;
        await this.withPromptMode(async () => {
          const biome = getBiome(this.state);
          const p = biome.palette;
          this.printWizardHeader('CUSTOM TAVERN LEAVE DURATION', 'Streak & Habit Chain Protection');
          const daysStr = await promptLine('  How many days will you be away? (1-90)', '5', p);
          const days = Math.max(1, Math.min(90, parseInt(daysStr, 10) || 5));
          const until = scheduleTavernLeave(this.state, days);
          this.setCombatBanner(`✦ Leave signed! Streak protected for ${days} days until ${until}.`, 'leave');
        });
      }
    }
  }
}

// ============================================================================
// CLI PARSER & COMMAND HANDLERS
// ============================================================================

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    command: null,
    subcommand: null,
    positional: [],
    vault: DEFAULT_VAULT_PATH,
    pass: process.env.QUEST_PASSPHRASE || null,
    rank: 'B',
    realm: 'Main Campaign',
    note: null,
    steps: null,
    repeat: null,
    count: 1,
    cadence: 'daily',
    active: false,
    noAnim: false,
    noLighting: false,
    layout: null,
    biome: null,
    view: 'board',
    cols: 110,
    rows: 32,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--vault' && args[i + 1]) opts.vault = path.resolve(args[++i]);
    else if (a === '--pass' && args[i + 1]) opts.pass = args[++i];
    else if (a === '--rank' && args[i + 1]) opts.rank = args[++i].toUpperCase();
    else if (a === '--realm' && args[i + 1]) opts.realm = args[++i];
    else if (a === '--note' && args[i + 1]) opts.note = args[++i];
    else if (a === '--steps' && args[i + 1]) opts.steps = args[++i];
    else if (a === '--repeat' && args[i + 1]) opts.repeat = args[++i].toLowerCase();
    else if (a === '--count' && args[i + 1]) opts.count = Math.max(1, parseInt(args[++i], 10) || 1);
    else if (a === '--cadence' && args[i + 1]) opts.cadence = args[++i].toLowerCase();
    else if (a === '--layout' && args[i + 1]) opts.layout = args[++i].toLowerCase();
    else if (a === '--biome' && args[i + 1]) opts.biome = args[++i].toLowerCase();
    else if (a === '--view' && args[i + 1]) opts.view = args[++i].toLowerCase();
    else if (a === '--cols' && args[i + 1]) opts.cols = Math.max(80, parseInt(args[++i], 10) || 110);
    else if (a === '--rows' && args[i + 1]) opts.rows = Math.max(24, parseInt(args[++i], 10) || 32);
    else if (a === '--active' || a === '-a') opts.active = true;
    else if (a === '--no-anim') opts.noAnim = true;
    else if (a === '--no-lighting') opts.noLighting = true;
    else if (a === '--list' || a === 'list' || a === 'status') {
      if (!opts.command) opts.command = 'list';
      else if (opts.command === 'ritual' && !opts.subcommand) opts.subcommand = 'list';
    } else if (!opts.command && ['add', 'done', 'fate', 'leave', 'ritual', 'render-preview'].includes(a)) {
      opts.command = a;
    } else if (opts.command === 'ritual' && !opts.subcommand && ['list', 'add', 'hit'].includes(a)) {
      opts.subcommand = a;
    } else {
      opts.positional.push(a);
    }
  }

  return opts;
}

function printCliHelp() {
  console.log(`
${paint('⚔  AETHORIA GUILDHALL v2 — ENCRYPTED TERMINAL QUEST BOARD  ⚔', { fg: '#ffd166', bold: true })}

${paint('Interactive Full-Screen TUI (Layouts: [F1] Board · [F2] War Table · [F3] Battle Arena):', { fg: '#f09d38' })}
  node quest-board.js [--no-anim] [--no-lighting]

${paint('Quick Quest CLI Commands:', { fg: '#f09d38' })}
  node quest-board.js list                 Show Hero, Daily Rituals, Active Pouch & Board
  node quest-board.js add "<Title>"        Post a quest (supports --rank, --realm, --steps, --note, --repeat, --active)
  node quest-board.js done "<Search>"      Slay/complete a quest matching ID or title
  node quest-board.js fate                 Roll the d20 of Fate for a 1.5x–2.0x Bounty
  node quest-board.js leave <days>         Schedule Tavern Leave for <days> days (0 to resume)

${paint('Repeating Daily Rituals CLI Commands:', { fg: '#90be6d' })}
  node quest-board.js ritual list          List all Daily Rituals, charges & mastery chains
  node quest-board.js ritual add "<Title>" [--count N] [--cadence daily|weekdays|weekends|weekly|every3d] [--rank C] [--realm Homestead] [--note "..."]
  node quest-board.js ritual hit "<Search>" Log +1 charge or complete a Daily Ritual

${paint('Vault & Preview Options:', { fg: '#f09d38' })}
  --vault <path>                           Custom AES-256-GCM encrypted vault path
  --pass <passphrase>                      Vault passphrase (or prompted securely)
  node quest-board.js render-preview [--layout classic|wartable|arena] [--biome tavern|neon|cottage|pirate|crt] [--view board|pouch|rituals]
`);
}

function printCliBoardSummary(state) {
  const hero = state.hero;
  const biome = getBiome(state);
  const v = biome.vocab;
  const xpReq = xpRequiredForLevel(hero.level);
  const comm = getCommissionStatus(state);

  console.log(paint('\n╔══════════════════════════════════════════════════════════════════════════╗', { fg: biome.palette.borderBright, bold: true }));
  console.log(`║ ⚔ ${hero.name} [Lv.${hero.level} ${getHeroTitle(hero.level)}] │ XP: ${hero.xp}/${xpReq} │ ${hero.gold}${v.currencyShort} │ ♦ Streak: ${hero.streak}d │ ◷ ${formatDisplayDate(new Date(), false)} │ Biome: ${biome.name}`);
  if (isOnTavernLeave(hero)) {
    console.log(`║ ${paint(`ON TAVERN LEAVE UNTIL ${hero.leaveUntil} (Streak Protected)`, { fg: '#80ed99' })}`);
  }
  console.log(paint('╚══════════════════════════════════════════════════════════════════════════╝', { fg: biome.palette.borderBright, bold: true }));

  console.log(paint(`\n⟳ ${v.rituals.toUpperCase()} (${comm.completedCount}/${comm.target} Commission Chest):`, { fg: biome.palette.ritual, bold: true }));
  for (const r of state.rituals || []) {
    const cad = CADENCES[r.cadence]?.short || 'DAILY';
    const icon = r.completedToday ? '✔' : isRitualDueToday(r) ? '⟳' : '·';
    console.log(`  ${icon} ${renderChargeBar(r.progressCount, r.targetCount)}  ${r.title} [${cad}] (${r.streak || 0}d chain)`);
  }

  const open = state.quests.filter((q) => q.status === 'open');
  const pouch = open.filter((q) => q.inPouch);
  const board = open.filter((q) => !q.inPouch);

  console.log(paint(`\n★ ${v.pouch.toUpperCase()} (${pouch.length}):`, { fg: '#ffd166', bold: true }));
  for (const q of pouch) {
    const hp = computeQuestHp(q);
    console.log(`  ★ [${q.rank}] ${q.title} [${q.realm}] (${hp.pct}% HP)${q.recurrence ? ` [⟳${q.recurrence}]` : ''}`);
  }

  console.log(paint(`\n§ ${v.quests.toUpperCase()} BOARD (${board.length}):`, { fg: '#f09d38', bold: true }));
  for (const q of board) {
    const hp = computeQuestHp(q);
    console.log(`  · [${q.rank}] ${q.title} [${q.realm}] (${hp.pct}% HP)${q.recurrence ? ` [⟳${q.recurrence}]` : ''}`);
  }
  console.log('');
}

async function main() {
  const opts = parseCliArgs(process.argv);
  if (opts.help) {
    printCliHelp();
    return;
  }

  const { state, password } = await unlockOrInitializeVault(opts.vault, opts.pass);
  if (opts.noAnim) state.hero.settings.animations = false;
  if (opts.noLighting) state.hero.settings.lighting = false;
  if (opts.layout && ['classic', 'wartable', 'arena'].includes(opts.layout)) {
    state.hero.layout = opts.layout;
  }
  if (opts.biome && BIOMES[opts.biome]) {
    state.hero.activeBiome = opts.biome;
  }

  if (opts.command === 'list') {
    printCliBoardSummary(state);
    return;
  }

  if (opts.command === 'ritual') {
    const sub = opts.subcommand || 'list';
    if (sub === 'list') {
      const comm = getCommissionStatus(state);
      console.log(paint(`\n⟳ DAILY RITUALS (Commission Chest: ${comm.completedCount}/${comm.target}${comm.claimed ? ' OPEN' : ''}):`, { fg: '#90be6d', bold: true }));
      for (const r of state.rituals || []) {
        const cad = CADENCES[r.cadence]?.short || 'DAILY';
        const icon = r.completedToday ? '✔' : isRitualDueToday(r) ? '⟳' : '·';
        console.log(`  ${icon} ${renderChargeBar(r.progressCount, r.targetCount)}  ${r.title} [${cad}] [${r.realm}] (${r.streak || 0}d chain)`);
      }
      console.log('');
      return;
    }

    if (sub === 'add') {
      const title = opts.positional.join(' ').trim();
      if (!title) {
        console.error(paint('Error: Please provide a ritual title.', { fg: '#ff3b5c' }));
        process.exit(1);
      }
      const cadence = CADENCE_KEYS.includes(opts.cadence) ? opts.cadence : 'daily';
      const rank = RANK_KEYS.includes(opts.rank) ? opts.rank : 'C';
      const realm = opts.realm || 'Homestead';
      if (!state.realms.includes(realm)) state.realms.push(realm);
      state.rituals.unshift({
        id: 'rit-' + crypto.randomBytes(4).toString('hex'),
        title,
        cadence,
        targetCount: opts.count,
        progressCount: 0,
        completedToday: false,
        lastCompletedDate: null,
        rank,
        realm,
        streak: 0,
        bestStreak: 0,
        totalCompletions: 0,
        createdAt: new Date().toISOString(),
        notes: opts.note ? [opts.note] : [],
      });
      saveVaultToFile(opts.vault, state, password);
      console.log(paint(`✔ Added Daily Ritual: "${title}" [${CADENCES[cadence].label}, ${opts.count}x] in [${realm}]`, { fg: '#80ed99' }));
      return;
    }

    if (sub === 'hit') {
      const query = opts.positional.join(' ').toLowerCase();
      const target = (state.rituals || []).find(
        (r) => r.id.toLowerCase() === query || r.title.toLowerCase().includes(query)
      );
      if (!target) {
        console.error(paint(`No Daily Ritual matching "${query}" found.`, { fg: '#ff3b5c' }));
        process.exit(1);
      }
      const res = strikeRitual(state, target);
      saveVaultToFile(opts.vault, state, password);
      if (res.alreadyDone) {
        console.log(`✔ "${target.title}" is already completed today (${target.streak}d chain).`);
      } else if (!res.completed) {
        console.log(paint(`⟳ "${target.title}" charged: ${renderChargeBar(res.progressCount, res.targetCount)} (+${res.finalXp} XP, +${res.finalGold}g)`, { fg: '#90be6d' }));
      } else {
        console.log(paint(`✔ DAILY RITUAL COMPLETED: "${target.title}" (${target.streak}d chain) -> +${res.finalXp} XP, +${res.finalGold}g!`, { fg: '#80ed99', bold: true }));
        if (res.chestOpened) console.log(paint('★ DAILY COMMISSION CHEST OPENED (+60 XP, +30 Gold)!', { fg: '#ffd166', bold: true }));
        if (res.chestDrop) console.log(paint(`✦ Relic Unearthed: ${res.chestDrop.name}`, { fg: '#ffd166' }));
      }
      return;
    }
  }

  if (opts.command === 'add') {
    const title = opts.positional.join(' ').trim();
    if (!title) {
      console.error(paint('Error: Please provide a quest title.', { fg: '#ff3b5c' }));
      process.exit(1);
    }
    const rank = RANK_KEYS.includes(opts.rank) ? opts.rank : 'B';
    if (opts.realm && !state.realms.includes(opts.realm)) state.realms.push(opts.realm);
    const steps = opts.steps
      ? opts.steps.split(',').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false }))
      : [];
    const recurrence = CADENCE_KEYS.includes(opts.repeat) ? opts.repeat : null;
    state.quests.unshift({
      id: 'q-' + crypto.randomBytes(4).toString('hex'),
      title,
      rank,
      realm: opts.realm || 'Main Campaign',
      inPouch: Boolean(opts.active),
      status: 'open',
      recurrence,
      bountyMultiplier: 1,
      bountyLabel: null,
      createdAt: new Date().toISOString(),
      notes: opts.note ? [opts.note] : [],
      steps,
      combatLog: [],
    });
    saveVaultToFile(opts.vault, state, password);
    console.log(paint(`✔ Posted [${rank}-Rank] "${title}" in [${opts.realm}]${recurrence ? ` [⟳${recurrence}]` : ''}`, { fg: '#80ed99' }));
    return;
  }

  if (opts.command === 'done') {
    const query = opts.positional.join(' ').toLowerCase();
    const target = state.quests.find(
      (q) => q.status === 'open' && (q.id.toLowerCase() === query || q.title.toLowerCase().includes(query))
    );
    if (!target) {
      console.error(paint(`No open quest matching "${query}" found.`, { fg: '#ff3b5c' }));
      process.exit(1);
    }
    const res = completeQuest(state, target);
    saveVaultToFile(opts.vault, state, password);
    console.log(paint(`★ QUEST SLAIN: "${target.title}" -> +${res.finalXp} XP, +${res.finalGold}g!`, { fg: '#80ed99', bold: true }));
    if (res.droppedRelic) {
      console.log(paint(`✦ Unearthed Relic: ${res.droppedRelic.name} (${res.droppedRelic.bonusText})`, { fg: '#ffd166' }));
    }
    return;
  }

  if (opts.command === 'fate') {
    const open = state.quests.filter((q) => q.status === 'open');
    if (open.length === 0) {
      console.log('No open quests to roll for!');
      return;
    }
    const roll = Math.floor(Math.random() * 20) + 1;
    const picked = open[Math.floor(Math.random() * open.length)];
    picked.inPouch = true;
    picked.bountyMultiplier = roll === 20 ? 2.0 : 1.5;
    picked.bountyLabel = roll === 20 ? 'NAT 20 MYTHIC BOUNTY (2.0x)' : `d20=${roll} FATE BOUNTY (1.5x)`;
    state.hero.fateRolls = (state.hero.fateRolls || 0) + 1;
    saveVaultToFile(opts.vault, state, password);
    console.log(paint(`♦ Rolled d20 = [${roll}]! Fate selected: "${picked.title}" (${picked.bountyLabel})`, { fg: '#f15bb5', bold: true }));
    return;
  }

  if (opts.command === 'leave') {
    const days = parseInt(opts.positional[0] || '3', 10);
    const until = scheduleTavernLeave(state, days);
    saveVaultToFile(opts.vault, state, password);
    console.log(
      until
        ? paint(`✦ Tavern Leave active for ${days} day(s) until ${until}. Streak protected!`, { fg: '#4cc9f0' })
        : paint('⚔ Resumed active adventuring duty!', { fg: '#80ed99' })
    );
    return;
  }

  if (opts.command === 'render-preview') {
    const tui = new QuestBoardTUI(opts.vault, state, password, opts);
    const scr = tui.renderToScreen(opts.cols, opts.rows);
    console.log(scr.toPlain());
    return;
  }

  const tui = new QuestBoardTUI(opts.vault, state, password, opts);
  tui.start();
}

export { QuestBoardTUI };

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(__filename).toLowerCase();

if (isDirectRun) {
  main().catch((err) => {
    process.stdout.write(SEQ.showCursor + SEQ.altOff);
    console.error(paint('Fatal Error:', { fg: '#ff3b5c', bold: true }), err.message);
    process.exit(1);
  });
}
