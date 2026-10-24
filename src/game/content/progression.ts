// The ten progression stages behind the pets and the capsule: each stage's coin scale, its pets' power
// bonus and the price of its eggs (the journey reprices eggs in gameContent.ts).
const values = [1, 8, 60, 500, 8_000, 200_000, 6_000_000, 180_000_000, 5_400_000_000, 162_000_000_000];
export const STAGES = Object.freeze(values.map((basePrice, i) => Object.freeze({
  index: i, basePrice,
  petBonusBps: Math.round(5000 * 3 ** i),
  eggPrice: Math.round(basePrice * (i === 0 ? 80 : 100)),
})));
export const EGG_STAGES: Readonly<Record<string, readonly [number, boolean]>> = Object.freeze({
  'meadow-egg': [0, false], 'pebble-egg': [1, false], 'mushroom-egg': [2, false], 'crystal-egg': [3, false],
  'copper-egg': [4, false], 'ruin-egg': [4, true],
  'tide-egg': [5, false], 'frost-egg': [5, true],
  'fire-egg': [6, false], 'lava-egg': [6, true],
  'fossil-egg': [7, false], 'amber-egg': [7, true],
  'gear-egg': [8, false], 'silver-egg': [8, true],
  'star-egg': [9, false], 'core-egg': [9, true],
});
