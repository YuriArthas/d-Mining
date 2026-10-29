import { STATION_LOCAL, worldPortal } from '../worldJourney.ts';
import { eggsOfWorld, hatcheryStands, type Hatchery } from '../eggStands.ts';

/** 第三世界 surface, 星陨秘境: long ago a star fell here. The mine shaft is its crater's mouth, a broad rim of pale
 *  stone round it set with glowing shards, the gold star itself hanging and slowly turning high over the shaft;
 *  the hub is a basin of pale stardust closed by moonstone crater walls with crystals on their tops and a few
 *  floating islands above them. Local metres: origin at the shaft's centre (world z 448), +Z toward the spawn (z 46,
 *  facing the shaft) and the world portal behind it (z 62); the layout follows world 2's so the worlds read alike:
 *  the ore buyer (west) and the gear shop (east), white observatories with gold domes, face the path; the station
 *  west of the spawn, world 3's twelve eggs on a round pad east of it. Starlight paths lead from the portal past the
 *  spawn and round the crater. One source for the offline art build (surface-game-art/tools/underground/
 *  starBaseHall.ts) and the game (placement, service rings, signs, colliders). The shaft (|x|, |z| < 8) stays open;
 *  the walls round each world are WorldBorders'. */
type V3 = readonly [number, number, number];
type XZ = readonly [number, number];
const station = { x: STATION_LOCAL.x, z: STATION_LOCAL.z, yaw: Math.atan2(-STATION_LOCAL.x, 46 - STATION_LOCAL.z) };
const local = (at: V3, yaw: number, scale: number, [x, y, z]: V3): V3 =>
  [at[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale, at[1] + y * scale, at[2] + (-x * Math.sin(yaw) + z * Math.cos(yaw)) * scale];
/** An observatory at `at` turned by `yaw` (its front, +Z): the service ring on the stardust before its counter, the
 *  sign on the board over the opening (build_star_base.py: the front board's face at z 2.46, 5.6 up). */
const hall = (at: V3, yaw: number, scale: number) => ({ at, yaw, scale, ring: local(at, yaw, scale, [0, 0, 7.4]), sign: local(at, yaw, scale, [0, 5.6, 2.46]) });
const portal = worldPortal(3);
/** World 3's twelve eggs east of the spawn, the arc opening toward it (stands from build_egg_stands.py). */
const hatchery: Hatchery = { centre: [20, 50], radius: 13, span: 210 * Math.PI / 180, pad: 15 };
type Decor = Readonly<{ prop: string; x: number; z: number; yaw: number; scale: number; y?: number; half: V3 }>;

export const STAR_BASE = {
  asset: 'star-base',
  worldZ: 448,
  /** The basin the crater walls close round (inner faces at its edges). */
  basin: { x: [-34, 34] as const, z: [-24, 67] as const },
  kiosks: {
    sell: hall([-22.5, 0, 24], Math.PI / 2 - .4, 1.1),
    shop: hall([22.5, 0, 24], -Math.PI / 2 + .4, 1.1),
  },
  station,
  /** World 3's portal (worldPortal(3): x 0, z 62, facing the shaft) on its round step; its sign over the ring. */
  portal: { at: [0, 0, 62] as V3, yaw: Math.PI, floor: portal.y, sign: [0, 7.3, 62] as V3 },
  hatchery,
  stands: hatcheryStands(hatchery, eggsOfWorld(3)),
  /** Starlight paths (centre lines, width): the trunk from the portal step to the spawn, two curves from the spawn
   *  round either side to the loop round the crater (half size, corner radius). */
  paths: {
    width: 2.8,
    trunk: [[0, 58.6], [0, 43]] as readonly XZ[],
    curve: [[0, 43.5], [-3.6, 37.5], [-9, 31.5], [-12, 24], [-13.4, 16], [-13.4, 8]] as readonly XZ[],
    loop: { half: 13.4, corner: 5 },
  },
  /** The crater's rim: pale stone from the shaft's edge out to a rounded square, raised a little; posts with gold
   *  rails round the mouth, an opening in the middle of each side. */
  rim: 11.5,
  rail: { at: 8.9, opening: 3.4 },
  /** The fallen star: high over the shaft, turning; the crater arch behind the shaft's far edge (on the rim's edge),
   *  the world's name on its keystone facing the spawn. */
  star: { at: [0, 16, 0] as V3, scale: 1.7 },
  arch: { at: [0, 0, -11.5] as V3, sign: [0, 11.6, -10.9] as V3 },
  /** Star lanterns along the paths and round the plaza (the pair by the spawn clear of the egg pad): [x, z]. */
  lamps: [[-6.6, 41], [6.6, 41], [-18, 30.5], [18, 30.5], [-17.5, 12], [17.5, 12], [-17.5, -12], [17.5, -12], [-4.8, 51], [4.8, 51]] as readonly XZ[],
  /** Crystal trees (a thick pale trunk, a few big faceted crowns): [x, z, scale, yaw, kind 0 violet / 1 teal / 2 pink]. */
  trees: [[-9.5, 47.5, 1, 0, 0], [-8.5, 64.5, 1.1, 1, 1], [9, 65, 1, 4, 2], [-31, 35, 1.2, 3, 1], [31, 34, 1.1, 5, 0],
    [-17.5, 39, .9, 2.4, 2], [30.5, 19.5, .95, 2.7, 1], [-31, -2, 1.05, 1.4, 0], [-30, 50, 1, .6, 2], [26, -20, 1.1, 2, 2],
    [-26, -20, 1, 4.1, 1], [31, 2, 1, 1, 0]] as readonly (readonly [number, number, number, number, number])[],
  /** Crystal clusters and star shards on the stardust: [x, z, scale, yaw, kind 0 crystals / 1 shard]. */
  clusters: [[-27, 41, 1, 0, 0], [30.5, 26, 1.1, 2, 1], [-15, 50, .8, 1, 0], [-31.5, 22, 1.2, 4, 1], [31, -6, 1, 5, 0],
    [-13, -21, .9, 2, 1], [14, -21.5, 1.1, 1, 0], [-31, -12, 1, 0, 0], [31.5, -15, .9, 3, 1], [-21, 4, .9, 2.2, 0],
    [21, 4.5, .85, .4, 1]] as readonly (readonly [number, number, number, number, number])[],
  /** Floating islands over the crater walls: [x, y, z, radius]. */
  islands: [[-26, 30, -14, 4.2], [24, 34, -18, 5], [-38, 26, 30, 3.6], [39, 28, 22, 4], [-14, 38, -32, 3.2], [16, 31, 76, 3.4]] as readonly (readonly [number, number, number, number])[],
  /** Round the teleport station, a piece of each layer below (props from their halls' kits), in the station's frame
   *  (x across, +Z toward the spawn): the giant fossil, the ancient machine, the crystal geode, the ruins' guardian,
   *  the ice and the star's heart. `half` is the collider's half size (y up from the ground); `y` lifts a prop
   *  built round its centre (the gear). */
  stationDecor: [
    { prop: 'Fossil_Ribs', x: -5.4, z: -.4, yaw: .6, scale: .5, half: [1.4, .85, 1.2] },
    { prop: 'Gear_Medium', x: 5.2, z: -.6, yaw: -.5, scale: .3, y: 1.2, half: [1.25, 1.25, .3] },
    { prop: 'Geode_Open', x: -4.4, z: -3.6, yaw: .4, scale: .45, half: [1.2, .75, 1.05] },
    { prop: 'Guardian_Head', x: 4.4, z: -3.6, yaw: -.3, scale: .45, half: [.8, 1.3, .7] },
    { prop: 'Ice_Cluster', x: -7.8, z: -2.2, yaw: 0, scale: 1.8, half: [1.05, 1.2, .9] },
    { prop: 'Star_Shard', x: 7.9, z: -2.4, yaw: .3, scale: .55, half: [1.1, 1.3, 1.1] },
  ] as readonly Decor[],
} as const;
