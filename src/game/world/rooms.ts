import { CELL } from '../terrain/grid.ts';
import type { ZoneConfig } from '../logic/ZoneDetector.ts';

const zone = (x: number, y: number, z: number): ZoneConfig => ({ x, y, z, radius: 1.7, heightTolerance: 0.25, hysteresis: 0.25 });
function room(id: string, name: string, depth: number, x: number, z: number, shop: boolean) {
  return Object.freeze({ id, name, depth, x, z, width: 20, height: 10,
    spawn: [x, -depth + 0.1, z + 3] as const,
    platform: { center: [x, -depth - 0.5, z] as const, half: [8, 0.5, 6] as const },
    sell: zone(x - 4, -depth, z), shop: shop ? zone(x + 4, -depth, z) : null });
}
export const ROOMS = Object.freeze([
  room('rest-400', '浅层营地', 400, 0, 0, false),
  room('rest-800', '深层驿站', 800, 40, -24, true),
]);
export type RestRoom = typeof ROOMS[number];
export const HOME_ZONE: ZoneConfig = { x: 0, y: 2, z: 16, radius: 5, heightTolerance: 0.3, hysteresis: 0.25 };
// Query only procedural occupancy. No voxel allocation or excavation records.
export function roomAir(x: number, y: number, z: number) {
  for (const r of ROOMS) {
    const floor = -r.depth / CELL, cx = r.x / CELL, cz = r.z / CELL;
    if (y >= floor && y < floor + r.height && x >= cx - r.width / 2 && x < cx + r.width / 2 && z >= cz - r.width / 2 && z < cz + r.width / 2) return true;
    // Reserve the fixed platform's support volume, avoiding overlapping voxel faces.
    if (y === floor - 1 && x >= cx - 4 && x < cx + 4 && z >= cz - 3 && z < cz + 3) return true;
  }
  return false;
}
