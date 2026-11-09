#!/usr/bin/env node
/**
 * ============================================================================
 *  ⚔️  AETHoria GUILDHALL — ENCRYPTED TERMINAL QUEST BOARD  ⚔️
 * ============================================================================
 *  A zero-dependency, AES-256-GCM encrypted RPG Quest Board for the terminal.
 *
 *  Features:
 *   • Password-Protected Encrypted Vault (scrypt KDF + AES-256-GCM)
 *   • Guild Notice Board + "Active Quest Pouch" (Today's Picked Loadout)
 *   • Priority Ranks (S / A / B / C / D) with scaled XP, Gold & Loot odds
 *   • Realm / Guild Grouping + Instant Filtering & Sorting
 *   • Boss HP Bars & Sub-Quest Objectives with Critical Hit Damage Animations
 *   • Rich Quest Scroll Notes & Lore Entries
 *   • "Roll for Fate" (Interactive d20 Roller that assigns a 1.5x–2.0x Bounty)
 *   • Interactive NPC Guildmaster Garrick with dynamic ASCII expressions
 *   • Planned "Tavern Leave" (Vacation / Rest Mode) to pause streaks ahead of time
 *   • Hero Progression, Reliquary Loot Drops & Unlockable Visual Themes
 *   • Full-Screen Interactive TUI + Quick CLI One-Liner Commands
 * ============================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_VAULT_PATH = path.join(__dirname, '.quest-vault.enc.json');

// ============================================================================
// 1. ANSI & VISUAL THEME ENGINE
// ============================================================================

const ESC = '\x1b[';
const ANSI = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,
  inverse: `${ESC}7m`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
  altScreenOn: `${ESC}?1049h`,
  altScreenOff: `${ESC}?1049l`,
  home: `${ESC}H`,
  clearScreen: `${ESC}2J${ESC}H`,
  clearLine: `${ESC}2K`,
};

function fg256(code) {
  return `${ESC}38;5;${code}m`;
}
function bg256(code) {
  return `${ESC}48;5;${code}m`;
}

const THEMES = {
  parchment: {
    id: 'parchment',
    name: 'Tavern Parchment & Gold',
    cost: 0,
    desc: 'Warm hearth-fire amber, aged gold & guild crimson.',
    border: fg256(179),      // warm gold-bronze
    borderBright: fg256(220),// bright gold
    headerBg: bg256(52),     // deep tavern burgundy
    headerFg: fg256(222),    // light gold
    accent: fg256(214),      // amber orange
    accent2: fg256(178),     // brass
    text: fg256(253),        // parchment white
    muted: fg256(245),       // stone gray
    highlightBg: bg256(236), // active row bg
    pouchAccent: fg256(220), // gold
    hpFull: fg256(196),      // boss crimson
    hpMid: fg256(208),       // boss orange
    hpLow: fg256(46),        // slain green
    xpBar: fg256(45),        // mana cyan
  },
  arcane: {
    id: 'arcane',
    name: 'Arcane Midnight',
    cost: 0,
    desc: 'Astral violet, neon magenta & starlight cyan.',
    border: fg256(135),
    borderBright: fg256(207),
    headerBg: bg256(54),
    headerFg: fg256(225),
    accent: fg256(81),
    accent2: fg256(177),
    text: fg256(254),
    muted: fg256(244),
    highlightBg: bg256(236),
    pouchAccent: fg256(87),
    hpFull: fg256(201),
    hpMid: fg256(141),
    hpLow: fg256(50),
    xpBar: fg256(213),
  },
  emerald: {
    id: 'emerald',
    name: 'Elven Emerald',
    cost: 0,
    desc: 'Ancient sylvan jade, silver leaf & sunlit moss.',
    border: fg256(71),
    borderBright: fg256(120),
    headerBg: bg256(22),
    headerFg: fg256(193),
    accent: fg256(114),
    accent2: fg256(222),
    text: fg256(253),
    muted: fg256(244),
    highlightBg: bg256(236),
    pouchAccent: fg256(156),
    hpFull: fg256(196),
    hpMid: fg256(214),
    hpLow: fg256(83),
    xpBar: fg256(121),
  },
  dragonfire: {
    id: 'dragonfire',
    name: 'Dragonfire Crimson',
    cost: 75,
    desc: 'Molten ruby scales, obsidian ash & searing ember.',
    border: fg256(160),
    borderBright: fg256(208),
    headerBg: bg256(52),
    headerFg: fg256(214),
    accent: fg256(196),
    accent2: fg256(220),
    text: fg256(254),
    muted: fg256(243),
    highlightBg: bg256(235),
    pouchAccent: fg256(208),
    hpFull: fg256(196),
    hpMid: fg256(214),
    hpLow: fg256(226),
    xpBar: fg256(202),
  },
  frostwarden: {
    id: 'frostwarden',
    name: 'Frostwarden Citadel',
    cost: 100,
    desc: 'Glacial sapphire, winter silver & aurora ice.',
    border: fg256(75),
    borderBright: fg256(159),
    headerBg: bg256(17),
    headerFg: fg256(195),
    accent: fg256(117),
    accent2: fg256(87),
    text: fg256(255),
    muted: fg256(245),
    highlightBg: bg256(236),
    pouchAccent: fg256(123),
    hpFull: fg256(197),
    hpMid: fg256(111),
    hpLow: fg256(87),
    xpBar: fg256(51),
  },
  runeforge: {
    id: 'runeforge',
    name: 'Dwarven Runeforge',
    cost: 125,
    desc: 'Hammered bronze, anvil slate & glowing runic teal.',
    border: fg256(136),
    borderBright: fg256(44),
    headerBg: bg256(235),
    headerFg: fg256(215),
    accent: fg256(44),
    accent2: fg256(172),
    text: fg256(252),
    muted: fg256(244),
    highlightBg: bg256(237),
    pouchAccent: fg256(45),
    hpFull: fg256(202),
    hpMid: fg256(178),
    hpLow: fg256(44),
    xpBar: fg256(37),
  },
};

const RANKS = {
  S: {
    rank: 'S',
    label: 'S-RANK',
    title: 'Mythic Calamity',
    xp: 150,
    gold: 50,
    lootChance: 0.65,
    order: 0,
    color: fg256(196),
    badge: `${bg256(196)}${fg256(255)}${ANSI.bold} S ${ANSI.reset}`,
  },
  A: {
    rank: 'A',
    label: 'A-RANK',
    title: 'Heroic Urgent',
    xp: 100,
    gold: 30,
    lootChance: 0.45,
    order: 1,
    color: fg256(208),
    badge: `${bg256(208)}${fg256(16)}${ANSI.bold} A ${ANSI.reset}`,
  },
  B: {
    rank: 'B',
    label: 'B-RANK',
    title: 'Veteran Contract',
    xp: 60,
    gold: 20,
    lootChance: 0.30,
    order: 2,
    color: fg256(220),
    badge: `${bg256(220)}${fg256(16)}${ANSI.bold} B ${ANSI.reset}`,
  },
  C: {
    rank: 'C',
    label: 'C-RANK',
    title: 'Standard Posting',
    xp: 35,
    gold: 12,
    lootChance: 0.20,
    order: 3,
    color: fg256(81),
    badge: `${bg256(81)}${fg256(16)}${ANSI.bold} C ${ANSI.reset}`,
  },
  D: {
    rank: 'D',
    label: 'D-RANK',
    title: 'Quick Errand',
    xp: 20,
    gold: 6,
    lootChance: 0.12,
    order: 4,
    color: fg256(114),
    badge: `${bg256(114)}${fg256(16)}${ANSI.bold} D ${ANSI.reset}`,
  },
};

const RANK_KEYS = ['S', 'A', 'B', 'C', 'D'];

const HERO_TITLES = [
  { level: 1, title: 'Novice Wayfarer' },
  { level: 2, title: 'Copper Sworn' },
  { level: 3, title: 'Iron Vanguard' },
  { level: 4, title: 'Silver Pathfinder' },
  { level: 5, title: 'Golden Paladin' },
  { level: 6, title: 'Mythril Warden' },
  { level: 7, title: 'Dragonbane Champion' },
  { level: 8, title: 'Arcane Sovereign' },
  { level: 9, title: 'Astral Archon' },
  { level: 10, title: 'Grandmaster of Aethoria' },
];

const RELIC_CATALOG = [
  {
    id: 'mug_of_roast',
    name: 'Bottomless Tankard of Dark Roast',
    rarity: 'Uncommon',
    art: '[c|_|]',
    lore: 'Brewed by Dwarven alchemists. Never cools, never empties.',
    bonusText: '+5% XP on all quests',
  },
  {
    id: 'featherquill_blade',
    name: 'Enchanted Featherquill Rapier',
    rarity: 'Rare',
    art: '=={==> ',
    lore: 'Slices through bureaucracy and overdue scrolls in a single stroke.',
    bonusText: '+5 Bonus XP per sub-step strike',
  },
  {
    id: 'weighted_d20',
    name: 'Starforged Ivory d20',
    rarity: 'Epic',
    art: '< 20 >',
    lore: 'Hums softly when indecisiveness enters the tavern.',
    bonusText: '+10% Gold on Fate Bounty quests',
  },
  {
    id: 'hourglass_focus',
    name: 'Chronosand Hourglass',
    rarity: 'Rare',
    art: ' (><) ',
    lore: 'Bends the afternoon hours so deadlines dare not approach.',
    bonusText: '+15 Bonus XP on S & A Rank quests',
  },
  {
    id: 'owl_monocle',
    name: "Garrick's Spare Brass Monocle",
    rarity: 'Rare',
    art: ' -(O)-',
    lore: 'Reveals hidden flaws in poorly written plans.',
    bonusText: '+5 Gold on every quest completion',
  },
  {
    id: 'dragonscale_seal',
    name: 'Crimson Dragonscale Crest',
    rarity: 'Mythic',
    art: ' /VV\\ ',
    lore: 'Warm to the touch. Proof that no Boss Task can intimidate you.',
    bonusText: '+10% XP & Gold across the realm',
  },
  {
    id: 'lantern_of_dawn',
    name: 'Everglow Wayfinder Lantern',
    rarity: 'Uncommon',
    art: ' [(*)]',
    lore: 'Guides adventurers safely through midnight coding and deep work.',
    bonusText: '+20 Bonus XP on Daily Full-Clear',
  },
  {
    id: 'coin_of_fortune',
    name: 'Twin-Headed Sovereign Coin',
    rarity: 'Epic',
    art: ' ($+$)',
    lore: 'Heads you win, tails the procrastination loses.',
    bonusText: '+10 Gold on Daily Full-Clear',
  },
];

// ============================================================================
// 2. ENCRYPTION ENGINE (scrypt + AES-256-GCM)
// ============================================================================

const VAULT_MAGIC = 'GUILD_QUEST_VAULT_V1';

function deriveKey(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

function encryptVaultData(stateObj, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(stateObj, null, 2);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    magic: VAULT_MAGIC,
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    updatedAt: new Date().toISOString(),
    ciphertext: encrypted.toString('base64'),
  };
}

function decryptVaultData(envelope, password) {
  if (!envelope || envelope.magic !== VAULT_MAGIC) {
    throw new Error('Invalid or corrupted Quest Vault file format.');
  }
  const key = deriveKey(password, envelope.salt);
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const encrypted = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function saveVaultToFile(vaultPath, stateObj, password) {
  const payload = encryptVaultData(stateObj, password);
  const tmpPath = `${vaultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, vaultPath);
}

function loadVaultFromFile(vaultPath, password) {
  const raw = fs.readFileSync(vaultPath, 'utf8');
  const envelope = JSON.parse(raw);
  return decryptVaultData(envelope, password);
}

// ============================================================================
// 3. DATE, STREAK & TAVERN LEAVE LOGIC
// ============================================================================

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateKey(dt);
}

function daysBetweenDateKeys(keyA, keyB) {
  const [y1, m1, d1] = keyA.split('-').map(Number);
  const [y2, m2, d2] = keyB.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function isOnTavernLeave(hero, dateKey = getLocalDateKey()) {
  if (!hero.leaveUntil) return false;
  return dateKey <= hero.leaveUntil;
}

/**
 * Reconciles daily streak & daily counters on startup or day rollover.
 * Respects any protected "Tavern Leave" dates so planned vacations never break streaks!
 */
