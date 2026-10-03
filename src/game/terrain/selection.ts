import { CELL, type Coord } from './SparseWorld.ts';
import { raycastCells } from './raycast.ts';

export const SELECTION = { rayLength: 18, reach: 4 * CELL } as const;
export function selectCell(origin: Coord, direction: Coord, hand: Coord,
  sample: (cell: Coord) => number | null): Coord | null {
  // The pointer ray picks a cell; reach depends only on distance, never line of sight.
  const hit = raycastCells(origin, direction, SELECTION.rayLength, sample);
  if (!hit) return null;
  const distance = Math.hypot(...hit.point.map((v, a) => v - hand[a]));
  return distance <= SELECTION.reach ? hit.cell : null;
}
