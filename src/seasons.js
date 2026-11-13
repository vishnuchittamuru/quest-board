// Real-calendar seasonal events. Each brings a tint, an ambient overlay,
// a reward bonus and a limited-time relic that only drops during the event.

export const SEASONS = [
  {
    id: 'frostfall',
    name: 'Frostfall',
    from: '12-01',
    to: '01-06',
    tint: '#a8dadc',
    amount: 0.12,
    overlay: 'snow',
    xpMult: 0.1,
    goldMult: 0,
    focusBonus: 0,
    bonusText: '+10% XP on everything',
    relicId: 'frost_globe',
  },
  {
    id: 'spring',
    name: 'Spring Bloom',
    from: '03-20',
    to: '04-30',
    tint: '#ffafcc',
    amount: 0.08,
    overlay: 'petals',
    xpMult: 0.05,
    goldMult: 0.05,
    focusBonus: 0,
    bonusText: '+5% XP & Gold',
    relicId: 'everbloom_sprig',
  },
  {
    id: 'midsummer',
    name: 'Midsummer Nights',
    from: '06-15',
    to: '07-15',
    tint: '#ffd166',
    amount: 0.08,
    overlay: 'fireflies',
    xpMult: 0,
    goldMult: 0,
    focusBonus: 10,
    bonusText: '+10 XP per focus round',
    relicId: 'firefly_jar',
  },
  {
    id: 'harvest',
    name: 'Harvest Moon',
    from: '10-01',
    to: '11-30',
    tint: '#f4a261',
    amount: 0.1,
    overlay: 'harvestLeaves',
    xpMult: 0,
    goldMult: 0.1,
    focusBonus: 0,
    bonusText: '+10% Gold on everything',
    relicId: 'harvest_lantern',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mmdd(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function inSeason(season, date) {
  const d = mmdd(date);
  return season.from <= season.to ? d >= season.from && d <= season.to : d >= season.from || d <= season.to;
}

export function activeSeason(date = new Date()) {
  return SEASONS.find((s) => inSeason(s, date)) || null;
}

export function seasonById(id) {
  return SEASONS.find((s) => s.id === id) || null;
}

export function formatSeasonWindow(season) {
  const fmt = (md) => {
    const [m, d] = md.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  };
  return `${fmt(season.from)} – ${fmt(season.to)}`;
}
