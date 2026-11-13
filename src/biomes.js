// Biomes & Dynamic Theme Modifiers:
// Each biome transforms the palette, box style, vocabulary, NPC persona,
// progress metaphor (HP vs Botanical Growth), and ambient particle effects.
// Dynamic layers: Time-of-day lighting, Seasonal calendar tint, and Streak Heat borders.

import { mix, lighten, darken } from './color.js';
import { activeSeason } from './seasons.js';

export const BIOMES = {
  tavern: {
    id: 'tavern',
    name: 'Tavern Hearth',
    desc: 'Warm hearth-fire amber, aged oak parchment & Guildmaster Garrick.',
    cost: 0,
    deedDesc: 'Starter Biome',
    boxKind: 'double',
    progressMode: 'hp',
    ambient: 'embers',
    npcName: 'Guildmaster Garrick',
    npcMoods: {
      idle: ' (o_O)9 ',
      hype: '\\(^o^)/ ',
      crit: ' (>_<)+ ',
      fate: ' (*_*)♦ ',
      leave: ' (-_-)~ ',
      tease: ' (¬_¬)! ',
    },
    vocab: {
      title: 'AETHORIA GUILDHALL',
      quest: 'Quest',
      quests: 'Quests',
      currency: 'Gold',
      currencyShort: 'g',
      realm: 'Realm',
      pouch: 'Active Pouch',
      ritual: 'Daily Ritual',
      rituals: 'Daily Rituals',
      fate: 'Roll d20 of Fate',
      slay: 'Slay',
      archive: 'Hall of Legends',
    },
    palette: {
      bg: '#16110e',
      panelBg: '#1c1512',
      headerBg: '#4a1818',
      headerFg: '#ffd97d',
      border: '#b5843a',
      borderBright: '#f4c55b',
      accent: '#f09d38',
      accent2: '#d4a373',
      text: '#f5ead6',
      muted: '#9b8b7a',
      highlightBg: '#2e231c',
      pouchAccent: '#ffd166',
      hpFull: '#e63946',
      hpMid: '#f4a261',
      hpLow: '#52b788',
      xpBar: '#4cc9f0',
      gold: '#ffd166',
      ritual: '#90be6d',
    },
  },
  neon: {
    id: 'neon',
    name: 'Neon Syndicate',
    desc: 'Cyberpunk rain, holographic cyan & Fixer AI NYX.',
    cost: 50,
    deedDesc: 'Unlock with 50¢ or land 5 Critical Hits',
    boxKind: 'heavy',
    progressMode: 'hp',
    ambient: 'matrix',
    npcName: 'NYX // Fixer AI',
    npcMoods: {
      idle: ' [◉_◉]  ',
      hype: ' [^‿^]⚡ ',
      crit: ' [×_×]⚔ ',
      fate: ' [◈_◈]♦ ',
      leave: ' [-_-]zZ',
      tease: ' [ಠ_ಠ]!',
    },
    vocab: {
      title: 'NEON SYNDICATE // NODE-09',
      quest: 'Gig',
      quests: 'Contracts',
      currency: 'Creds',
      currencyShort: '¢',
      realm: 'District',
      pouch: 'Active Deck',
      ritual: 'Cron Daemon',
      rituals: 'Daily Daemons',
      fate: 'Glitch Roll',
      slay: 'Flatline',
      archive: 'Cold Storage',
    },
    palette: {
      bg: '#0a0b16',
      panelBg: '#101224',
      headerBg: '#2a0845',
      headerFg: '#ff70f0',
      border: '#7b2cbf',
      borderBright: '#00f5d4',
      accent: '#00bbf9',
      accent2: '#f15bb5',
      text: '#e9ecff',
      muted: '#7a82ab',
      highlightBg: '#1b1f3b',
      pouchAccent: '#00f5d4',
      hpFull: '#ff006e',
      hpMid: '#ffbe0b',
      hpLow: '#00f5d4',
      xpBar: '#f15bb5',
      gold: '#fee440',
      ritual: '#00f5d4',
    },
  },
  cottage: {
    id: 'cottage',
    name: 'Cozy Cottage',
    desc: 'Sunlit meadow, Granny Owl & tasks that sprout and bloom.',
    cost: 50,
    deedDesc: 'Unlock with 50ac or complete 5 Tasks',
    boxKind: 'round',
    progressMode: 'bloom',
    ambient: 'petals',
    npcName: 'Granny Owl',
    npcMoods: {
      idle: ' (ovo)  ',
      hype: ' (^v^)✿ ',
      crit: ' (O_O)* ',
      fate: ' (*v*)♦ ',
      leave: ' (-v-)☕',
      tease: ' (òvó)! ',
    },
    vocab: {
      title: 'SUNMEADOW COTTAGE',
      quest: 'Tending',
      quests: 'Garden Tasks',
      currency: 'Acorns',
      currencyShort: 'ac',
      realm: 'Garden Plot',
      pouch: 'Harvest Basket',
      ritual: 'Morning Chore',
      rituals: 'Daily Tending',
      fate: 'Wishing Acorn',
      slay: 'Harvest',
      archive: 'Pressed Herbarium',
    },
    palette: {
      bg: '#131914',
      panelBg: '#1a221b',
      headerBg: '#2d4a2b',
      headerFg: '#fefae0',
      border: '#6b9080',
      borderBright: '#a4c3b2',
      accent: '#b5e48c',
      accent2: '#ffcad4',
      text: '#f2f7ec',
      muted: '#8da38e',
      highlightBg: '#253327',
      pouchAccent: '#ffe5a3',
      hpFull: '#e5989b',
      hpMid: '#f6bd60',
      hpLow: '#95d5b2',
      xpBar: '#a9def9',
      gold: '#ffd166',
      ritual: '#b5e48c',
    },
  },
  pirate: {
    id: 'pirate',
    name: 'Pirate Cove',
    desc: 'Ocean swells, sea-salt gold & Captain Polly the Parrot.',
    cost: 75,
    deedDesc: 'Unlock with 75db or roll Fate 3 times',
    boxKind: 'double',
    progressMode: 'hp',
    ambient: 'waves',
    npcName: 'Captain Polly',
    npcMoods: {
      idle: ' <o)<   ',
      hype: ' <^)< ♪ ',
      crit: ' <X)< ⚔ ',
      fate: ' <*>♦   ',
      leave: ' <->~   ',
      tease: ' <!))Squawk',
    },
    vocab: {
      title: 'BLACKTIDE COVE',
      quest: 'Bounty',
      quests: 'Bounties',
      currency: 'Doubloons',
      currencyShort: 'db',
      realm: 'Waters',
      pouch: "Captain's Log",
      ritual: "Ship's Watch",
      rituals: "Ship's Rations",
      fate: 'Roll the Bones',
      slay: 'Plunder',
      archive: 'Sunken Vault',
    },
    palette: {
      bg: '#0c161d',
      panelBg: '#11202b',
      headerBg: '#153243',
      headerFg: '#ffd166',
      border: '#2a9d8f',
      borderBright: '#ffd166',
      accent: '#48cae4',
      accent2: '#f4a261',
      text: '#edf6f9',
      muted: '#7f9aa6',
      highlightBg: '#1a3242',
      pouchAccent: '#ffd166',
      hpFull: '#e76f51',
      hpMid: '#f4a261',
      hpLow: '#2ec4b6',
      xpBar: '#48cae4',
      gold: '#ffd166',
      ritual: '#2ec4b6',
    },
  },
  crt: {
    id: 'crt',
    name: 'Phosphor CRT',
    desc: 'Zero-distraction monochrome green focus terminal.',
    cost: 0,
    deedDesc: 'Always Unlocked (Focus Mode)',
    boxKind: 'single',
    progressMode: 'hp',
    ambient: 'none',
    npcName: 'SYS.MON',
    npcMoods: {
      idle: ' [OK]   ',
      hype: ' [ACK]  ',
      crit: ' [HIT!] ',
      fate: ' [RNG]  ',
      leave: ' [IDLE] ',
      tease: ' [WARN] ',
    },
    vocab: {
      title: 'QUEST-OS v2.0 // FOCUS TTY',
      quest: 'Task',
      quests: 'Tasks',
      currency: 'Points',
      currencyShort: 'pt',
      realm: 'Group',
      pouch: 'Active Queue',
      ritual: 'Routine',
      rituals: 'Daily Routines',
      fate: 'Random Pick',
      slay: 'Complete',
      archive: 'Completed Log',
    },
    palette: {
      bg: '#050b05',
      panelBg: '#081208',
      headerBg: '#0f290f',
      headerFg: '#6bff6b',
      border: '#2d7a2d',
      borderBright: '#5cff5c',
      accent: '#5cff5c',
      accent2: '#3ec73e',
      text: '#c8ffc8',
      muted: '#4d8a4d',
      highlightBg: '#102610',
      pouchAccent: '#8aff8a',
      hpFull: '#5cff5c',
      hpMid: '#3ec73e',
      hpLow: '#8aff8a',
      xpBar: '#5cff5c',
      gold: '#8aff8a',
      ritual: '#5cff5c',
    },
  },
};

