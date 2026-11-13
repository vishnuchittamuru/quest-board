// Procedural Monster & Botanical Spirit Generator for the Battle Arena.
// Generates deterministic ASCII sprites, titles, and combat/tending dialogue
// from a quest or repeating ritual's title, rank, and active biome.

const MONSTER_PREFIXES = {
  S: ['Cataclysmic', 'Abyssal', 'Voidborn', 'Sovereign', 'Arch-Lich'],
  A: ['Relentless', 'Ironclad', 'Stormforged', 'Shadow', 'Dread'],
  B: ['Cunning', 'Bramble', 'Clockwork', 'Restless', 'Ashen'],
  C: ['Scrappy', 'Dusty', 'Troublesome', 'Wandering', 'Rusty'],
  D: ['Tiny', 'Sleepy', 'Pestering', 'Pocket', 'Squeaky'],
};

const MONSTER_NOUNS = [
  'Gorgon',
  'Wraith',
  'Automaton',
  'Wyrm',
  'Sentinel',
  'Gremlin',
  'Leviathan',
  'Chimera',
  'Specter',
  'Golem',
];

const MONSTER_ART_BY_RANK = {
  S: [
    '     /\\   /\\     ',
    '    /  \\_/  \\    ',
    '   (  (O) (O) )  ',
    '  <|  \\  V  / |> ',
    '   |   \\===/  |  ',
    '  / /|       |\\ \\',
    ' (_/ |_______| \\_)',
  ],
  A: [
    '    ,   _   ,    ',
    '   /(o)   (o)\\   ',
    '  /  \\  ^  /  \\  ',
    ' |   |\\___/|   | ',
    '  \\  |_____|  /  ',
    '   \\_/     \\_/   ',
    '    / \\   / \\    ',
  ],
  B: [
    '     .-""""-.    ',
    '    /  o  o  \\   ',
    '   |   /\\/\\   |  ',
    '   |  |____|  |  ',
    '    \\________/   ',
    '     /|    |\\    ',
    '    (_|    |_)   ',
  ],
  C: [
    '      .----.     ',
    '     / .  . \\    ',
    '    |   __   |   ',
    '    |  /  \\  |   ',
    '     \\______/    ',
    '      _|  |_     ',
    '     (__)(__)    ',
  ],
  D: [
    '                 ',
    '      .---.      ',
    '     ( o.o )     ',
    '     /( _ )\\     ',
    '      ^^ ^^      ',
    '                 ',
    '                 ',
  ],
};

// Cozy Cottage uses 4 growing plant stages as completion rises from 0% -> 100%.
const BOTANICAL_STAGES = [
  // Stage 0: Seed (0 - 24%)
  [
    '                 ',
    '                 ',
    '                 ',
    '       (_)       ',
    '      /   \\      ',
    '  ~~~|_____|~~~  ',
    '   (Damp Soil)   ',
  ],
  // Stage 1: Sprout (25 - 59%)
  [
    '                 ',
    '       \\|/       ',
    '      --*--      ',
    '        |        ',
    '     __/ \\__     ',
    '  ~~|_______|~~  ',
    '  (Tender Sprout)',
  ],
  // Stage 2: Budding (60 - 99%)
  [
    '      .( ).      ',
    '     (  *  )     ',
    '      \\ | /      ',
    '     --\\|/--     ',
    '        |        ',
    '  ~~|_______|~~  ',
    ' (Ready to Bloom)',
  ],
  // Stage 3: Full Bloom (100%)
  [
    '     _.-*-._     ',
    '   .( * ✿ * ).   ',
    '  (  * \\|/ *  )  ',
    '   `-._ | _.-`   ',
    '     \\__|__/     ',
    '  ~~|_______|~~  ',
    ' (Radiant Bloom!)',
  ],
];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateEncounter(item, biome, progressPct = 0) {
  const rank = item?.rank || 'B';
  const seedStr = `${item?.id || ''}:${item?.title || 'Quest'}`;
  const h = hashString(seedStr);

  const prefixes = MONSTER_PREFIXES[rank] || MONSTER_PREFIXES.B;
  const prefix = prefixes[h % prefixes.length] || 'Ironclad';
  const noun = MONSTER_NOUNS[(h >>> 5) % MONSTER_NOUNS.length] || 'Wyrm';

  const isBloom = biome?.progressMode === 'bloom';
  if (isBloom) {
    const stageIdx =
      progressPct >= 100 ? 3 : progressPct >= 60 ? 2 : progressPct >= 25 ? 1 : 0;
    const plantNames = ['Moonseed', 'Sunpetal', 'Honeyfern', 'Starblossom', 'Cloverbell'];
    const plantName = plantNames[h % plantNames.length];
    return {
      isBloom: true,
      name: `THE ${prefix.toUpperCase()} ${plantName.toUpperCase()}`,
      subtitle: `${biome.vocab.realm}: ${item?.realm || 'Garden'} · Stage ${stageIdx + 1}/4`,
      art: BOTANICAL_STAGES[stageIdx],
      taunt: `"The soil is waiting for gentle tending..."`,
      staggerLine: `"Fresh leaves unfurl in the sunlight!"`,
      defeatLine: `"Full Radiant Bloom achieved! Time to harvest!"`,
    };
  }

  return {
    isBloom: false,
    name: `THE ${prefix.toUpperCase()} ${noun.toUpperCase()}`,
    subtitle: `${rank}-Rank Threat · ${item?.realm || 'Guild Board'}`,
    art: MONSTER_ART_BY_RANK[rank] || MONSTER_ART_BY_RANK.B,
    taunt: `"You dare challenge '${(item?.title || '').slice(0, 28)}'?"`,
    staggerLine: `"It reels backward under your focus!"`,
    defeatLine: `"Shattered into pure XP and gleaming loot!"`,
  };
}
