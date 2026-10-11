import { pickaxeStats } from '../logic/Pickaxe.ts';

// First playable balance, not a measured completion-time guarantee. Shared by
// content generation and the offline calculator; no timers or player multipliers.
export const PROGRESSION_VERSION = 'progression-v1';
const levels = [1, 6, 11, 16, 26, 41, 56, 71, 86, 101];
const values = [1, 8, 60, 500, 8_000, 200_000, 6_000_000, 180_000_000, 5_400_000_000, 162_000_000_000];
const budgets = [769, 1904, 99670, 6055735, 278618529, 6975658340, 343841465485, 2700000000000, 81000000000000, 300000000000000];
export const STAGES = Object.freeze(levels.map((entryLevel, i) => Object.freeze({
  index: i, entryLevel, exitLevel: levels[i + 1] ?? 116,
  targetMinutes: [20, 15, 25, 60, 120, 120, 120, 120, 120, 120][i],
  basePrice: values[i], upgradeBudget: budgets[i],
  petBonusBps: Math.round(5000 * 3 ** i),
  eggPrice: Math.round(values[i] * (i === 0 ? 80 : 100)),
  deepAt: 280, // metres below this room; the next room starts at +380m
  deepKind: 32 + i,
  capacity: [100, 200, 350, 600, 1000, 1600, 2400, 3400, 4600, 6000][i],
})));
export function stageForLevel(level: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) if (level >= STAGES[i].entryLevel) return STAGES[i];
  return STAGES[0];
}
export function upgradePrice(level: number) {
  const stage = stageForLevel(level), count = stage.exitLevel - stage.entryLevel;
  const offset = level - stage.entryLevel;
  // Explicit geometric weights inside each stage; later stages keep growing.
  const sum = (1.22 ** count - 1) / .22;
  return Math.ceil(stage.upgradeBudget * 1.22 ** offset / sum);
}
export function shallowHealth(stageIndex: number) {
  if (stageIndex === 0) return 10;
  const stage = STAGES[stageIndex], previous = STAGES[stageIndex - 1];
  return Math.round(pickaxeStats(stage.entryLevel).power * (1 + 3 * previous.petBonusBps / 10000) * 5);
}
export function deepHealth(stageIndex: number) {
  const s = STAGES[stageIndex], stats = pickaxeStats(s.exitLevel);
  // At the recommended end-of-stage equipment, 50 deep cells take ~3 minutes
  // of attacks. Older equipment can still mine them; pets shorten this too.
  return Math.round(stats.power * (1 + 3 * s.petBonusBps / 10000) * stats.speed * 180 / 50);
}
export const EGG_STAGES: Readonly<Record<string, readonly [number, boolean]>> = Object.freeze({
  'meadow-egg': [0, false], 'pebble-egg': [1, false], 'mushroom-egg': [2, false], 'crystal-egg': [3, false],
  'copper-egg': [4, false], 'ruin-egg': [4, true],
  'tide-egg': [5, false], 'frost-egg': [5, true],
  'fire-egg': [6, false], 'lava-egg': [6, true],
  'fossil-egg': [7, false], 'amber-egg': [7, true],
  'gear-egg': [8, false], 'silver-egg': [8, true],
  'star-egg': [9, false], 'core-egg': [9, true],
});
