// RPG Progression, Quest Board, Repeating Daily Rituals ("Commissions"),
// Streak & Tavern Leave Engine, and v1->v2 Vault Migration.

import crypto from 'node:crypto';
import { activeSeason } from './seasons.js';
import { getBiome } from './biomes.js';

export const RANKS = {
  S: {
    rank: 'S',
    label: 'S-RANK',
    title: 'Mythic Calamity',
    xp: 150,
    gold: 50,
    lootChance: 0.65,
    order: 0,
    hex: '#ff3b5c',
  },
  A: {
    rank: 'A',
    label: 'A-RANK',
    title: 'Heroic Urgent',
    xp: 100,
    gold: 30,
    lootChance: 0.45,
    order: 1,
    hex: '#ff8c42',
  },
  B: {
    rank: 'B',
    label: 'B-RANK',
    title: 'Veteran Contract',
    xp: 60,
    gold: 20,
    lootChance: 0.30,
    order: 2,
    hex: '#ffd166',
  },
  C: {
    rank: 'C',
    label: 'C-RANK',
    title: 'Standard Posting',
    xp: 35,
    gold: 12,
    lootChance: 0.20,
    order: 3,
    hex: '#4cc9f0',
  },
  D: {
    rank: 'D',
    label: 'D-RANK',
    title: 'Quick Errand',
    xp: 20,
    gold: 6,
    lootChance: 0.12,
    order: 4,
    hex: '#80ed99',
  },
};

export const RANK_KEYS = ['S', 'A', 'B', 'C', 'D'];

export const CADENCES = {
  daily: { id: 'daily', label: 'Daily', short: 'DAILY', desc: 'Resets every morning' },
  weekdays: { id: 'weekdays', label: 'Weekdays (M-F)', short: 'M-F', desc: 'Active Monday through Friday' },
  weekends: { id: 'weekends', label: 'Weekends (Sat-Sun)', short: 'WKND', desc: 'Active Saturday & Sunday' },
  weekly: { id: 'weekly', label: 'Weekly', short: 'WEEKLY', desc: 'Once per week (resets Mondays)' },
  every3d: { id: 'every3d', label: 'Every 3 Days', short: '3-DAY', desc: 'Resets 3 days after completion' },
};

export const CADENCE_KEYS = ['daily', 'weekdays', 'weekends', 'weekly', 'every3d'];

export const RITUAL_PRESETS = [
  { title: 'Drink Water & Hydrate', targetCount: 8, cadence: 'daily', rank: 'C', realm: 'Homestead', note: '8 glasses a day keeps fatigue away.' },
  { title: 'Physical Workout / Movement', targetCount: 1, cadence: 'daily', rank: 'B', realm: 'Main Campaign', note: '30m of strength, cardio, or mobility.' },
  { title: '10-Minute Sanctum Tidy & Clean', targetCount: 1, cadence: 'daily', rank: 'C', realm: 'Homestead', note: 'Reset desk, dishes, and room.' },
  { title: 'Deep Focus / Skill Study', targetCount: 1, cadence: 'weekdays', rank: 'B', realm: 'Arcane Study', note: 'Focused learning without distractions.' },
  { title: '10,000 Steps / Outdoor Walk', targetCount: 1, cadence: 'daily', rank: 'B', realm: 'Main Campaign', note: 'Step outside for fresh air & sunlight.' },
  { title: 'Inbox Zero & Scroll Triage', targetCount: 1, cadence: 'weekdays', rank: 'C', realm: 'Craft & Code', note: 'Clear messages and plan tomorrow.' },
  { title: 'Meditation & Breathwork', targetCount: 1, cadence: 'daily', rank: 'D', realm: 'Homestead', note: '5–10 minutes of calm stillness.' },
  { title: 'Weekly Deep Clean & Laundry', targetCount: 1, cadence: 'weekends', rank: 'B', realm: 'Homestead', note: 'Refresh linens, floors, and supplies.' },
];