function reconcileDailyState(state) {
  const today = getLocalDateKey();
  const hero = state.hero;

  if (!hero.protectedDates) hero.protectedDates = [];

  // Clear expired leave banner if today is past leaveUntil
  if (hero.leaveUntil && today > hero.leaveUntil) {
    hero.leaveUntil = null;
  }

  if (hero.lastDayChecked !== today) {
    // Reset today's daily counters if day changed
    if (hero.lastActiveDate && hero.lastActiveDate !== today) {
      const gap = daysBetweenDateKeys(hero.lastActiveDate, today);
      if (gap > 1) {
        // Check if every missed intermediate day was protected by Tavern Leave
        let missedUnprotected = false;
        for (let i = 1; i < gap; i++) {
          const checkDay = addDaysToDateKey(hero.lastActiveDate, i);
          const wasProtected =
            hero.protectedDates.includes(checkDay) ||
            (hero.leaveUntil && checkDay <= hero.leaveUntil);
          if (!wasProtected) {
            missedUnprotected = true;
            break;
          }
        }
        if (missedUnprotected) {
          hero.streak = 0;
        }
      }
    }
    if (hero.dailyLogDate !== today) {
      hero.dailyLogDate = today;
      hero.completedToday = 0;
      hero.pouchClearedToday = false;
    }
    hero.lastDayChecked = today;
  }
}

function scheduleTavernLeave(state, numDays, reason = 'Planned Expedition / Rest') {
  const today = getLocalDateKey();
  const hero = state.hero;
  if (!hero.protectedDates) hero.protectedDates = [];

  if (numDays <= 0) {
    hero.leaveUntil = null;
    hero.leaveReason = null;
    return null;
  }

  const untilKey = addDaysToDateKey(today, numDays);
  hero.leaveUntil = untilKey;
  hero.leaveReason = reason;

  for (let i = 0; i <= numDays; i++) {
    const dKey = addDaysToDateKey(today, i);
    if (!hero.protectedDates.includes(dKey)) {
      hero.protectedDates.push(dKey);
    }
  }
  // Keep protectedDates bounded
  if (hero.protectedDates.length > 180) {
    hero.protectedDates = hero.protectedDates.slice(-180);
  }
  return untilKey;
}

// ============================================================================
// 4. INITIAL DEFAULT STATE & STARTER QUESTS
// ============================================================================

function createInitialState(heroName = 'Wayfarer') {
  const now = new Date().toISOString();
  const today = getLocalDateKey();
  return {
    version: 1,
    hero: {
      name: heroName,
      level: 1,
      xp: 0,
      gold: 50,
      streak: 1,
      bestStreak: 1,
      lastActiveDate: today,
      lastDayChecked: today,
      dailyLogDate: today,
      completedToday: 0,
      pouchClearedToday: false,
      totalCompleted: 0,
      critsLanded: 0,
      leaveUntil: null,
      leaveReason: null,
      protectedDates: [],
      relics: ['mug_of_roast'],
      unlockedThemes: ['parchment', 'arcane', 'emerald'],
      activeTheme: 'parchment',
    },
    realms: [
      'Main Campaign',
      'Craft & Code',
      'Arcane Study',
      'Homestead',
      'Side Bounties',
    ],
    quests: [
      {
        id: 'q-starter-1',
        title: 'Inspect the Guild Notice Board & Embark on Today\'s Run',
        rank: 'B',
        realm: 'Main Campaign',
        inPouch: true,
        status: 'open',
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'Welcome to Aethoria Guildhall! Your quest scroll is encrypted with AES-256-GCM.',
          'Use [Up/Down] or [j/k] to navigate quests, and [Space] to move quests into or out of your Active Quest Pouch.',
          'Press [1]-[9] to strike the sub-steps below and watch the Boss HP bar drain!',
        ],
        steps: [
          { text: 'Strike this first sub-step by pressing [1]', done: false },
          { text: 'Try rolling the d20 of Fate with [d] for a 1.5x XP Bounty', done: false },
          { text: 'Press [c] to Slay & Complete this quest for XP and Gold!', done: false },
        ],
      },
      {
        id: 'q-starter-2',
        title: 'Conquer the High-Priority Boss Task of the Week',
        rank: 'S',
        realm: 'Craft & Code',
        inPouch: true,
        status: 'open',
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'S-Rank quests represent your highest-impact, most intimidating tasks.',
          'Break them into smaller sub-steps with [s] so every step deals visible Boss damage!',
        ],
        steps: [
          { text: 'Outline the core architecture or plan', done: true },
          { text: 'Execute the main implementation', done: false },
          { text: 'Verify and ship the final milestone', done: false },
        ],
      },
      {
        id: 'q-starter-3',
        title: 'Organize Workspace & Clear Arcane Clutter',
        rank: 'C',
        realm: 'Homestead',
        inPouch: false,
        status: 'open',
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'A tidy alchemical workbench keeps the mind sharp.',
          'Press [Space] when you are ready to pull this quest into today\'s Active Pouch.',
        ],
        steps: [
          { text: 'Clear desktop & close stale tabs', done: false },
          { text: 'Write down 2 new quests with [n]', done: false },
        ],
      },
    ],
  };
}

// ============================================================================
// 5. RPG PROGRESSION, DAMAGE & GUILDMASTER ENGINE
// ============================================================================

function xpRequiredForLevel(level) {
  return Math.floor(120 * Math.pow(level, 1.35));
}

function getHeroTitle(level) {
  let current = HERO_TITLES[0].title;
  for (const t of HERO_TITLES) {
    if (level >= t.level) current = t.title;
  }
  return current;
}

function computeQuestHp(quest) {
  if (quest.status === 'done') {
    const total = Math.max(1, (quest.steps || []).length) * 100;
    return { current: 0, max: total, pct: 0, doneCount: (quest.steps || []).length, totalCount: (quest.steps || []).length };
  }
  const steps = quest.steps || [];
  if (steps.length === 0) {
    const rankHp = { S: 500, A: 350, B: 200, C: 120, D: 60 }[quest.rank] || 150;
    return { current: rankHp, max: rankHp, pct: 100, doneCount: 0, totalCount: 0 };
  }
  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const max = totalCount * 100;
  const current = Math.max(0, (totalCount - doneCount) * 100);
  const pct = Math.round((current / max) * 100);
  return { current, max, pct, doneCount, totalCount };
}

function hasRelic(hero, relicId) {
  return Array.isArray(hero.relics) && hero.relics.includes(relicId);
}

function awardXpAndGold(state, rawXp, rawGold) {
  const hero = state.hero;
  let xpMult = 1.0;
  let goldMult = 1.0;

  if (hasRelic(hero, 'mug_of_roast')) xpMult += 0.05;
  if (hasRelic(hero, 'dragonscale_seal')) {
    xpMult += 0.10;
    goldMult += 0.10;
  }
  // Streak flame bonus (+2% per streak day up to +30%)
  const streakBonus = Math.min(0.30, (hero.streak || 0) * 0.02);
  xpMult += streakBonus;

  const finalXp = Math.max(1, Math.round(rawXp * xpMult));
  const finalGold = Math.max(0, Math.round(rawGold * goldMult));

  hero.xp += finalXp;
  hero.gold += finalGold;

  let leveledUp = false;
  while (hero.xp >= xpRequiredForLevel(hero.level)) {
    hero.xp -= xpRequiredForLevel(hero.level);
    hero.level += 1;
    leveledUp = true;
  }

  return { finalXp, finalGold, leveledUp, newLevel: hero.level };
}

function rollForLootDrop(state, quest, forceGuaranteed = false) {
  const hero = state.hero;
  const rankMeta = RANKS[quest.rank] || RANKS.C;
  const unowned = RELIC_CATALOG.filter((r) => !hero.relics.includes(r.id));
  if (unowned.length === 0) return null;

  const chance = forceGuaranteed
    ? 1.0
    : rankMeta.lootChance * (quest.bountyMultiplier > 1 ? 1.35 : 1.0);

  if (Math.random() <= chance) {
    const picked = unowned[Math.floor(Math.random() * unowned.length)];
    hero.relics.push(picked.id);
    return picked;
  }
  return null;
}

