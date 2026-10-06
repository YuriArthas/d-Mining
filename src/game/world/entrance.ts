import {CELL} from '../terrain/grid.ts';
// Grid coordinates, shared by every entrance. The floor is one cell thick.
export const ENTRANCE = Object.freeze({ minX: -4, maxX: 3, minZ: -4, maxZ: 3 });
export const ENTRANCE_WORLD={minX:ENTRANCE.minX*CELL,maxX:(ENTRANCE.maxX+1)*CELL,minZ:ENTRANCE.minZ*CELL,maxZ:(ENTRANCE.maxZ+1)*CELL} as const;
export function inEntrance(x: number, z: number) {
  return x >= ENTRANCE.minX && x <= ENTRANCE.maxX && z >= ENTRANCE.minZ && z <= ENTRANCE.maxZ;
}
export const PROTECTED_FLOOR = 7; // Terrain material, never an inventory item.
// Four thin visual strips; no collision and no per-cell geometry.
export const ENTRANCE_EDGES = [
  { center: [0, 0.025, -8], size: [16.12, 0.025, 0.12] },
  { center: [0, 0.025, 8], size: [16.12, 0.025, 0.12] },
  { center: [-8, 0.025, 0], size: [0.12, 0.025, 16.12] },
  { center: [8, 0.025, 0], size: [0.12, 0.025, 16.12] },
] as const;