export const HERO_TITLES = [
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

export const RELIC_CATALOG = [
  {
    id: 'mug_of_roast',
    name: 'Bottomless Tankard of Dark Roast',
    rarity: 'Uncommon',
    art: '[c|_|]',
    lore: 'Brewed by Dwarven alchemists. Never cools, never empties.',
    bonusText: '+5% XP on all quests & rituals',
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
  // Seasonal Relics
  {
    id: 'frost_globe',
    name: 'Frostfall Snowglobe',
    rarity: 'Seasonal',
    seasonId: 'frostfall',
    art: ' (*o*)',
    lore: 'Swirls with perpetual winter magic from the Frostfall festival.',
    bonusText: '+10 Bonus XP on Winter quests',
  },
  {
    id: 'everbloom_sprig',
    name: 'Everbloom Blossom Sprig',
    rarity: 'Seasonal',
    seasonId: 'spring',
    art: ' --✿--',
    lore: 'Never wilts; reminds you that small daily tending yields wonders.',
    bonusText: '+5 Bonus XP on Daily Ritual completions',
  },
  {
    id: 'firefly_jar',
    name: 'Midsummer Firefly Lantern',
    rarity: 'Seasonal',
    seasonId: 'midsummer',
    art: ' [·*·]',
    lore: 'Captures the glow of warm solstice nights.',
    bonusText: '+10 Focus Round XP',
  },
  {
    id: 'harvest_lantern',
    name: 'Harvest Moon Pumpkin Charm',
    rarity: 'Seasonal',
    seasonId: 'harvest',
    art: ' (oVo)',
    lore: 'Carved during the Harvest Moon to attract bountiful rewards.',
    bonusText: '+5 Bonus Gold on Daily Commissions',
  },
];

// ============================================================================
// DATE, STREAK & TAVERN LEAVE LOGIC
// ============================================================================

export function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(date = new Date(), short = false) {
  return date.toLocaleDateString(
    'en-US',
    short
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  );
}

export function dateFromKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToDateKey(dateKey, days) {
  const dt = dateFromKey(dateKey);
  dt.setDate(dt.getDate() + days);
  return getLocalDateKey(dt);
}

export function daysBetweenDateKeys(keyA, keyB) {
  const t1 = dateFromKey(keyA).getTime();
  const t2 = dateFromKey(keyB).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function isOnTavernLeave(hero, dateKey = getLocalDateKey()) {
  if (!hero?.leaveUntil) return false;
  return dateKey <= hero.leaveUntil;
}

function getMondayKey(dateKey) {
  const dt = dateFromKey(dateKey);
  const day = dt.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return getLocalDateKey(dt);
}

// ============================================================================
// REPEATING ITEMS (DAILY RITUALS & RECURRING QUESTS)
// ============================================================================

export function createStarterRituals() {
  const now = new Date().toISOString();
  return [
    {
      id: 'rit-hydrate',
      title: 'Drink Water & Hydrate',
      cadence: 'daily',
      targetCount: 8,
      progressCount: 0,
      completedToday: false,
      lastCompletedDate: null,
      rank: 'C',
      realm: 'Homestead',
      streak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      createdAt: now,
      notes: ['8 glasses a day keeps fatigue away. Press [Space] or [c] to log each glass!'],
    },
    {
      id: 'rit-workout',
      title: 'Physical Workout / Movement',
      cadence: 'daily',
      targetCount: 1,
      progressCount: 0,
      completedToday: false,
      lastCompletedDate: null,
      rank: 'B',
      realm: 'Main Campaign',
      streak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      createdAt: now,
      notes: ['30 minutes of strength, cardio, or stretching.'],
    },
    {
      id: 'rit-tidy',
      title: '10-Minute Sanctum Tidy & Clean',
      cadence: 'daily',
      targetCount: 1,
      progressCount: 0,
      completedToday: false,
      lastCompletedDate: null,
      rank: 'C',
      realm: 'Homestead',
      streak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      createdAt: now,
      notes: ['Reset your desk, kitchen, or room before clutter builds.'],
    },
    {
      id: 'rit-study',
      title: 'Deep Focus / Skill Study',
      cadence: 'weekdays',
      targetCount: 1,
      progressCount: 0,
      completedToday: false,
      lastCompletedDate: null,
      rank: 'B',
      realm: 'Arcane Study',
      streak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      createdAt: now,
      notes: ['Read, practice, or study without distractions.'],
    },
  ];
}

export function isRitualDueToday(ritual, date = new Date()) {
  const cadence = ritual.cadence || 'daily';
  const dow = date.getDay(); // 0=Sun..6=Sat
  const todayKey = getLocalDateKey(date);

  if (cadence === 'daily') return true;
  if (cadence === 'weekdays') return dow >= 1 && dow <= 5;
  if (cadence === 'weekends') return dow === 0 || dow === 6;
  if (cadence === 'weekly') {
    if (!ritual.lastCompletedDate) return true;
    return getMondayKey(ritual.lastCompletedDate) !== getMondayKey(todayKey);
  }
  if (cadence === 'every3d') {
    if (!ritual.lastCompletedDate) return true;
    return daysBetweenDateKeys(ritual.lastCompletedDate, todayKey) >= 3;
  }
  return true;
}

export function getRitualMastery(streak = 0) {
  if (streak >= 30) return { label: 'Mythic', badge: '✦', mult: 1.6, hex: '#ff006e' };
  if (streak >= 14) return { label: 'Gold', badge: '★★★', mult: 1.4, hex: '#ffd700' };
  if (streak >= 7) return { label: 'Silver', badge: '★★', mult: 1.25, hex: '#e0fbfc' };
  if (streak >= 3) return { label: 'Bronze', badge: '★', mult: 1.1, hex: '#cd7f32' };
  return { label: 'Novice', badge: '○', mult: 1.0, hex: '#8d99ae' };
}

export function renderChargeBar(progressCount, targetCount, maxPips = 10) {
  const target = Math.max(1, targetCount || 1);
  const done = Math.max(0, Math.min(target, progressCount || 0));
  if (target === 1) {
    return done >= 1 ? '[✔] 1/1' : '[○] 0/1';
  }
  if (target <= maxPips) {
    return `[${'♦'.repeat(done)}${'○'.repeat(target - done)}] ${done}/${target}`;
  }
  const filled = Math.round((done / target) * maxPips);
  return `[${'♦'.repeat(filled)}${'○'.repeat(maxPips - filled)}] ${done}/${target}`;
}

export function getCommissionStatus(state, date = new Date()) {
  const due = (state.rituals || []).filter((r) => isRitualDueToday(r, date) || r.completedToday);
  const completedDue = due.filter((r) => r.completedToday).length;
  const target = due.length === 0 ? 0 : Math.min(4, due.length);
  return {
    dueCount: due.length,
    completedCount: completedDue,
    target,
    claimed: Boolean(state.hero?.commissionChestClaimedToday),
  };
}

function advanceHeroStreakOnActivity(state, today = getLocalDateKey()) {
  const hero = state.hero;
  if (hero.lastActiveDate !== today) {
    const gap = hero.lastActiveDate ? daysBetweenDateKeys(hero.lastActiveDate, today) : 1;
    if (gap === 1) {
      hero.streak = (hero.streak || 0) + 1;
    } else if (gap > 1) {
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
}

export function strikeRitual(state, ritual, date = new Date()) {
  if (!ritual) return null;
  const target = Math.max(1, ritual.targetCount || 1);
  if (ritual.completedToday) {
    return { alreadyDone: true, progressCount: target, targetCount: target };
  }

  ritual.progressCount = (ritual.progressCount || 0) + 1;

  // Partial step on multi-charge ritual (e.g., glass 3 of 8)
  if (ritual.progressCount < target) {
    const chip = awardXpAndGold(state, 6, 2);
    return {
      completed: false,
      progressCount: ritual.progressCount,
      targetCount: target,
      finalXp: chip.finalXp,
      finalGold: chip.finalGold,
      leveledUp: chip.leveledUp,
      newLevel: chip.newLevel,
    };
  }

  // Ritual fully completed for today!
  const today = getLocalDateKey(date);
  ritual.progressCount = target;
  ritual.completedToday = true;
  ritual.lastCompletedDate = today;
  ritual.streak = (ritual.streak || 0) + 1;
  if (ritual.streak > (ritual.bestStreak || 0)) ritual.bestStreak = ritual.streak;
  ritual.totalCompletions = (ritual.totalCompletions || 0) + 1;

  advanceHeroStreakOnActivity(state, today);
  state.hero.completedToday = (state.hero.completedToday || 0) + 1;
  state.hero.totalCompleted = (state.hero.totalCompleted || 0) + 1;

  const rankMeta = RANKS[ritual.rank] || RANKS.C;
  const mastery = getRitualMastery(ritual.streak);
  let baseXp = Math.round(rankMeta.xp * 0.75 * mastery.mult);
  let baseGold = Math.round(rankMeta.gold * 0.75 * mastery.mult);

  if (hasRelic(state.hero, 'everbloom_sprig')) baseXp += 5;
  if (hasRelic(state.hero, 'owl_monocle')) baseGold += 5;

  // Check Daily Commission Supply Chest
  let chestOpened = false;
  let chestDrop = null;
  const comm = getCommissionStatus(state, date);
  if (comm.target > 0 && comm.completedCount >= comm.target && !state.hero.commissionChestClaimedToday) {
    state.hero.commissionChestClaimedToday = true;
    chestOpened = true;
    baseXp += 60;
    baseGold += 30 + (hasRelic(state.hero, 'harvest_lantern') ? 5 : 0);
    chestDrop = rollForLootDrop(state, { rank: 'A', bountyMultiplier: 1.5 }, false, date);
  }

  const reward = awardXpAndGold(state, baseXp, baseGold, date);
  return {
    completed: true,
    progressCount: target,
    targetCount: target,
    mastery,
    chestOpened,
    chestDrop,
    ...reward,
  };
}

export function resetRitualProgress(ritual) {
  if (!ritual) return;
  ritual.progressCount = 0;
  ritual.completedToday = false;
}

export function cycleQuestRecurrence(quest) {
  const order = [null, 'daily', 'weekdays', 'weekends', 'weekly', 'every3d'];
  const idx = order.indexOf(quest.recurrence || null);
  quest.recurrence = order[(idx + 1) % order.length];
  return quest.recurrence;
}

// ============================================================================
// DAILY RECONCILIATION & V1->V2 MIGRATION
// ============================================================================

const LEGACY_THEME_MAP = {
  parchment: 'tavern',
  arcane: 'neon',
  emerald: 'cottage',
  dragonfire: 'tavern',
  frostwarden: 'pirate',
  runeforge: 'crt',
};

export function migrateState(state) {
  if (!state.hero) state.hero = {};
  const hero = state.hero;

  if (!hero.activeBiome) {
    hero.activeBiome = LEGACY_THEME_MAP[hero.activeTheme] || 'tavern';
  }
  if (!Array.isArray(hero.unlockedBiomes)) {
    hero.unlockedBiomes = ['tavern', 'crt'];
  }
  if (!hero.settings) {
    hero.settings = { animations: true, lighting: true };
  }
  if (!hero.layout) hero.layout = 'classic';
  if (!Array.isArray(hero.protectedDates)) hero.protectedDates = [];
  if (!Array.isArray(hero.relics)) hero.relics = ['mug_of_roast'];
  if (hero.fateRolls === undefined) hero.fateRolls = 0;
  if (hero.commissionChestClaimedToday === undefined) hero.commissionChestClaimedToday = false;

  if (!Array.isArray(state.realms) || state.realms.length === 0) {
    state.realms = ['Main Campaign', 'Craft & Code', 'Arcane Study', 'Homestead', 'Side Bounties'];
  }
  if (!Array.isArray(state.quests)) state.quests = [];
  for (const q of state.quests) {
    if (q.recurrence === undefined) q.recurrence = null;
    if (!Array.isArray(q.combatLog)) q.combatLog = [];
    if (!Array.isArray(q.steps)) q.steps = [];
    if (!Array.isArray(q.notes)) q.notes = [];
  }

  if (!Array.isArray(state.rituals)) {
    state.rituals = createStarterRituals();
  }

  state.version = 2;
  return state;
}

function shouldQuestRespawnToday(quest, todayKey) {
  if (!quest.recurrence || quest.status !== 'done') return false;
  const doneKey = quest.completedAt ? getLocalDateKey(new Date(quest.completedAt)) : null;
  if (!doneKey || doneKey === todayKey) return false;

  const dt = dateFromKey(todayKey);
  const dow = dt.getDay();
  if (quest.recurrence === 'daily') return true;
  if (quest.recurrence === 'weekdays') return dow >= 1 && dow <= 5;
  if (quest.recurrence === 'weekends') return dow === 0 || dow === 6;
  if (quest.recurrence === 'weekly') return getMondayKey(doneKey) !== getMondayKey(todayKey);
  if (quest.recurrence === 'every3d') return daysBetweenDateKeys(doneKey, todayKey) >= 3;
  return false;
}

export function reconcileDailyState(state, now = new Date()) {
  migrateState(state);
  const today = getLocalDateKey(now);
  const hero = state.hero;

  if (hero.leaveUntil && today > hero.leaveUntil) {
    hero.leaveUntil = null;
  }

  if (hero.lastDayChecked !== today) {
    if (hero.lastActiveDate && hero.lastActiveDate !== today) {
      const gap = daysBetweenDateKeys(hero.lastActiveDate, today);
      if (gap > 1) {
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
      hero.commissionChestClaimedToday = false;

      // Reset daily/repeating rituals for the new day
      for (const r of state.rituals) {
        if (r.lastCompletedDate) {
          const gap = daysBetweenDateKeys(r.lastCompletedDate, today);
          if (r.cadence === 'daily' && gap > 1) {
            // Check Tavern Leave protection for ritual streaks too
            let protectedGap = true;
            for (let i = 1; i < gap; i++) {
              const dKey = addDaysToDateKey(r.lastCompletedDate, i);
              if (!hero.protectedDates.includes(dKey) && !(hero.leaveUntil && dKey <= hero.leaveUntil)) {
                protectedGap = false;
                break;
              }
            }
            if (!protectedGap) r.streak = 0;
          }
        }
        // Reset daily checkoff (weekly rituals stay marked done until next Monday)
        if (r.cadence === 'weekly') {
          r.completedToday = Boolean(r.lastCompletedDate && getMondayKey(r.lastCompletedDate) === getMondayKey(today));
          if (!r.completedToday) r.progressCount = 0;
        } else {
          r.completedToday = false;
          r.progressCount = 0;
        }
      }

      // Respawn any recurring board quests whose cadence elapsed
      for (const q of state.quests) {
        if (shouldQuestRespawnToday(q, today)) {
          q.status = 'open';
          q.completedAt = null;
          q.directDamage = 0;
          q.bountyMultiplier = 1;
          q.bountyLabel = null;
          if (Array.isArray(q.steps)) q.steps.forEach((s) => (s.done = false));
        }
      }
    }

    hero.lastDayChecked = today;
  }
}

export function scheduleTavernLeave(state, numDays, reason = 'Planned Expedition / Rest') {
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
  if (hero.protectedDates.length > 180) {
    hero.protectedDates = hero.protectedDates.slice(-180);
  }
  return untilKey;
}

// ============================================================================
// INITIAL DEFAULT STATE
// ============================================================================

export function createInitialState(heroName = 'Wayfarer') {
  const now = new Date().toISOString();
  const today = getLocalDateKey();
  return {
    version: 2,
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
      commissionChestClaimedToday: false,
      totalCompleted: 0,
      critsLanded: 0,
      fateRolls: 0,
      leaveUntil: null,
      leaveReason: null,
      protectedDates: [],
      relics: ['mug_of_roast'],
      unlockedBiomes: ['tavern', 'crt'],
      activeBiome: 'tavern',
      layout: 'classic',
      settings: { animations: true, lighting: true },
    },
    realms: ['Main Campaign', 'Craft & Code', 'Arcane Study', 'Homestead', 'Side Bounties'],
    rituals: createStarterRituals(),
    quests: [
      {
        id: 'q-starter-1',
        title: "Inspect the Guild Notice Board & Embark on Today's Run",
        rank: 'B',
        realm: 'Main Campaign',
        inPouch: true,
        status: 'open',
        recurrence: null,
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'Welcome to Quest Board v2! Switch layouts anytime with [F1] Board, [F2] War Table, [F3] Battle Arena.',
          'Press [y] to open your Daily Rituals (water, workout, cleaning) and build mastery chains!',
        ],
        steps: [
          { text: 'Strike this first sub-step by pressing [1]', done: false },
          { text: 'Try Battle Arena focus mode by pressing [F3]', done: false },
          { text: 'Press [c] to Slay & Complete this quest for XP and Gold!', done: false },
        ],
        combatLog: [],
      },
      {
        id: 'q-starter-2',
        title: 'Conquer the High-Priority Boss Task of the Week',
        rank: 'S',
        realm: 'Craft & Code',
        inPouch: true,
        status: 'open',
        recurrence: null,
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'S-Rank quests represent your highest-impact, most intimidating tasks.',
          'Enter the Battle Arena ([F3] or [Enter]) to fight it in timed Pomodoro rounds!',
        ],
        steps: [
          { text: 'Outline the core architecture or plan', done: true },
          { text: 'Execute the main implementation', done: false },
          { text: 'Verify and ship the final milestone', done: false },
        ],
        combatLog: [],
      },
      {
        id: 'q-starter-3',
        title: 'Organize Workspace & Clear Arcane Clutter',
        rank: 'C',
        realm: 'Homestead',
        inPouch: false,
        status: 'open',
        recurrence: 'weekly',
        bountyMultiplier: 1,
        bountyLabel: null,
        createdAt: now,
        notes: [
          'Marked as [WEEKLY] repeating! When slain, it automatically returns next week.',
          'Press [Space] when you are ready to pull this quest into today\'s Active Pouch.',
        ],
        steps: [
          { text: 'Clear desktop & close stale tabs', done: false },
          { text: 'Write down 2 new quests with [n]', done: false },
        ],
        combatLog: [],
      },
    ],
  };
}

// ============================================================================
// RPG PROGRESSION, REWARDS & NPC DIALOGUE
// ============================================================================

export function xpRequiredForLevel(level) {
  return Math.floor(120 * Math.pow(level, 1.35));
}

export function getHeroTitle(level) {
  let current = HERO_TITLES[0].title;
  for (const t of HERO_TITLES) {
    if (level >= t.level) current = t.title;
  }
  return current;
}

export function computeQuestHp(quest) {
  if (!quest) return { current: 100, max: 100, pct: 100, doneCount: 0, totalCount: 0 };
  if (quest.status === 'done') {
    const total = Math.max(1, (quest.steps || []).length) * 100;
    return { current: 0, max: total, pct: 0, doneCount: (quest.steps || []).length, totalCount: (quest.steps || []).length };
  }
  const steps = quest.steps || [];
  if (steps.length === 0) {
    const rankHp = { S: 500, A: 350, B: 200, C: 120, D: 60 }[quest.rank] || 150;
    const dmg = Math.min(rankHp, quest.directDamage || 0);
    const current = Math.max(0, rankHp - dmg);
    return { current, max: rankHp, pct: Math.round((current / rankHp) * 100), doneCount: 0, totalCount: 0 };
  }
  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const max = totalCount * 100;
  const current = Math.max(0, (totalCount - doneCount) * 100);
  const pct = Math.round((current / max) * 100);
  return { current, max, pct, doneCount, totalCount };
}

export function hasRelic(hero, relicId) {
  return Array.isArray(hero?.relics) && hero.relics.includes(relicId);
}

export function awardXpAndGold(state, rawXp, rawGold, date = new Date()) {
  const hero = state.hero;
  let xpMult = 1.0;
  let goldMult = 1.0;

  if (hasRelic(hero, 'mug_of_roast')) xpMult += 0.05;
  if (hasRelic(hero, 'dragonscale_seal')) {
    xpMult += 0.10;
    goldMult += 0.10;
  }
  const season = activeSeason(date);
  if (season) {
    xpMult += season.xpMult || 0;
    goldMult += season.goldMult || 0;
  }
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

export function rollForLootDrop(state, quest, forceGuaranteed = false, date = new Date()) {
  const hero = state.hero;
  const rankMeta = RANKS[quest.rank] || RANKS.C;
  const season = activeSeason(date);

  // Filter eligible unowned relics (seasonal relics only drop during their season)
  const unowned = RELIC_CATALOG.filter((r) => {
    if (hero.relics.includes(r.id)) return false;
    if (r.seasonId && (!season || season.id !== r.seasonId)) return false;
    return true;
  });
  if (unowned.length === 0) return null;

  const chance = forceGuaranteed
    ? 1.0
    : rankMeta.lootChance * (quest.bountyMultiplier > 1 ? 1.35 : 1.0);

  if (Math.random() <= chance) {
    // Slightly favor active seasonal relic when in season
    const seasonalMatch = season ? unowned.find((r) => r.seasonId === season.id) : null;
    const picked =
      seasonalMatch && Math.random() < 0.5
        ? seasonalMatch
        : unowned[Math.floor(Math.random() * unowned.length)];
    hero.relics.push(picked.id);
    return picked;
  }
  return null;
}

export function completeQuest(state, quest, date = new Date()) {
  if (!quest || quest.status === 'done') return null;

  quest.status = 'done';
  quest.completedAt = date.toISOString();
  quest.timesCompleted = (quest.timesCompleted || 0) + 1;
  if (Array.isArray(quest.steps)) {
    quest.steps.forEach((s) => (s.done = true));
  }

  const hero = state.hero;
  const today = getLocalDateKey(date);
  advanceHeroStreakOnActivity(state, today);

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
  const season = activeSeason(date);
  if (season?.id === 'frostfall' && hasRelic(hero, 'frost_globe')) {
    baseXp += 10;
  }

  const remainingPouch = state.quests.filter((q) => q.status === 'open' && q.inPouch);
  let fullClearTriggered = false;
  if (quest.inPouch && remainingPouch.length === 0 && !hero.pouchClearedToday) {
    hero.pouchClearedToday = true;
    fullClearTriggered = true;
    baseXp += 75 + (hasRelic(hero, 'lantern_of_dawn') ? 20 : 0);
    baseGold += 25 + (hasRelic(hero, 'coin_of_fortune') ? 10 : 0);
  }

  quest.inPouch = false;

  const reward = awardXpAndGold(state, baseXp, baseGold, date);
  const droppedRelic = rollForLootDrop(state, quest, quest.bountyMultiplier >= 2, date);

  return {
    ...reward,
    fullClearTriggered,
    droppedRelic,
    rankMeta,
  };
}

export function getDustyRealms(state, thresholdDays = 7, now = new Date()) {
  const cutoffMs = thresholdDays * 24 * 60 * 60 * 1000;
  const dusty = new Set();
  for (const r of state.realms || []) {
    const realmQuests = state.quests.filter((q) => q.realm === r && q.status === 'open');
    if (realmQuests.length === 0) continue;
    const newestActivity = Math.max(
      ...realmQuests.map((q) => new Date(q.createdAt || 0).getTime())
    );
    if (now.getTime() - newestActivity > cutoffMs) {
      dusty.add(r);
    }
  }
  return dusty;
}

export function generateGuildmasterSpeech(state, now = new Date()) {
  const hero = state.hero;
  const biome = getBiome(state);
  const v = biome.vocab;
  const openQuests = state.quests.filter((q) => q.status === 'open');
  const pouchQuests = openQuests.filter((q) => q.inPouch);
  const comm = getCommissionStatus(state, now);

  if (isOnTavernLeave(hero, getLocalDateKey(now))) {
    return {
      mood: 'leave',
      line: `"Enjoy your Leave until ${hero.leaveUntil}, ${hero.name}! Your ${hero.streak}-day streak is under my personal guard."`,
    };
  }

  if (hero.pouchClearedToday) {
    return {
      mood: 'hype',
      line: `"UNREAL! You cleared your entire ${v.pouch} today! Check [y] ${v.rituals} or rest by the hearth!"`,
    };
  }

  if (comm.target > 0 && comm.completedCount < comm.target && Math.random() < 0.3) {
    return {
      mood: 'idle',
      line: `"${comm.completedCount}/${comm.target} ${v.rituals} done today—finish ${comm.target} to crack open the Daily Commission Chest!"`,
    };
  }

  if (pouchQuests.length === 0 && openQuests.length > 0) {
    return {
      mood: 'tease',
      line: `"Your ${v.pouch} is empty! Pick ${v.quests.toLowerCase()} with [Space], or press [d] for ${v.fate}!"`,
    };
  }

  const dusty = Array.from(getDustyRealms(state, 7, now));
  if (dusty.length > 0 && Math.random() < 0.35) {
    return {
      mood: 'tease',
      line: `"${dusty[0]} is gathering dust... Switch to [2] War Table to triage your ${v.realms || v.realm}s!"`,
    };
  }

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Morning lamps are lit!' : hour < 18 ? 'The afternoon forge is hot!' : 'Burning the midnight oil, eh?';

  return {
    mood: 'idle',
    line: `"${greeting} ${pouchQuests.length} in ${v.pouch}, ${comm.completedCount}/${comm.target} ${v.rituals}, ${hero.streak}d streak."`,
  };
}