export const BIOME_LIST = Object.values(BIOMES);

export function getBiome(state) {
  const id = state?.hero?.activeBiome || 'tavern';
  return BIOMES[id] || BIOMES.tavern;
}

export function isBiomeUnlocked(hero, biome) {
  if (!biome) return false;
  if (biome.cost === 0) return true;
  if (Array.isArray(hero.unlockedBiomes) && hero.unlockedBiomes.includes(biome.id)) {
    return true;
  }
  if (biome.id === 'neon' && (hero.critsLanded || 0) >= 5) return true;
  if (biome.id === 'cottage' && (hero.totalCompleted || 0) >= 5) return true;
  if (biome.id === 'pirate' && (hero.fateRolls || 0) >= 3) return true;
  return false;
}

export function getTimeOfDayPhase(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 8) return { name: 'Dawn', tint: '#ff9e7d', amount: 0.14 };
  if (h >= 8 && h < 17) return { name: 'Daylight', tint: '#fff3d6', amount: 0.05 };
  if (h >= 17 && h < 20) return { name: 'Dusk', tint: '#b56576', amount: 0.16 };
  return { name: 'Starlight', tint: '#1b263b', amount: 0.18 };
}

export function resolvePalette(state, date = new Date(), tick = 0) {
  const biome = getBiome(state);
  const base = { ...biome.palette };
  const settings = state?.hero?.settings || {};

  // CRT focus mode stays crisp monochrome without tint washes.
  if (biome.id !== 'crt') {
    if (settings.lighting !== false) {
      const tod = getTimeOfDayPhase(date);
      base.bg = mix(base.bg, tod.tint, tod.amount * 0.6);
      base.panelBg = mix(base.panelBg, tod.tint, tod.amount * 0.45);
      base.border = mix(base.border, tod.tint, tod.amount * 0.5);
    }

    const season = activeSeason(date);
    if (season) {
      base.borderBright = mix(base.borderBright, season.tint, season.amount * 1.4);
      base.accent2 = mix(base.accent2, season.tint, season.amount);
      base.bg = mix(base.bg, season.tint, season.amount * 0.25);
    }
  }

  return {
    ...base,
    tick,
    season: activeSeason(date),
    tod: getTimeOfDayPhase(date),
  };
}