function completeQuest(state, quest) {
  if (quest.status === 'done') return null;

  quest.status = 'done';
  quest.completedAt = new Date().toISOString();
  if (Array.isArray(quest.steps)) {
    quest.steps.forEach((s) => {
      s.done = true;
    });
  }

  const hero = state.hero;
  const today = getLocalDateKey();

  // Advance streak if first completion today
  if (hero.lastActiveDate !== today) {
    const gap = hero.lastActiveDate ? daysBetweenDateKeys(hero.lastActiveDate, today) : 1;
    if (gap === 1) {
      hero.streak = (hero.streak || 0) + 1;
    } else if (gap > 1) {
      // Check if protected
      let protectedAll = true;
      for (let i = 1; i < gap; i++) {
        const dKey = addDaysToDateKey(hero.lastActiveDate, i);
        if (!hero.protectedDates?.includes(dKey) && !(hero.leaveUntil && dKey <= hero.leaveUntil)) {
          protectedAll = false;
          break;
        }
      }
      hero.streak = protectedAll ? (hero.streak || 0) + 1 : 1;
    } else {
      hero.streak = Math.max(1, hero.streak || 1);
    }
    hero.lastActiveDate = today;
  } else if (!hero.streak) {
    hero.streak = 1;
  }

  if (hero.streak > (hero.bestStreak || 0)) {
    hero.bestStreak = hero.streak;
  }

  hero.completedToday = (hero.completedToday || 0) + 1;
  hero.totalCompleted = (hero.totalCompleted || 0) + 1;

  const rankMeta = RANKS[quest.rank] || RANKS.C;
  const mult = quest.bountyMultiplier || 1;
  let baseXp = Math.round(rankMeta.xp * mult);
  let baseGold = Math.round(rankMeta.gold * mult);

  if ((quest.rank === 'S' || quest.rank === 'A') && hasRelic(hero, 'hourglass_focus')) {
    baseXp += 15;
  }
  if (hasRelic(hero, 'owl_monocle')) {
    baseGold += 5;
  }
  if (mult > 1 && hasRelic(hero, 'weighted_d20')) {
    baseGold = Math.round(baseGold * 1.10);
  }

  // Check if Active Pouch is now completely cleared!
  const remainingPouch = state.quests.filter((q) => q.status === 'open' && q.inPouch);
  let fullClearTriggered = false;
  if (quest.inPouch && remainingPouch.length === 0 && !hero.pouchClearedToday) {
    hero.pouchClearedToday = true;
    fullClearTriggered = true;
    baseXp += 75 + (hasRelic(hero, 'lantern_of_dawn') ? 20 : 0);
    baseGold += 25 + (hasRelic(hero, 'coin_of_fortune') ? 10 : 0);
  }

  quest.inPouch = false;

  const reward = awardXpAndGold(state, baseXp, baseGold);
  const droppedRelic = rollForLootDrop(state, quest, quest.bountyMultiplier >= 2);

  return {
    ...reward,
    fullClearTriggered,
    droppedRelic,
    rankMeta,
  };
}

const GUILDMASTER_MOODS = {
  idle: {
    face: ' (o_O)9 ',
    title: 'Guildmaster Garrick',
  },
  hype: {
    face: '\\(^o^)/ ',
    title: 'Guildmaster Garrick [HYPED]',
  },
  crit: {
    face: ' (>_<)+ ',
    title: 'Guildmaster Garrick [COMBAT]',
  },
  fate: {
    face: ' (*_*)♦ ',
    title: 'Guildmaster Garrick [FATE]',
  },
  leave: {
    face: ' (-_-)~ ',
    title: 'Guildmaster Garrick [HEARTH]',
  },
  tease: {
    face: ' (¬_¬)! ',
    title: 'Guildmaster Garrick [AHEM]',
  },
};

function generateGuildmasterSpeech(state) {
  const hero = state.hero;
  const openQuests = state.quests.filter((q) => q.status === 'open');
  const pouchQuests = openQuests.filter((q) => q.inPouch);
  const highRankDusty = openQuests.filter((q) => q.rank === 'S' || q.rank === 'A');

  if (isOnTavernLeave(hero)) {
    return {
      mood: 'leave',
      line: `"Enjoy your Tavern Leave until ${hero.leaveUntil}, ${hero.name}! Your ${hero.streak}-day streak is under my personal guard."`,
    };
  }

  if (hero.pouchClearedToday) {
    return {
      mood: 'hype',
      line: `"BY THE ANCIENTS! You cleared your Active Quest Pouch today! Rest by the fire or pull a bonus bounty if you dare!"`,
    };
  }

  if (pouchQuests.length === 0 && openQuests.length > 0) {
    return {
      mood: 'tease',
      line: `"Your Active Quest Pouch is empty! Pick 3–4 quests with [Space] for today's run, or press [d] to let the d20 of Fate choose!"`,
    };
  }

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12
      ? 'Morning tankard is poured!'
      : hour < 18
      ? 'The afternoon forge is hot!'
      : 'Burning the midnight lantern oil, eh?';

  if (highRankDusty.length > 0 && Math.random() < 0.45) {
    const target = highRankDusty[0];
    return {
      mood: 'tease',
      line: `"${timeGreeting} That [${target.rank}-Rank] '${target.title.slice(0, 32)}' won't slay itself—strike a sub-step to chip its HP!"`,
    };
  }

  return {
    mood: 'idle',
    line: `"${timeGreeting} You have ${pouchQuests.length} quest(s) in your Active Pouch and a ${hero.streak}-day streak burning bright."`,
  };
}

// ============================================================================
// 6. TERMINAL STRING & BOX HELPERS (100% DETERMINISTIC COLUMN ALIGNMENT)
// ============================================================================

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(str) {
  return String(str || '').replace(ANSI_REGEX, '');
}

function visibleLength(str) {
  return stripAnsi(str).length;
}

function padEndVisible(str, width, fillChar = ' ') {
  const len = visibleLength(str);
  if (len >= width) return truncateVisible(str, width);
  return str + fillChar.repeat(width - len);
}

function truncateVisible(str, maxWidth) {
  if (maxWidth <= 0) return '';
  const plain = stripAnsi(str);
  if (plain.length <= maxWidth) return str;

  // Walk string preserving ANSI sequences up to maxWidth visible chars
  let visible = 0;
  let result = '';
  let i = 0;
  const target = Math.max(0, maxWidth - 1);
  while (i < str.length && visible < target) {
    if (str[i] === '\x1b') {
      const match = str.slice(i).match(/^\x1b\[[0-9;]*[a-zA-Z]/);
      if (match) {
        result += match[0];
        i += match[0].length;
        continue;
      }
    }
    result += str[i];
    visible++;
    i++;
  }
  return result + '…' + ANSI.reset;
}

function wrapPlainText(text, maxWidth) {
  if (!text) return [''];
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxWidth);
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word.slice(0, maxWidth);
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function renderProgressBar(pct, width, fillColor, emptyColor = fg256(238)) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  return `${fillColor}${'█'.repeat(filled)}${emptyColor}${'░'.repeat(empty)}${ANSI.reset}`;
}

// ============================================================================
// 7. PASSWORD & TEXT INPUT PROMPTS (FOR UNLOCK & MODALS)
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
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
        } else if (code === 127 || code === 8) {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (code >= 32) {
          password += ch;
          process.stdout.write(`${fg256(220)}✦${ANSI.reset}`);
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

function promptLine(questionText, defaultVal = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const suffix = defaultVal ? ` (${defaultVal}): ` : ': ';
    rl.question(`${questionText}${suffix}`, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultVal);
    });
  });
}

