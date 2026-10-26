import { eggsOfWorld, hatcheryStands, type Hatchery } from '../eggStands.ts';

/** 第三世界 surface: the planned plaza (WorldBorders' journeySurfacePlan: floor, paths, the sell and shop booths
 *  either side of the path between the shaft and the spawn, the station and the portal frame) and one authored
 *  part, the hatchery: world 3's twelve eggs in an arc on a round navy pad east of the spawn, opening toward it
 *  (surface-game-art/tools/underground/starBaseHall.ts, stands from build_egg_stands.py). Local metres: origin at
 *  the mine shaft's centre (world z 448), +Z toward the spawn (z 46). */
const hatchery: Hatchery = { centre: [20, 50], radius: 13, span: 210 * Math.PI / 180, pad: 15 };
export const STAR_BASE = {
  asset: 'star-base',
  worldZ: 448,
  /** The two booths face the spawn from either side of the path (sell west, shop east); `z` is their rings'. */
  booths: { x: 16, z: 30 },
  hatchery,
  stands: hatcheryStands(hatchery, eggsOfWorld(3)),
} as const;
