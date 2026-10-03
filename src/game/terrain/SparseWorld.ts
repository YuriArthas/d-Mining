import { generatedMineral } from './minerals.ts';
import { SHAFT } from '../validation/course.ts';
export type Coord = readonly [number, number, number];
export const CELL = 2;
export const WORLD_GENERATION = { version: 2, seed: 0 } as const;
export const INDEX_SIZE = 16; // Sparse spatial index only; never a dense voxel allocation.
export const RENDER_SIZE = 16;
export const COLLISION_SIZE = 8;
export const LIMITS = { minX: -48, maxX: 51, minY: -2000, maxY: -1, minZ: -48, maxZ: 51 };
export const chunkKey = (c: Coord) => c.join(',');
export const regionOf = (c: Coord, size: number): Coord => [Math.floor(c[0] / size), Math.floor(c[1] / size), Math.floor(c[2] / size)];
export const inBounds = ([x, y, z]: Coord) => x >= LIMITS.minX && x <= LIMITS.maxX && y >= LIMITS.minY && y <= LIMITS.maxY && z >= LIMITS.minZ && z <= LIMITS.maxZ;
export const validRegion = (c: Coord, size: number) => c[0] * size <= LIMITS.maxX && (c[0] + 1) * size > LIMITS.minX && c[1] * size <= LIMITS.maxY && (c[1] + 1) * size > LIMITS.minY && c[2] * size <= LIMITS.maxZ && (c[2] + 1) * size > LIMITS.minZ;
const bucketKey = (x: number, y: number, z: number) => x + 3 + 7 * (z + 3 + 7 * (y + 125));
const indexXYZ = (x: number, y: number, z: number) => (x & 15) + 16 * ((y & 15) + 16 * (z & 15));
// Sorted inclusive runs [start,end,...]. null denotes an entirely removed index region.
export type Runs = Uint16Array | null;
export type Edits = Map<number, Runs>;
export type EditSnapshot = [number, Runs][];
export function contains(runs: Runs | undefined, index: number) {
  if (runs === null) return true;
  if (!runs) return false;
  let lo = 0, hi = runs.length / 2;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (runs[mid * 2 + 1] < index) lo = mid + 1; else hi = mid; }
  return lo * 2 < runs.length && runs[lo * 2] <= index;
}
export function mergeRemoved(old: Runs | undefined, indices: number[]): Runs {
  if (old === null) return null;
  const points = [...new Set(indices)].sort((a, b) => a - b), merged: number[] = [];
  let a = 0, b = 0;
  while (a < (old?.length ?? 0) || b < points.length) {
    let start: number, end: number;
    if (b >= points.length || (a < (old?.length ?? 0) && old![a] <= points[b])) { start = old![a++]; end = old![a++]; }
    else { start = end = points[b++]; }
    if (merged.length && start <= merged[merged.length - 1] + 1) merged[merged.length - 1] = Math.max(end, merged[merged.length - 1]);
    else merged.push(start, end);
  }
  return merged.length === 2 && merged[0] === 0 && merged[1] === 4095 ? null : new Uint16Array(merged);
}
function apply(edits: Edits, cells: readonly Coord[]) {
  const groups = new Map<number, number[]>();
  for (const c of cells) {
    const key = bucketKey(Math.floor(c[0] / 16), Math.floor(c[1] / 16), Math.floor(c[2] / 16));
    const list = groups.get(key) ?? []; list.push(indexXYZ(...c)); groups.set(key, list);
  }
  for (const [key, indices] of groups) edits.set(key, mergeRemoved(edits.get(key), indices));
}
export function baseXYZ(x: number, y: number, z: number): number {
  if (x < -48 || x > 51 || y < -2000 || y > -1 || z < -48 || z > 51) return 0;
  if (y >= -1000 && y <= -993 && x >= -8 && x < 8 && z >= -8 && z < 8) return 0;
  if (y >= SHAFT.minY && x >= SHAFT.minX && x <= SHAFT.maxX && z >= SHAFT.minZ && z <= SHAFT.maxZ) return 0;
  return generatedMineral(x, y, z, WORLD_GENERATION.seed);
}
export function sampleXYZ(x: number, y: number, z: number, edits: Edits) {
  const base = baseXYZ(x, y, z); // Check bounds before looking up the bounded numeric key.
  return base && contains(edits.get(bucketKey(Math.floor(x / 16), Math.floor(y / 16), Math.floor(z / 16))), indexXYZ(x, y, z)) ? 0 : base;
}
export function affectedRegions(cell: Coord, size: number): Coord[] {
  const home = regionOf(cell, size), result: Coord[] = [home];
  for (let axis = 0; axis < 3; axis++) {
    const local = ((cell[axis] % size) + size) % size;
    if (local === 0 || local === size - 1) {
      const neighbor = [...home] as [number, number, number]; neighbor[axis] += local === 0 ? -1 : 1;
      if (validRegion(neighbor, size)) result.push(neighbor);
    }
  }
  return result;
}
export class SparseWorld {
  readonly generation = WORLD_GENERATION;
  private readonly edits: Edits = new Map();
  revision = 0;
  removed = 0;
  cell(c: Coord) { return sampleXYZ(...c, this.edits); }
  remove(cells: readonly Coord[]) {
    const accepted = [...new Map(cells.filter(c => inBounds(c) && c.every(Number.isInteger) && this.cell(c)).map(c => [chunkKey(c), c])).values()];
    if (accepted.length) { apply(this.edits, accepted); this.revision++; this.removed += accepted.length; }
    return accepted;
  }
  snapshot(coord: Coord, size: number, pending: readonly Coord[] = []): EditSnapshot {
    const min = coord.map(v => Math.floor((v * size - 1) / 16)), max = coord.map(v => Math.floor(((v + 1) * size) / 16));
    const nearby: Edits = new Map();
    for (let z = min[2]; z <= max[2]; z++) for (let y = min[1]; y <= max[1]; y++) for (let x = min[0]; x <= max[0]; x++) {
      if (!validRegion([x, y, z], 16)) continue;
      const key = bucketKey(x, y, z), runs = this.edits.get(key);
      if (runs !== undefined) nearby.set(key, runs === null ? null : runs.slice());
    }
    apply(nearby, pending.filter(c => c.every((v, i) => v >= coord[i] * size - 1 && v <= (coord[i] + 1) * size)));
    return [...nearby];
  }
  stats() { return { editedRegions: this.edits.size, editBytes: [...this.edits.values()].reduce((n, runs) => n + (runs?.byteLength ?? 0), 0), fullAirRegions: [...this.edits.values()].filter(v => v === null).length }; }
}
