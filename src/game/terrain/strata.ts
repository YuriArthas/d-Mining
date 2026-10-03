import { CELL } from './grid.ts';

// Depth decides mineral IDs and frequency, never item HP, value or room layout.
// Weights are percentages of coherent 3×3×3 deposits, not stored voxel arrays.
export const STRATA = [
  { id: 'surface', name: '浅层矿区', from: 0, base: 1, ores: [{ kind: 3, weight: 12 }, { kind: 4, weight: 8 }] },
  { id: 'gold', name: '金矿层', from: 400, base: 2, ores: [{ kind: 3, weight: 8 }, { kind: 4, weight: 16 }, { kind: 5, weight: 16 }] },
  { id: 'crystal', name: '水晶矿层', from: 800, base: 2, ores: [{ kind: 4, weight: 10 }, { kind: 5, weight: 25 }, { kind: 6, weight: 20 }] },
] as const;
export function stratumAtDepth(depth: number) {
  for (let i = STRATA.length - 1; i > 0; i--) if (depth >= STRATA[i].from) return STRATA[i];
  return STRATA[0];
}
export function generatedMineral(x: number, y: number, z: number, seed: number) {
  // A block belongs to the layer at its TOP face: y=-200 ends at 400m,
  // while y=-201 starts at 400m and is the first block of the next layer.
  const layer = stratumAtDepth(-(y + 1) * CELL);
  const hash = (Math.imul(Math.floor(x / 3), 73856093) ^ Math.imul(Math.floor(y / 3), 19349663) ^ Math.imul(Math.floor(z / 3), 83492791) ^ seed) >>> 0;
  const roll = hash % 100;
  let threshold = 0;
  for (const ore of layer.ores) { threshold += ore.weight; if (roll < threshold) return ore.kind; }
  return layer.base;
}