export function getStreakHeatTier(streak = 0) {
  if (streak >= 14) return { label: 'MYTHIC FLAME', color: '#ff5400', alt: '#ffbd00', shimmer: true };
  if (streak >= 7) return { label: 'SOLAR GOLD', color: '#ffd700', alt: '#ffe566', shimmer: false };
  if (streak >= 3) return { label: 'TEMPERED BRONZE', color: '#cd7f32', alt: '#e09f5a', shimmer: false };
  return { label: 'COLD IRON', color: null, alt: null, shimmer: false };
}

export function streakHeatStyle(streak, palette, x = 0, y = 0, tick = 0) {
  const tier = getStreakHeatTier(streak);
  if (!tier.color) {
    return { fg: palette.border, bg: palette.bg };
  }
  if (!tier.shimmer) {
    return { fg: mix(palette.border, tier.color, 0.72), bg: palette.bg };
  }
  // Animated flame shimmer along the outer border for 14+ day streaks
  const wave = Math.sin((x * 0.35 + y * 0.65) - tick * 0.6);
  const c = wave > 0.35 ? tier.alt : wave < -0.35 ? '#ff006e' : tier.color;
  return { fg: c, bg: palette.bg, bold: wave > 0.5 };
}

// Deterministic hash for background ambient particles
function cellNoise(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

export function renderAmbientParticles(screen, state, palette, tick = 0) {
  const settings = state?.hero?.settings || {};
  if (settings.animations === false) return;

  const biome = getBiome(state);
  const season = palette.season;
  const mode = season && biome.id !== 'crt' ? season.overlay : biome.ambient;
  if (!mode || mode === 'none') return;

  const w = screen.w;
  const h = screen.h;
  const step = Math.floor(tick);

  for (let y = 1; y < h - 2; y++) {
    for (let x = 1; x < w - 1; x++) {
      const cell = screen.cell(x, y);
      if (!cell || cell.solid) continue;

      if (mode === 'embers' || mode === 'fireflies') {
        const driftY = (y + step) % 1000;
        const n = cellNoise(x, driftY, mode === 'embers' ? 7 : 19);
        if (n > 0.991) {
          const ch = mode === 'embers' ? (n > 0.996 ? '✦' : '·') : n > 0.996 ? '*' : '·';
          const fg = mode === 'embers' ? (n > 0.996 ? '#ff9e00' : '#ff5400') : '#ffd166';
          screen.set(x, y, ch, { fg, bg: cell.bg, dim: n <= 0.996, solid: false });
        }
      } else if (mode === 'petals' || mode === 'snow' || mode === 'harvestLeaves') {
        const fallY = ((y - step) % 1000 + 1000) % 1000;
        const swayX = (x + Math.floor(Math.sin((y + step) * 0.4) * 1.5) + w) % w;
        const n = cellNoise(swayX, fallY, 31);
        if (n > 0.99) {
          const ch =
            mode === 'snow'
              ? n > 0.995
                ? '*'
                : '·'
              : mode === 'harvestLeaves'
              ? n > 0.995
                ? '🍂'
                : '·'
              : n > 0.995
              ? '✿'
              : '·';
          const safeCh = ch.length > 1 || ch === '🍂' ? ',' : ch;
          const fg =
            mode === 'snow'
              ? '#caf0f8'
              : mode === 'harvestLeaves'
              ? '#f4a261'
              : '#ffcad4';
          screen.set(x, y, safeCh, { fg, bg: cell.bg, dim: n <= 0.995, solid: false });
        }
      } else if (mode === 'matrix') {
        const dropY = ((y - step * 2) % 1000 + 1000) % 1000;
        const n = cellNoise(x, dropY, 53);
        if (n > 0.991) {
          const glyphs = '01ｱｲｳｴ';
          const ch = glyphs[Math.floor(n * 100) % glyphs.length];
          screen.set(x, y, ch, { fg: darken(palette.accent, 0.35), bg: cell.bg, dim: true, solid: false });
        }
      } else if (mode === 'waves') {
        const n = cellNoise(x + step, y, 71);
        if (y > h - 8 && n > 0.985) {
          screen.set(x, y, '~', { fg: darken(palette.accent, 0.3), bg: cell.bg, dim: true, solid: false });
        }
      }
    }
  }
}