// ============================================================================
// 8. VAULT BOOTSTRAP (UNLOCK OR FIRST-TIME CREATION)
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
    console.log(`${fg256(220)}${ANSI.bold}╔══════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
    console.log(`${fg256(220)}${ANSI.bold}║         ✦  WELCOME TO AETHORIA GUILDHALL — NEW QUEST VAULT  ✦            ║${ANSI.reset}`);
    console.log(`${fg256(220)}${ANSI.bold}╚══════════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
    console.log(`${fg256(252)}  No encrypted Quest Vault found at: ${fg256(81)}${path.basename(vaultPath)}${ANSI.reset}`);
    console.log(`${fg256(245)}  Let's forge your Adventurer Seal (AES-256-GCM + scrypt encryption).\n${ANSI.reset}`);

    const heroName = await promptLine(`  ${fg256(214)}► Enter your Adventurer Name${ANSI.reset}`, 'Wayfarer');

    let password = '';
    while (true) {
      const pw1 = await promptHiddenPassword(`  ${fg256(214)}► Set your Guild Vault Passphrase: ${ANSI.reset}`);
      if (!pw1) {
        console.log(`  ${fg256(196)}Passphrase cannot be empty. Please choose a secret phrase.${ANSI.reset}`);
        continue;
      }
      const pw2 = await promptHiddenPassword(`  ${fg256(214)}► Confirm Guild Vault Passphrase : ${ANSI.reset}`);
      if (pw1 !== pw2) {
        console.log(`  ${fg256(196)}Passphrases did not match! Let's try again.${ANSI.reset}\n`);
        continue;
      }
      password = pw1;
      break;
    }

    const state = createInitialState(heroName);
    saveVaultToFile(vaultPath, state, password);
    console.log(`\n  ${fg256(46)}✔ Arcane Seal forged and encrypted! Opening the Guildhall...${ANSI.reset}`);
    await new Promise((r) => setTimeout(r, 600));
    return { state, password };
  }

  // Vault exists -> Unlock flow
  if (cliPassword) {
    const state = loadVaultFromFile(vaultPath, cliPassword);
    reconcileDailyState(state);
    return { state, password: cliPassword };
  }

  console.clear();
  console.log(`${fg256(179)}${ANSI.bold}╔══════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${fg256(179)}${ANSI.bold}║            ⚔  AETHORIA GUILDHALL — ARCANE VAULT SEALED  ⚔                ║${ANSI.reset}`);
  console.log(`${fg256(179)}${ANSI.bold}╚══════════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log(`${fg256(245)}  Vault File : ${fg256(253)}${vaultPath}${ANSI.reset}`);
  console.log(`${fg256(245)}  Cipher     : ${fg256(81)}AES-256-GCM (Authenticated Scrypt Key Derivation)${ANSI.reset}\n`);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const pw = await promptHiddenPassword(`  ${fg256(220)}🔑 Speak your Guild Passphrase to unseal (${attempt}/5): ${ANSI.reset}`);
    try {
      const state = loadVaultFromFile(vaultPath, pw);
      reconcileDailyState(state);
      saveVaultToFile(vaultPath, state, pw);
      return { state, password: pw };
    } catch {
      console.log(`  ${fg256(196)}✖ The Arcane Seal flares crimson! Incorrect passphrase.${ANSI.reset}\n`);
    }
  }

  console.log(`  ${fg256(196)}Too many failed attempts. The Guildhall doors remain bolted.${ANSI.reset}`);
  process.exit(1);
}

// ============================================================================
// 9. INTERACTIVE FULL-SCREEN TUI APPLICATION
// ============================================================================

class QuestBoardTUI {
  constructor(vaultPath, state, password) {
    this.vaultPath = vaultPath;
    this.state = state;
    this.password = password;

    this.viewTab = 'board'; // 'board' | 'pouch' | 'archive'
    this.realmFilter = 'ALL'; // 'ALL' or realm string
    this.sortMode = 'rank'; // 'rank' | 'hp' | 'newest'
    this.selectedIndex = 0;

    this.combatBanner = null;
    this.guildSpeech = generateGuildmasterSpeech(this.state);
    this.activeModal = null; // null | 'help' | 'relics' | 'themes' | 'leave' | 'fate'
    this.isPrompting = false;
  }

  getTheme() {
    const id = this.state.hero.activeTheme || 'parchment';
    return THEMES[id] || THEMES.parchment;
  }

  save() {
    saveVaultToFile(this.vaultPath, this.state, this.password);
  }

  getRealmsList() {
    const set = new Set(this.state.realms || []);
    for (const q of this.state.quests) {
      if (q.realm) set.add(q.realm);
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
      // In 'board' view, keep Active Pouch quests floated near top or sort by rank
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

  clampSelection() {
    const list = this.getFilteredQuests();
    if (list.length === 0) {
      this.selectedIndex = 0;
    } else if (this.selectedIndex >= list.length) {
      this.selectedIndex = list.length - 1;
    } else if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
    }
  }

  getSelectedQuest() {
    const list = this.getFilteredQuests();
    return list[this.selectedIndex] || null;
  }

  setCombatBanner(text, mood = 'hype') {
    this.combatBanner = text;
    this.guildSpeech = {
      mood,
      line: text,
    };
  }

  // --------------------------------------------------------------------------
  // RENDERING PIPELINE
  // --------------------------------------------------------------------------

  render() {
    if (this.isPrompting) return;

    this.clampSelection();
    const cols = Math.max(80, process.stdout.columns || 110);
    const rows = Math.max(24, process.stdout.rows || 32);
    const t = this.getTheme();
    const hero = this.state.hero;

    const out = [];
    const pushLine = (lineStr) => {
      out.push(padEndVisible(lineStr, cols) + ANSI.reset);
    };

    // 1. TOP BANNER / HERO STATUS BAR
    const titleStr = getHeroTitle(hero.level);
    const xpReq = xpRequiredForLevel(hero.level);
    const xpPct = Math.round((hero.xp / xpReq) * 100);
    const xpBar = renderProgressBar(xpPct, 10, t.xpBar);

    const leaveActive = isOnTavernLeave(hero);
    const streakBadge = leaveActive
      ? `${fg256(87)}[LEAVE UNTIL ${hero.leaveUntil} (${hero.streak}d Safe)]${ANSI.reset}`
      : `${fg256(208)}♦ ${hero.streak}d Streak${ANSI.reset}`;

    const topBarLeft = `${t.headerBg}${t.headerFg}${ANSI.bold} ✦ AETHORIA GUILDHALL ${ANSI.reset} ${t.accent}${ANSI.bold}${hero.name}${ANSI.reset} ${t.muted}[Lv.${hero.level} ${titleStr}]${ANSI.reset}`;
    const topBarRight = `XP ${xpBar} ${t.text}${hero.xp}/${xpReq}${ANSI.reset} │ ${fg256(220)}¤ ${hero.gold}g${ANSI.reset} │ ${streakBadge} │ ${t.muted}Relics:${hero.relics.length}/${RELIC_CATALOG.length}${ANSI.reset}`;
    const gap1 = Math.max(1, cols - visibleLength(topBarLeft) - visibleLength(topBarRight));
    pushLine(topBarLeft + ' '.repeat(gap1) + topBarRight);

    // 2. GUILDMASTER NPC & DAILY RUN COMBO BAR
    const moodMeta = GUILDMASTER_MOODS[this.guildSpeech.mood] || GUILDMASTER_MOODS.idle;
    const openCount = this.state.quests.filter((q) => q.status === 'open').length;
    const pouchCount = this.state.quests.filter((q) => q.status === 'open' && q.inPouch).length;
    const doneToday = hero.completedToday || 0;
    const comboStatus = hero.pouchClearedToday
      ? `${fg256(46)}${ANSI.bold}★ DAILY FULL-CLEAR ACHIEVED! ★${ANSI.reset}`
      : `${t.pouchAccent}Active Pouch: ${pouchCount} Picked${ANSI.reset} ${t.muted}(Done Today: ${doneToday})${ANSI.reset}`;

    pushLine(`${t.border}╔${'═'.repeat(cols - 2)}╗${ANSI.reset}`);
    const npcPrefix = `${t.border}║${ANSI.reset} ${t.borderBright}${ANSI.bold}${moodMeta.face}${ANSI.reset} `;
    const npcRight = ` │ ${comboStatus} ${t.border}║${ANSI.reset}`;
    const maxSpeechWidth = Math.max(20, cols - visibleLength(npcPrefix) - visibleLength(npcRight));
    const speechTrimmed = padEndVisible(
      `${t.text}${ truncateVisible(this.guildSpeech.line, maxSpeechWidth) }${ANSI.reset}`,
      maxSpeechWidth
    );
    pushLine(npcPrefix + speechTrimmed + npcRight);

    // 3. VIEW TABS & REALM FILTER BAR
    const tabBoard =
      this.viewTab === 'board'
        ? `${bg256(220)}${fg256(16)}${ANSI.bold} [b] Guild Board (${openCount}) ${ANSI.reset}`
        : `${t.muted} [b] Guild Board (${openCount}) ${ANSI.reset}`;
    const tabPouch =
      this.viewTab === 'pouch'
        ? `${bg256(45)}${fg256(16)}${ANSI.bold} [p] Active Quest Pouch (${pouchCount}) ${ANSI.reset}`
        : `${t.muted} [p] Active Quest Pouch (${pouchCount}) ${ANSI.reset}`;
    const doneTotal = this.state.quests.filter((q) => q.status === 'done').length;
    const tabArchive =
      this.viewTab === 'archive'
        ? `${bg256(114)}${fg256(16)}${ANSI.bold} [a] Hall of Legends (${doneTotal}) ${ANSI.reset}`
        : `${t.muted} [a] Hall of Legends (${doneTotal}) ${ANSI.reset}`;

    const realms = this.getRealmsList();
    const realmPills = realms
      .map((r) =>
        r === this.realmFilter
          ? `${t.accent}${ANSI.bold}${ANSI.underline}[${r}]${ANSI.reset}`
          : `${t.muted}${r}${ANSI.reset}`
      )
      .join(' · ');

    const filterRowInner = ` ${tabBoard} ${tabPouch} ${tabArchive} │ ${t.muted}Realm [Tab]:${ANSI.reset} ${realmPills}`;
    pushLine(
      `${t.border}╠${'═'.repeat(cols - 2)}╣${ANSI.reset}`
    );
    pushLine(
      `${t.border}║${ANSI.reset}` +
        padEndVisible(filterRowInner, cols - 2) +
        `${t.border}║${ANSI.reset}`
    );

    // 4. MAIN SPLIT-PANE BODY (LEFT: QUEST LIST, RIGHT: QUEST SCROLL INSPECTOR)
    const leftWidth = Math.max(42, Math.floor((cols - 3) * 0.52));
    const rightWidth = cols - 3 - leftWidth;
    pushLine(
      `${t.border}╠${'═'.repeat(leftWidth)}╦${'═'.repeat(rightWidth)}╣${ANSI.reset}`
    );

    const bodyRows = Math.max(10, rows - 10);
    const leftLines = this.buildLeftPaneLines(leftWidth, bodyRows);
    const rightLines = this.buildRightPaneLines(rightWidth, bodyRows);

    for (let i = 0; i < bodyRows; i++) {
      const l = padEndVisible(leftLines[i] || '', leftWidth);
      const r = padEndVisible(rightLines[i] || '', rightWidth);
      pushLine(`${t.border}║${ANSI.reset}${l}${t.border}║${ANSI.reset}${r}${t.border}║${ANSI.reset}`);
    }

    pushLine(
      `${t.border}╚${'═'.repeat(leftWidth)}╩${'═'.repeat(rightWidth)}╝${ANSI.reset}`
    );

    // 5. FOOTER HOTKEY LEGEND (2 LINES)
    const hk1 =
      ` ${t.borderBright}[↑/↓]${t.muted}Select ` +
      `${t.borderBright}[Space]${t.muted}Pick/Embark ` +
      `${t.borderBright}[1-9]${t.muted}Strike Sub-step ` +
      `${t.borderBright}[c]${t.muted}Complete/Slay ` +
      `${t.borderBright}[d]${t.accent}Roll d20 Fate ` +
      `${t.borderBright}[n]${t.muted}New Quest ` +
      `${t.borderBright}[s]${t.muted}+Sub-step ` +
      `${t.borderBright}[m]${t.muted}+Note`;
    const hk2 =
      ` ${t.borderBright}[r]${t.muted}Cycle Rank ` +
      `${t.borderBright}[e]${t.muted}Edit ` +
      `${t.borderBright}[x]${t.muted}Delete ` +
      `${t.borderBright}[o]${t.muted}Sort:${this.sortMode} ` +
      `${t.borderBright}[v]${fg256(87)}Tavern Leave ` +
      `${t.borderBright}[l]${t.muted}Relics ` +
      `${t.borderBright}[t]${t.muted}Themes ` +
      `${t.borderBright}[K]${t.muted}Passphrase ` +
      `${t.borderBright}[?]${t.muted}Help ` +
      `${t.borderBright}[q]${t.muted}Save & Quit`;

    pushLine(hk1);
    pushLine(hk2);

    // If a modal is open, overlay it in the center of the screen buffer
    if (this.activeModal) {
      this.applyModalOverlay(out, cols, rows);
    }

    process.stdout.write(ANSI.home + out.slice(0, rows).join('\n'));
  }

  buildLeftPaneLines(width, height) {
    const t = this.getTheme();
    const lines = [];
    const quests = this.getFilteredQuests();

    const headerTitle =
      this.viewTab === 'pouch'
        ? `${t.pouchAccent}${ANSI.bold} ★ ACTIVE QUEST POUCH (TODAY'S LOADOUT)${ANSI.reset}`
        : this.viewTab === 'archive'
        ? `${fg256(114)}${ANSI.bold} ✦ HALL OF LEGENDS (COMPLETED QUESTS)${ANSI.reset}`
        : `${t.accent}${ANSI.bold} § GUILD NOTICE BOARD${ANSI.reset} ${t.muted}(★ = Picked in Pouch)${ANSI.reset}`;

    lines.push(padEndVisible(headerTitle, width));
    lines.push(`${t.muted}${'─'.repeat(width)}${ANSI.reset}`);

    if (quests.length === 0) {
      lines.push('');
      lines.push(`  ${t.muted}No quests posted in this view.${ANSI.reset}`);
      if (this.viewTab === 'pouch') {
        lines.push(`  ${t.accent}► Press [b] to browse the Guild Board and [Space] to pick quests!${ANSI.reset}`);
        lines.push(`  ${t.accent}► Or press [d] to Roll the d20 of Fate for a 1.5x XP Bounty!${ANSI.reset}`);
      } else {
        lines.push(`  ${t.accent}► Press [n] to post a new Quest Scroll!${ANSI.reset}`);
      }
      return lines;
    }

    // Each quest takes 2 lines in the list for clear readability (Rank+Title, Realm+HP Bar)
    const itemsPerPage = Math.max(1, Math.floor((height - 2) / 2));
    const startIdx = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(itemsPerPage / 2),
        Math.max(0, quests.length - itemsPerPage)
      )
    );
    const visibleSlice = quests.slice(startIdx, startIdx + itemsPerPage);

    visibleSlice.forEach((q, idx) => {
      const realIdx = startIdx + idx;
      const isSelected = realIdx === this.selectedIndex;
      const rankMeta = RANKS[q.rank] || RANKS.C;
      const hp = computeQuestHp(q);

      const pointer = isSelected ? `${t.borderBright}${ANSI.bold}►${ANSI.reset}` : ' ';
      const pouchStar = q.inPouch
        ? `${fg256(220)}${ANSI.bold}★${ANSI.reset}`
        : `${t.muted}·${ANSI.reset}`;
      const bountyTag =
        q.bountyMultiplier > 1
          ? ` ${fg256(213)}${ANSI.bold}[♦${q.bountyMultiplier}x]${ANSI.reset}`
          : '';

      const rowBg = isSelected ? t.highlightBg : '';
      const titleColor = isSelected ? `${t.text}${ANSI.bold}` : t.text;

      const prefix1 = `${pointer}${pouchStar}${rankMeta.badge} `;
      const maxTitleLen = Math.max(10, width - visibleLength(prefix1) - visibleLength(bountyTag) - 1);
      const titlePart = truncateVisible(q.title, maxTitleLen);
      const line1Raw = `${prefix1}${rowBg}${titleColor}${titlePart}${ANSI.reset}${bountyTag}`;
      lines.push(padEndVisible(line1Raw, width));

      // Sub-line: Realm + Boss HP Bar + Step count
      const hpColor = hp.pct > 60 ? t.hpFull : hp.pct > 25 ? t.hpMid : t.hpLow;
      const hpBar = renderProgressBar(hp.pct, 8, hpColor);
      const stepLabel =
        hp.totalCount > 0 ? `${hp.doneCount}/${hp.totalCount} steps` : `${hp.pct}% HP`;
      const subLine = `    ${t.muted}[${truncateVisible(q.realm || 'General', 14)}]${ANSI.reset} HP:${hpBar} ${t.muted}${stepLabel}${ANSI.reset}`;
      lines.push(padEndVisible(subLine, width));
    });

    return lines;
  }

  buildRightPaneLines(width, height) {
    const t = this.getTheme();
    const lines = [];
    const q = this.getSelectedQuest();

    if (!q) {
      lines.push(`${t.accent}${ANSI.bold} ✦ QUEST SCROLL INSPECTOR${ANSI.reset}`);
      lines.push(`${t.muted}${'─'.repeat(width)}${ANSI.reset}`);
      lines.push(`  ${t.muted}Select a quest on the left or press [n] to create one.${ANSI.reset}`);
      return lines;
    }

    const rankMeta = RANKS[q.rank] || RANKS.C;
    const hp = computeQuestHp(q);
    const mult = q.bountyMultiplier || 1;
    const xpReward = Math.round(rankMeta.xp * mult);
    const goldReward = Math.round(rankMeta.gold * mult);

    // Header
    const statusBadge =
      q.status === 'done'
        ? `${fg256(46)}${ANSI.bold}[SLAIN - Press u to Reopen]${ANSI.reset}`
        : q.inPouch
        ? `${fg256(220)}${ANSI.bold}[★ IN ACTIVE POUCH]${ANSI.reset}`
        : `${t.muted}[ON GUILD BOARD]${ANSI.reset}`;

    lines.push(` ${rankMeta.badge} ${statusBadge} ${t.muted}Realm:${ANSI.reset} ${t.accent}${q.realm}${ANSI.reset}`);
    lines.push(`${t.muted}${'─'.repeat(width)}${ANSI.reset}`);

    // Wrapped Quest Title
    const titleLines = wrapPlainText(q.title, width - 3);
    for (const tl of titleLines.slice(0, 2)) {
      lines.push(` ${t.text}${ANSI.bold}${tl}${ANSI.reset}`);
    }

    // Rewards & Fate Bounty Banner
    const bountyNote =
      mult > 1 ? ` ${fg256(213)}${ANSI.bold}♦ ${q.bountyLabel || `FATE BOUNTY (${mult}x)`}${ANSI.reset}` : '';
    lines.push(
      ` ${t.muted}Bounty:${ANSI.reset} ${fg256(45)}+${xpReward} XP${ANSI.reset}  ${fg256(220)}+${goldReward} Gold${ANSI.reset}${bountyNote}`
    );

    // Boss HP Bar
    const hpBarWidth = Math.max(10, Math.min(24, width - 24));
    const hpColor = hp.pct > 60 ? t.hpFull : hp.pct > 25 ? t.hpMid : t.hpLow;
    const bossBar = renderProgressBar(hp.pct, hpBarWidth, hpColor);
    lines.push(
      ` ${t.muted}Boss HP:${ANSI.reset} [${bossBar}] ${ANSI.bold}${hp.current}/${hp.max} HP (${hp.pct}%)${ANSI.reset}`
    );
    lines.push(`${t.muted}${'─'.repeat(width)}${ANSI.reset}`);

    // Sub-Steps / Hit Points Checklist
    lines.push(
      ` ${t.accent}${ANSI.bold}► SUB-QUEST OBJECTIVES${ANSI.reset} ${t.muted}(Press [1]-[9] to Strike, [s] to Add)${ANSI.reset}`
    );
    const steps = q.steps || [];
    if (steps.length === 0) {
      lines.push(`   ${t.muted}No sub-steps yet. Press [s] to break this boss into hit points!${ANSI.reset}`);
    } else {
      steps.slice(0, 9).forEach((st, idx) => {
        const keyNum = idx + 1;
        const box = st.done
          ? `${fg256(46)}[x]${ANSI.reset}`
          : `${fg256(196)}[${keyNum}]${ANSI.reset}`;
        const textStyle = st.done ? `${t.muted}` : `${t.text}`;
        const stepStr = `  ${box} ${textStyle}${st.text}${ANSI.reset}`;
        lines.push(truncateVisible(stepStr, width - 1));
      });
    }

    lines.push(`${t.muted}${'─'.repeat(width)}${ANSI.reset}`);

    // Notes & Lore Entries
    lines.push(
      ` ${t.accent2}${ANSI.bold}§ LORE & FIELD NOTES${ANSI.reset} ${t.muted}(Press [m] to Add Note)${ANSI.reset}`
    );
    const notes = q.notes || [];
    if (notes.length === 0) {
      lines.push(`   ${t.muted}No field notes inscribed. Press [m] to jot down details.${ANSI.reset}`);
    } else {
      for (const note of notes) {
        const wrapped = wrapPlainText(`• ${note}`, width - 4);
        for (const wl of wrapped) {
          if (lines.length < height - 1) {
            lines.push(`  ${t.text}${wl}${ANSI.reset}`);
          }
        }
      }
    }

    return lines;
  }

  // --------------------------------------------------------------------------
  // MODAL OVERLAYS (RELIQUARY, THEMES, TAVERN LEAVE, FATE ROLL, HELP)
  // --------------------------------------------------------------------------

  applyModalOverlay(screenLines, cols, rows) {
    const t = this.getTheme();
    const modalLines = [];

    if (this.activeModal === 'help') {
      modalLines.push(`${t.borderBright}${ANSI.bold}✦ ADVENTURER'S FIELD MANUAL (HOTKEYS) ✦${ANSI.reset}`);
      modalLines.push('');
      modalLines.push(`${t.accent}[Up/Down] or [j/k]${ANSI.reset}  Navigate quests on the current board`);
      modalLines.push(`${t.accent}[Space]${ANSI.reset}             Embark / Un-embark quest into Active Quest Pouch`);
      modalLines.push(`${t.accent}[1] - [9]${ANSI.reset}           Strike sub-step #1–9 (Deals Boss HP damage!)`);
      modalLines.push(`${t.accent}[c] or [Enter]${ANSI.reset}      Slay / Complete selected quest for XP, Gold & Loot`);
      modalLines.push(`${t.accent}[d]${ANSI.reset}                 Roll the d20 of Fate (Picks a random quest w/ 1.5x–2x Bounty)`);
      modalLines.push(`${t.accent}[n]${ANSI.reset}                 Post a New Quest Scroll`);
      modalLines.push(`${t.accent}[s] / [m]${ANSI.reset}           Add a Sub-step [s] or Field Note [m] to selected quest`);
      modalLines.push(`${t.accent}[r]${ANSI.reset}                 Cycle Quest Priority Rank (S -> A -> B -> C -> D)`);
      modalLines.push(`${t.accent}[e] / [x]${ANSI.reset}           Edit quest details [e] or Delete quest [x]`);
      modalLines.push(`${t.accent}[Tab]${ANSI.reset}               Cycle Realm / Group filter`);
      modalLines.push(`${t.accent}[v]${ANSI.reset}                 Tavern Leave (Pause streak for vacation / planned rest)`);
      modalLines.push(`${t.accent}[l] / [t]${ANSI.reset}           View Reliquary Loot Drops [l] or Visual Themes [t]`);
      modalLines.push(`${t.accent}[K]${ANSI.reset}                 Change Vault Encryption Passphrase`);
      modalLines.push('');
      modalLines.push(`${t.muted}Press [Esc] or [Enter] to return to the Guildhall.${ANSI.reset}`);
    } else if (this.activeModal === 'relics') {
      const hero = this.state.hero;
      modalLines.push(`${t.borderBright}${ANSI.bold}★ GUILD RELIQUARY & ARTIFACT VAULT (${hero.relics.length}/${RELIC_CATALOG.length}) ★${ANSI.reset}`);
      modalLines.push(`${t.muted}Complete quests (especially S/A Rank & Fate Bounties) to discover rare relics!${ANSI.reset}`);
      modalLines.push('');
      for (const relic of RELIC_CATALOG) {
        const owned = hero.relics.includes(relic.id);
        if (owned) {
          modalLines.push(
            `${fg256(220)}${ANSI.bold}${relic.art}${ANSI.reset} ${t.text}${ANSI.bold}${relic.name}${ANSI.reset} ${fg256(81)}[${relic.rarity}]${ANSI.reset} — ${fg256(46)}${relic.bonusText}${ANSI.reset}`
          );
          modalLines.push(`        ${t.muted}"${relic.lore}"${ANSI.reset}`);
        } else {
          modalLines.push(
            `${t.muted} [???]  Undiscovered Relic [${relic.rarity}] — Slay more quests to unearth!${ANSI.reset}`
          );
        }
      }
      modalLines.push('');
      modalLines.push(`${t.muted}Press [Esc] or [l] to close the Reliquary.${ANSI.reset}`);
    } else if (this.activeModal === 'themes') {
      const hero = this.state.hero;
      modalLines.push(`${t.borderBright}${ANSI.bold}✦ TAVERN VISUAL THEMES (Your Gold: ${hero.gold}g) ✦${ANSI.reset}`);
      modalLines.push(`${t.muted}Press [1]-[6] to equip or unlock a visual theme with your hard-earned Gold:${ANSI.reset}`);
      modalLines.push('');
      Object.values(THEMES).forEach((th, idx) => {
        const unlocked = hero.unlockedThemes?.includes(th.id) || th.cost === 0;
        const active = hero.activeTheme === th.id;
        const status = active
          ? `${fg256(46)}${ANSI.bold}[EQUIPPED]${ANSI.reset}`
          : unlocked
          ? `${fg256(81)}[UNLOCKED]${ANSI.reset}`
          : `${fg256(220)}[Cost: ${th.cost}g]${ANSI.reset}`;
        modalLines.push(
          ` ${t.borderBright}[${idx + 1}]${ANSI.reset} ${th.accent}${ANSI.bold}${th.name}${ANSI.reset} ${status}`
        );
        modalLines.push(`     ${t.muted}${th.desc}${ANSI.reset}`);
      });
      modalLines.push('');
      modalLines.push(`${t.muted}Press [1]-[6] to select, or [Esc] to close.${ANSI.reset}`);
    } else if (this.activeModal === 'leave') {
      const hero = this.state.hero;
      const activeLeave = isOnTavernLeave(hero);
      modalLines.push(`${fg256(87)}${ANSI.bold}✦ SANCTUARY DECREE — PLANNED TAVERN LEAVE (VACATION MODE) ✦${ANSI.reset}`);
      modalLines.push(`${t.text}Going on vacation or stepping away? Declare Tavern Leave ahead of time${ANSI.reset}`);
      modalLines.push(`${t.text}so your ${hero.streak}-day streak stays 100% protected while you rest!${ANSI.reset}`);
      modalLines.push('');
      modalLines.push(
        `Current Status: ${
          activeLeave
            ? `${fg256(46)}${ANSI.bold}ON LEAVE UNTIL ${hero.leaveUntil}${ANSI.reset}`
            : `${t.accent}Active Adventuring Duty${ANSI.reset}`
        }`
      );
      modalLines.push('');
      modalLines.push(` ${t.borderBright}[1]${ANSI.reset} Rest for Tomorrow (1 Day Protected)`);
      modalLines.push(` ${t.borderBright}[2]${ANSI.reset} Long Weekend Retreat (3 Days Protected)`);
      modalLines.push(` ${t.borderBright}[3]${ANSI.reset} Full Week Expedition / Vacation (7 Days Protected)`);
      modalLines.push(` ${t.borderBright}[4]${ANSI.reset} Fortnight Odyssey (14 Days Protected)`);
      modalLines.push(` ${t.borderBright}[5]${ANSI.reset} Custom Number of Days...`);
      modalLines.push(` ${t.borderBright}[0]${ANSI.reset} Resume Adventuring Immediately (End Leave Early)`);
      modalLines.push('');
      modalLines.push(`${t.muted}Press [1]-[5], [0], or [Esc] to close.${ANSI.reset}`);
    } else if (this.activeModal === 'fate_rolling') {
      const faceStr = String(this.rollingDieValue || 20).padStart(2, ' ');
      modalLines.push(`${fg256(213)}${ANSI.bold}✦ ROLLING THE STARFORGED d20 OF FATE... ✦${ANSI.reset}`);
      modalLines.push('');
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}    /\\    ${ANSI.reset}`);
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}   /  \\   ${ANSI.reset}`);
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}  / ${fg256(51)}${faceStr}${fg256(220)} \\  ${ANSI.reset}`);
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}  \\    /  ${ANSI.reset}`);
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}   \\  /   ${ANSI.reset}`);
      modalLines.push(`                  ${fg256(220)}${ANSI.bold}    \\/    ${ANSI.reset}`);
      modalLines.push('');
      modalLines.push(`${t.muted}The Fates are choosing your next contract...${ANSI.reset}`);
    }

    const boxWidth = Math.min(cols - 6, 78);
    const boxHeight = modalLines.length + 4;
    const startRow = Math.max(2, Math.floor((rows - boxHeight) / 2));
    const leftPad = Math.max(2, Math.floor((cols - boxWidth) / 2));

    const drawOverlayRow = (rIdx, content) => {
      if (rIdx >= 0 && rIdx < screenLines.length) {
        const line =
          ' '.repeat(leftPad) +
          `${bg256(234)}${t.borderBright}║${ANSI.reset}${bg256(234)} ` +
          padEndVisible(content, boxWidth - 4) +
          ` ${t.borderBright}║${ANSI.reset}`;
        screenLines[rIdx] = padEndVisible(line, cols);
      }
    };

    if (startRow - 1 >= 0) {
      screenLines[startRow - 1] = padEndVisible(
        ' '.repeat(leftPad) + `${bg256(234)}${t.borderBright}╔${'═'.repeat(boxWidth - 2)}╗${ANSI.reset}`,
        cols
      );
    }
    modalLines.forEach((mLine, idx) => {
      drawOverlayRow(startRow + idx, mLine);
    });
    const botIdx = startRow + modalLines.length;
    if (botIdx < screenLines.length) {
      screenLines[botIdx] = padEndVisible(
        ' '.repeat(leftPad) + `${bg256(234)}${t.borderBright}╚${'═'.repeat(boxWidth - 2)}╝${ANSI.reset}`,
        cols
      );
    }
  }

  // --------------------------------------------------------------------------
  // INTERACTIVE WIZARDS (NEW QUEST, EDIT, SUB-STEP, NOTE, ROLL FOR FATE)
  // --------------------------------------------------------------------------

  async withPromptMode(fn) {
    this.isPrompting = true;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdout.write(ANSI.showCursor + ANSI.clearScreen);
    try {
      await fn();
    } finally {
      this.save();
      process.stdout.write(ANSI.hideCursor);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      this.isPrompting = false;
      this.render();
    }
  }

  async createQuestWizard() {
    await this.withPromptMode(async () => {
      const t = this.getTheme();
      console.log(`${t.borderBright}${ANSI.bold}╔══════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
      console.log(`${t.borderBright}${ANSI.bold}║                  📜  POST A NEW QUEST SCROLL  📜                     ║${ANSI.reset}`);
      console.log(`${t.borderBright}${ANSI.bold}╚══════════════════════════════════════════════════════════════════════╝${ANSI.reset}\n`);

      const title = await promptLine(`  ${t.accent}1. Quest Title (leave blank to cancel)${ANSI.reset}`, '');
      if (!title) return;

      const rankInput = (
        await promptLine(`  ${t.accent}2. Priority Rank [S / A / B / C / D]${ANSI.reset}`, 'B')
      ).toUpperCase();
      const rank = RANK_KEYS.includes(rankInput) ? rankInput : 'B';

      const existingRealms = (this.state.realms || []).join(', ');
      console.log(`     ${t.muted}Available Realms: ${existingRealms}${ANSI.reset}`);
      const realm = await promptLine(
        `  ${t.accent}3. Realm / Group Name${ANSI.reset}`,
        this.realmFilter !== 'ALL' ? this.realmFilter : 'Main Campaign'
      );
      if (realm && !this.state.realms.includes(realm)) {
        this.state.realms.push(realm);
      }

      const stepsRaw = await promptLine(
        `  ${t.accent}4. Sub-Quest Objectives (comma-separated, or blank)${ANSI.reset}`,
        ''
      );
      const steps = stepsRaw
        ? stepsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((text) => ({ text, done: false }))
        : [];

      const noteRaw = await promptLine(
        `  ${t.accent}5. Initial Lore / Field Note (optional)${ANSI.reset}`,
        ''
      );
      const notes = noteRaw ? [noteRaw] : [];

      const pickNow = (
        await promptLine(`  ${t.accent}6. Add directly to Today's Active Quest Pouch? [Y/n]${ANSI.reset}`, 'Y')
      ).toLowerCase();

      const newQuest = {
        id: 'q-' + crypto.randomBytes(4).toString('hex'),
        title,
        rank,
        realm,
        inPouch: pickNow !== 'n',
        status: 'open',
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: new Date().toISOString(),
        notes,
        steps,
      };

      this.state.quests.unshift(newQuest);
      this.selectedIndex = 0;
      this.setCombatBanner(
        `"New [${rank}-Rank] contract '${title}' posted to ${realm}!"`,
        'hype'
      );
    });
  }

  async editQuestWizard(quest) {
    if (!quest) return;
    await this.withPromptMode(async () => {
      const t = this.getTheme();
      console.log(`${t.borderBright}${ANSI.bold}═══ EDIT QUEST SCROLL ═══${ANSI.reset}\n`);
      quest.title = await promptLine(`  ${t.accent}Title${ANSI.reset}`, quest.title);
      const rIn = (await promptLine(`  ${t.accent}Rank [S/A/B/C/D]${ANSI.reset}`, quest.rank)).toUpperCase();
      if (RANK_KEYS.includes(rIn)) quest.rank = rIn;
      const newRealm = await promptLine(`  ${t.accent}Realm / Group${ANSI.reset}`, quest.realm);
      if (newRealm) {
        quest.realm = newRealm;
        if (!this.state.realms.includes(newRealm)) {
          this.state.realms.push(newRealm);
        }
      }
      this.setCombatBanner(`"Updated scroll details for '${quest.title}'."`, 'idle');
    });
  }

  async addSubStepWizard(quest) {
    if (!quest || quest.status === 'done') return;
    await this.withPromptMode(async () => {
      const t = this.getTheme();
      console.log(`${t.borderBright}${ANSI.bold}═══ ADD SUB-QUEST OBJECTIVE (BOSS HP SEGMENT) ═══${ANSI.reset}`);
      console.log(`  Quest: ${t.text}${quest.title}${ANSI.reset}\n`);
      const stepText = await promptLine(`  ${t.accent}New Sub-Step Objective (blank to cancel)${ANSI.reset}`, '');
      if (stepText) {
        if (!quest.steps) quest.steps = [];
        quest.steps.push({ text: stepText, done: false });
        this.setCombatBanner(
          `"Added objective '${stepText}' to '${quest.title}'!"`,
          'idle'
        );
      }
    });
  }

  async addNoteWizard(quest) {
    if (!quest) return;
    await this.withPromptMode(async () => {
      const t = this.getTheme();
      console.log(`${t.borderBright}${ANSI.bold}═══ INSCRIBE LORE / FIELD NOTE ═══${ANSI.reset}`);
      console.log(`  Quest: ${t.text}${quest.title}${ANSI.reset}\n`);
      const noteText = await promptLine(`  ${t.accent}Note / Detail (blank to cancel)${ANSI.reset}`, '');
      if (noteText) {
        if (!quest.notes) quest.notes = [];
        const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        quest.notes.push(`[${stamp}] ${noteText}`);
        this.setCombatBanner(`"Field note inscribed onto '${quest.title}'."`, 'idle');
      }
    });
  }

  async changePassphraseWizard() {
    await this.withPromptMode(async () => {
      const t = this.getTheme();
      console.log(`${t.borderBright}${ANSI.bold}═══ RE-FORGE VAULT PASSPHRASE (AES-256-GCM) ═══${ANSI.reset}\n`);
      const current = await promptHiddenPassword(`  ${t.accent}Current Passphrase: ${ANSI.reset}`);
      if (current !== this.password) {
        console.log(`\n  ${fg256(196)}✖ Incorrect current passphrase! Cancelled.${ANSI.reset}`);
        await new Promise((r) => setTimeout(r, 1200));
        return;
      }
      const next1 = await promptHiddenPassword(`  ${t.accent}New Passphrase    : ${ANSI.reset}`);
      if (!next1) return;
      const next2 = await promptHiddenPassword(`  ${t.accent}Confirm Passphrase: ${ANSI.reset}`);
      if (next1 !== next2) {
        console.log(`\n  ${fg256(196)}✖ Passphrases did not match!${ANSI.reset}`);
        await new Promise((r) => setTimeout(r, 1200));
        return;
      }
      this.password = next1;
      this.save();
      this.setCombatBanner(`"Arcane Vault Seal re-forged with your new passphrase!"`, 'hype');
    });
  }

  async rollForFateAnimation() {
    const candidates = this.state.quests.filter((q) => q.status === 'open');
    if (candidates.length === 0) {
      this.setCombatBanner(`"No open quests on the board to roll for! Post one with [n] first."`, 'tease');
      this.render();
      return;
    }

    // Prefer quests not yet in pouch, or any open quest
    const unpicked = candidates.filter((q) => !q.inPouch);
    const pool = unpicked.length > 0 ? unpicked : candidates;

    const finalRoll = Math.floor(Math.random() * 20) + 1;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    // Animate the tumbling d20 crystal in the modal overlay!
    this.activeModal = 'fate_rolling';
    for (let i = 0; i < 8; i++) {
      this.rollingDieValue = i === 7 ? finalRoll : Math.floor(Math.random() * 20) + 1;
      this.render();
      await new Promise((r) => setTimeout(r, 70));
    }
    this.activeModal = null;

    const isNat20 = finalRoll === 20;
    chosen.inPouch = true;
    chosen.bountyMultiplier = isNat20 ? 2.0 : 1.5;
    chosen.bountyLabel = isNat20
      ? `NAT 20 MYTHIC BOUNTY (2.0x XP & Gold + Relic!)`
      : `d20=${finalRoll} FATE BOUNTY (1.5x XP & Gold)`;

    this.save();

    // Focus selection on the chosen quest
    const list = this.getFilteredQuests();
    const idx = list.findIndex((q) => q.id === chosen.id);
    if (idx >= 0) this.selectedIndex = idx;

    this.setCombatBanner(
      isNat20
        ? `★ NATURAL 20!! Fate decrees '${chosen.title}' with a 2.0x MYTHIC BOUNTY & guaranteed Relic drop!`
        : `♦ Rolled d20 = [${finalRoll}]! Fate assigns '${chosen.title}' to your Active Pouch with a 1.5x Bounty!`,
      'fate'
    );
    this.render();
  }

  strikeSubStep(quest, stepIdx) {
    if (!quest || quest.status === 'done') return;
    if (!quest.steps || !quest.steps[stepIdx]) return;

    const step = quest.steps[stepIdx];
    step.done = !step.done;

    if (step.done) {
      const isCrit = Math.random() < 0.35;
      const chipXp = (isCrit ? 15 : 8) + (hasRelic(this.state.hero, 'featherquill_blade') ? 5 : 0);
      if (isCrit) this.state.hero.critsLanded = (this.state.hero.critsLanded || 0) + 1;
      awardXpAndGold(this.state, chipXp, isCrit ? 4 : 2);

      const hp = computeQuestHp(quest);
      this.setCombatBanner(
        isCrit
          ? `★ CRITICAL STRIKE!! Checked off '${step.text}' (+${chipXp} XP)! Boss HP down to ${hp.pct}%!`
          : `► Direct Hit! Checked off '${step.text}' (+${chipXp} XP)! Boss HP at ${hp.pct}%.`,
        'crit'
      );
    } else {
      this.setCombatBanner(`"Re-opened sub-step '${step.text}'."`, 'idle');
    }

    this.save();
    this.render();
  }

  slaySelectedQuest() {
    const q = this.getSelectedQuest();
    if (!q || q.status === 'done') return;

    const res = completeQuest(this.state, q);
    this.save();

    let banner = `★ QUEST SLAIN! '${q.title}' -> +${res.finalXp} XP, +${res.finalGold}g!`;
    if (res.leveledUp) {
      banner += ` ★ LEVEL UP! You are now Lv.${res.newLevel} ${getHeroTitle(res.newLevel)}!`;
    }
    if (res.fullClearTriggered) {
      banner += ` ★ DAILY FULL-CLEAR COMBO BONUS!`;
    }
    if (res.droppedRelic) {
      banner += ` ✦ RELIC UNEARTHED: [${res.droppedRelic.name}]!`;
    }

    this.setCombatBanner(banner, 'hype');
    this.render();
  }

  // --------------------------------------------------------------------------
  // KEYBOARD EVENT LOOP
  // --------------------------------------------------------------------------

  start() {
    process.stdout.write(ANSI.altScreenOn + ANSI.hideCursor + ANSI.clearScreen);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onResize = () => this.render();
    process.stdout.on('resize', onResize);

    const cleanupAndExit = () => {
      this.save();
      process.stdout.write(ANSI.showCursor + ANSI.altScreenOff);
      process.exit(0);
    };

    process.on('SIGINT', cleanupAndExit);

    process.stdin.on('keypress', async (str, key) => {
      if (this.isPrompting) return;
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanupAndExit();
        return;
      }

      // Handle active modals first
      if (this.activeModal) {
        await this.handleModalKeypress(str, key);
        return;
      }

      const list = this.getFilteredQuests();
      const currentQuest = this.getSelectedQuest();

      if (key.name === 'q') {
        cleanupAndExit();
        return;
      }

      if (key.name === 'up' || str === 'k') {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.render();
      } else if (key.name === 'down' || str === 'j') {
        this.selectedIndex = Math.min(Math.max(0, list.length - 1), this.selectedIndex + 1);
        this.render();
      } else if (str === 'b') {
        this.viewTab = 'board';
        this.selectedIndex = 0;
        this.render();
      } else if (str === 'p') {
        this.viewTab = 'pouch';
        this.selectedIndex = 0;
        this.render();
      } else if (str === 'a') {
        this.viewTab = 'archive';
        this.selectedIndex = 0;
        this.render();
      } else if (key.name === 'tab') {
        const realms = this.getRealmsList();
        const curIdx = realms.indexOf(this.realmFilter);
        const nextIdx = (curIdx + 1) % realms.length;
        this.realmFilter = realms[nextIdx];
        this.selectedIndex = 0;
        this.render();
      } else if (key.name === 'space') {
        if (currentQuest && currentQuest.status === 'open') {
          currentQuest.inPouch = !currentQuest.inPouch;
          this.save();
          this.setCombatBanner(
            currentQuest.inPouch
              ? `★ Embarked! '${currentQuest.title}' added to Today's Active Quest Pouch!`
              : `Returned '${currentQuest.title}' to the Guild Notice Board.`,
            currentQuest.inPouch ? 'hype' : 'idle'
          );
          this.render();
        }
      } else if (str >= '1' && str <= '9') {
        const stepIdx = parseInt(str, 10) - 1;
        this.strikeSubStep(currentQuest, stepIdx);
      } else if (str === 'c' || key.name === 'return') {
        this.slaySelectedQuest();
      } else if (str === 'u') {
        if (currentQuest && currentQuest.status === 'done') {
          currentQuest.status = 'open';
          if (Array.isArray(currentQuest.steps)) {
            currentQuest.steps.forEach((s) => {
              s.done = false;
            });
          }
          this.save();
          this.setCombatBanner(`"Re-opened quest '${currentQuest.title}' on the Guild Board!"`, 'idle');
          this.render();
        }
      } else if (str === 'd') {
        await this.rollForFateAnimation();
      } else if (str === 'n') {
        await this.createQuestWizard();
      } else if (str === 's') {
        await this.addSubStepWizard(currentQuest);
      } else if (str === 'm') {
        await this.addNoteWizard(currentQuest);
      } else if (str === 'e') {
        await this.editQuestWizard(currentQuest);
      } else if (str === 'r') {
        if (currentQuest && currentQuest.status === 'open') {
          const idx = RANK_KEYS.indexOf(currentQuest.rank);
          currentQuest.rank = RANK_KEYS[(idx + 1) % RANK_KEYS.length];
          this.save();
          this.setCombatBanner(
            `"Adjusted '${currentQuest.title}' priority rank to [${currentQuest.rank}-Rank]."`,
            'idle'
          );
          this.render();
        }
      } else if (str === 'o') {
        const modes = ['rank', 'hp', 'newest'];
        this.sortMode = modes[(modes.indexOf(this.sortMode) + 1) % modes.length];
        this.setCombatBanner(`"Sorted Quest Board by: ${this.sortMode.toUpperCase()}."`, 'idle');
        this.render();
      } else if (str === 'x') {
        if (currentQuest) {
          this.state.quests = this.state.quests.filter((q) => q.id !== currentQuest.id);
          this.save();
          this.setCombatBanner(`"Removed scroll '${currentQuest.title}' from the board."`, 'idle');
          this.render();
        }
      } else if (str === 'g') {
        this.guildSpeech = generateGuildmasterSpeech(this.state);
        this.render();
      } else if (str === 'l') {
        this.activeModal = 'relics';
        this.render();
      } else if (str === 't') {
        this.activeModal = 'themes';
        this.render();
      } else if (str === 'v') {
        this.activeModal = 'leave';
        this.render();
      } else if (str === '?') {
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

    if (this.activeModal === 'relics' && str === 'l') {
      this.activeModal = null;
      this.render();
      return;
    }

    if (this.activeModal === 'themes') {
      const themeList = Object.values(THEMES);
      if (str >= '1' && str <= String(themeList.length)) {
        const picked = themeList[parseInt(str, 10) - 1];
        const hero = this.state.hero;
        if (!hero.unlockedThemes) hero.unlockedThemes = ['parchment', 'arcane', 'emerald'];
        const isUnlocked = hero.unlockedThemes.includes(picked.id) || picked.cost === 0;

        if (isUnlocked) {
          hero.activeTheme = picked.id;
          this.save();
          this.setCombatBanner(`"Equipped visual theme: ${picked.name}!"`, 'hype');
          this.activeModal = null;
        } else if (hero.gold >= picked.cost) {
          hero.gold -= picked.cost;
          hero.unlockedThemes.push(picked.id);
          hero.activeTheme = picked.id;
          this.save();
          this.setCombatBanner(
            `"Purchased & equipped '${picked.name}' for ${picked.cost} Gold!"`,
            'hype'
          );
          this.activeModal = null;
        } else {
          this.setCombatBanner(
            `"Need ${picked.cost}g to unlock '${picked.name}' (You have ${hero.gold}g). Complete more quests!"`,
            'tease'
          );
          this.activeModal = null;
        }
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
        this.setCombatBanner(
          `"Welcome back from Tavern Leave! The Notice Board awaits your blade!"`,
          'hype'
        );
        this.render();
      } else if (presets[str]) {
        const days = presets[str];
        const until = scheduleTavernLeave(this.state, days);
        this.save();
        this.activeModal = null;
        this.setCombatBanner(
          `✦ Sanctuary Decree signed! Streak is protected for ${days} day(s) until ${until}. Enjoy your rest!`,
          'leave'
        );
        this.render();
      } else if (str === '5') {
        this.activeModal = null;
        await this.withPromptMode(async () => {
          const t = this.getTheme();
          console.log(`${t.borderBright}${ANSI.bold}═══ CUSTOM TAVERN LEAVE DURATION ═══${ANSI.reset}\n`);
          const daysStr = await promptLine(`  ${t.accent}How many days will you be away? (1-90)${ANSI.reset}`, '5');
          const days = Math.max(1, Math.min(90, parseInt(daysStr, 10) || 5));
          const until = scheduleTavernLeave(this.state, days);
          this.setCombatBanner(
            `✦ Sanctuary Decree signed! Streak is protected for ${days} days until ${until}.`,
            'leave'
          );
        });
      }
    }
  }
}

// ============================================================================
// 10. QUICK CLI COMMAND HANDLER (ONE-LINERS + HELP)
// ============================================================================

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    command: null,
    positional: [],
    vault: DEFAULT_VAULT_PATH,
    pass: process.env.QUEST_PASSPHRASE || null,
    rank: 'B',
    realm: 'Main Campaign',
    note: null,
    steps: null,
    active: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (a === '--vault' && args[i + 1]) {
      opts.vault = path.resolve(args[++i]);
    } else if (a === '--pass' && args[i + 1]) {
      opts.pass = args[++i];
    } else if (a === '--rank' && args[i + 1]) {
      opts.rank = args[++i].toUpperCase();
    } else if (a === '--realm' && args[i + 1]) {
      opts.realm = args[++i];
    } else if (a === '--note' && args[i + 1]) {
      opts.note = args[++i];
    } else if (a === '--steps' && args[i + 1]) {
      opts.steps = args[++i];
    } else if (a === '--active' || a === '-a') {
      opts.active = true;
    } else if (a === '--list' || a === 'list' || a === 'status') {
      opts.command = 'list';
    } else if (!opts.command && ['add', 'done', 'fate', 'leave'].includes(a)) {
      opts.command = a;
    } else {
      opts.positional.push(a);
    }
  }

  return opts;
}

