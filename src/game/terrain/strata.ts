import { CELL } from './grid.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
export const STRATA = LAYERS;
export const stratumAtDepth = layerAtDepth;
export function generatedMineral(x: number, y: number, z: number, seed: number, layers: readonly Layer[] = LAYERS) {
  // A block belongs to the layer at its TOP face: y=-200 ends at 400m,
  // while y=-201 starts at 400m and is the first block of the next layer.
  const layer = layerAtDepth(-(y + 1) * CELL, layers);
  const hash = (Math.imul(Math.floor(x / 3), 73856093) ^ Math.imul(Math.floor(y / 3), 19349663) ^ Math.imul(Math.floor(z / 3), 83492791) ^ seed) >>> 0;
  const roll = hash % 100;
  let threshold = 0;
  for (const ore of layer.ores) { threshold += ore.weight; if (roll < threshold) return ore.kind; }
  return layer.base;
}
