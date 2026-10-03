import { CELL, type Coord } from './SparseWorld.ts';

export type VoxelHit = { cell: Coord; distance: number; point: Coord };
// Amanatides-Woo traversal over the logical source, independent of both meshes.
// Cells are half-open. At a crossed edge/corner all tied axes advance together:
// a cell merely touched at a zero-area edge is not an intervening solid.
export function raycastCells(origin: Coord, direction: Coord, maxDistance: number,
  sample: (cell: Coord) => number | null): VoxelHit | null {
  const magnitude = Math.hypot(...direction);
  if (!Number.isFinite(magnitude) || magnitude === 0 || !origin.every(Number.isFinite) || !Number.isFinite(maxDistance) || maxDistance < 0) return null;
  const d = direction.map(v => v / magnitude);
  const cell = origin.map((v, a) => d[a] < 0 ? Math.ceil(v / CELL) - 1 : Math.floor(v / CELL)) as [number, number, number];
  const step = d.map(Math.sign), stride = d.map(v => v === 0 ? Infinity : CELL / Math.abs(v));
  const next = d.map((v, a) => v === 0 ? Infinity : ((cell[a] + (v > 0 ? 1 : 0)) * CELL - origin[a]) / v);
  let distance = 0;
  while (distance <= maxDistance) {
    if (sample(cell)) return { cell, distance, point: origin.map((v, a) => v + d[a] * distance) as unknown as Coord };
    distance = Math.min(...next);
    if (distance > maxDistance) break;
    for (let a = 0; a < 3; a++) if (Math.abs(next[a] - distance) <= 1e-10) { cell[a] += step[a]; next[a] += stride[a]; }
  }
  return null;
}