function printCliHelp() {
  console.log(`
${fg256(220)}${ANSI.bold}⚔  AETHORIA GUILDHALL — ENCRYPTED TERMINAL QUEST BOARD  ⚔${ANSI.reset}

${fg256(214)}Interactive Full-Screen TUI:${ANSI.reset}
  node quest-board.js                  Launch the full-screen interactive Quest Board

${fg256(214)}Quick CLI One-Liner Commands:${ANSI.reset}
  node quest-board.js list             Print your Hero status, Active Pouch & Guild Board
  node quest-board.js add "<Title>"    Quickly post a quest from the terminal
    [--rank S|A|B|C|D]                 Priority rank (default: B)
    [--realm "<Group>"]                Realm / Group name (default: "Main Campaign")
    [--steps "Step 1,Step 2"]          Comma-separated sub-steps (Boss HP segments)
    [--note "<Details>"]               Initial field note / lore entry
    [--active]                         Place immediately into Today's Active Quest Pouch
  node quest-board.js done "<Search>"  Slay/complete a quest matching ID or title substring
  node quest-board.js fate             Roll the d20 of Fate for a 1.5x–2.0x Bounty quest
  node quest-board.js leave <days>     Set Planned Tavern Leave for <days> days (0 to resume)

${fg256(214)}Vault & Security Options:${ANSI.reset}
  --vault <path>                       Custom path for the AES-256-GCM encrypted JSON vault
  --pass <passphrase>                  Passphrase (or omit to be prompted with masked input)
`);
}

function printCliBoardSummary(state) {
  const hero = state.hero;
  const t = THEMES[hero.activeTheme] || THEMES.parchment;
  const xpReq = xpRequiredForLevel(hero.level);
  const speech = generateGuildmasterSpeech(state);

  console.log(`\n${t.borderBright}${ANSI.bold}╔══════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(
    `${t.borderBright}║${ANSI.reset} ⚔ ${t.accent}${ANSI.bold}${hero.name}${ANSI.reset} [Lv.${hero.level} ${getHeroTitle(hero.level)}] │ XP: ${hero.xp}/${xpReq} │ Gold: ${fg256(220)}${hero.gold}g${ANSI.reset} │ 🔥 Streak: ${hero.streak}d`
  );
  if (isOnTavernLeave(hero)) {
    console.log(`${t.borderBright}║${ANSI.reset} ${fg256(87)}🏕  ON TAVERN LEAVE UNTIL ${hero.leaveUntil} (Streak Protected)${ANSI.reset}`);
  }
  console.log(`${t.borderBright}║${ANSI.reset} ${t.muted}${speech.line}${ANSI.reset}`);
  console.log(`${t.borderBright}╚══════════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);

  const open = state.quests.filter((q) => q.status === 'open');
  const pouch = open.filter((q) => q.inPouch);
  const board = open.filter((q) => !q.inPouch);

  console.log(`\n${fg256(220)}${ANSI.bold}★ ACTIVE QUEST POUCH (Today's Picked Loadout: ${pouch.length})${ANSI.reset}`);
  if (pouch.length === 0) {
    console.log(`  ${t.muted}(Empty — launch TUI and press [Space] or run 'node quest-board.js fate')${ANSI.reset}`);
  } else {
    for (const q of pouch) {
      const rm = RANKS[q.rank] || RANKS.C;
      const hp = computeQuestHp(q);
      const bounty = q.bountyMultiplier > 1 ? ` ${fg256(213)}[🎲 ${q.bountyMultiplier}x Bounty]${ANSI.reset}` : '';
      console.log(`  ★ ${rm.badge} ${ANSI.bold}${q.title}${ANSI.reset} ${t.muted}[${q.realm}] (${hp.pct}% HP)${ANSI.reset}${bounty}`);
    }
  }

  console.log(`\n${t.accent}${ANSI.bold}📜 GUILD NOTICE BOARD (${board.length} Open)${ANSI.reset}`);
  for (const q of board) {
    const rm = RANKS[q.rank] || RANKS.C;
    const hp = computeQuestHp(q);
    console.log(`  · ${rm.badge} ${q.title} ${t.muted}[${q.realm}] (${hp.pct}% HP)${ANSI.reset}`);
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

  if (opts.command === 'list') {
    printCliBoardSummary(state);
    return;
  }

  if (opts.command === 'add') {
    const title = opts.positional.join(' ').trim();
    if (!title) {
      console.error(`${fg256(196)}Error: Please provide a quest title.${ANSI.reset}`);
      process.exit(1);
    }
    const rank = RANK_KEYS.includes(opts.rank) ? opts.rank : 'B';
    if (opts.realm && !state.realms.includes(opts.realm)) {
      state.realms.push(opts.realm);
    }
    const steps = opts.steps
      ? opts.steps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((text) => ({ text, done: false }))
      : [];
    const notes = opts.note ? [opts.note] : [];
    const q = {
      id: 'q-' + crypto.randomBytes(4).toString('hex'),
      title,
      rank,
      realm: opts.realm || 'Main Campaign',
      inPouch: Boolean(opts.active),
      status: 'open',
      bountyMultiplier: 1,
      bountyLabel: null,
      createdAt: new Date().toISOString(),
      notes,
      steps,
    };
    state.quests.unshift(q);
    saveVaultToFile(opts.vault, state, password);
    console.log(`${fg256(46)}✔ Posted [${rank}-Rank] Quest:${ANSI.reset} "${title}" in [${q.realm}]`);
    return;
  }

  if (opts.command === 'done') {
    const query = opts.positional.join(' ').toLowerCase();
    const target = state.quests.find(
      (q) =>
        q.status === 'open' &&
        (q.id.toLowerCase() === query || q.title.toLowerCase().includes(query))
    );
    if (!target) {
      console.error(`${fg256(196)}No open quest matching "${query}" found.${ANSI.reset}`);
      process.exit(1);
    }
    const res = completeQuest(state, target);
    saveVaultToFile(opts.vault, state, password);
    console.log(
      `${fg256(46)}🏆 QUEST SLAIN:${ANSI.reset} "${target.title}" -> +${res.finalXp} XP, +${res.finalGold} Gold!`
    );
    if (res.droppedRelic) {
      console.log(`${fg256(220)}🎁 Unearthed Relic: ${res.droppedRelic.name} (${res.droppedRelic.bonusText})${ANSI.reset}`);
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
    picked.bountyLabel =
      roll === 20 ? 'NAT 20 MYTHIC BOUNTY (2.0x)' : `d20=${roll} FATE BOUNTY (1.5x)`;
    saveVaultToFile(opts.vault, state, password);
    console.log(
      `${fg256(213)}🎲 Rolled d20 = [${roll}]!${ANSI.reset} Fate selected: "${picked.title}" (${picked.bountyLabel})`
    );
    return;
  }

  if (opts.command === 'leave') {
    const days = parseInt(opts.positional[0] || '3', 10);
    const until = scheduleTavernLeave(state, days);
    saveVaultToFile(opts.vault, state, password);
    if (until) {
      console.log(`${fg256(87)}🏕  Tavern Leave active for ${days} day(s) until ${until}. Streak protected!${ANSI.reset}`);
    } else {
      console.log(`${fg256(46)}⚔ Resumed active adventuring duty!${ANSI.reset}`);
    }
    return;
  }

  // Launch full-screen interactive TUI
  const tui = new QuestBoardTUI(opts.vault, state, password);
  tui.start();
}

main().catch((err) => {
  process.stdout.write(ANSI.showCursor + ANSI.altScreenOff);
  console.error(`${fg256(196)}Fatal Error:${ANSI.reset}`, err.message);
  process.exit(1);
});
