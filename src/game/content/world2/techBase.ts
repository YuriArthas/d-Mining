import { STATION_LOCAL, worldPortal } from '../worldJourney.ts';

/** 第二世界 surface: a desert mining colony on warm sand in a basin ringed by red mesas. Local metres: origin at the
 *  mine shaft's centre (world z 224), +Z toward the spawn (z 46, facing the shaft) and the world portal up on its
 *  dais at the far end (z 62); world 3's border wall stands at z 69. Yellow lanes lead from the dais past the spawn
 *  and round the shaft, where the drill tower stands; the ore buyer and the gear shop, white domes with a yellow
 *  and a teal front, face the lanes from either side. One source for the offline art build
 *  (surface-game-art/tools/underground/techBaseHall.ts) and the game (placement, service rings, signs, colliders).
 *  The shaft (|x|, |z| < 8) stays open; the walls round each world are WorldBorders'. */
type V3 = readonly [number, number, number];
type XZ = readonly [number, number];
const station = { x: STATION_LOCAL.x, z: STATION_LOCAL.z, yaw: Math.atan2(-STATION_LOCAL.x, 46 - STATION_LOCAL.z) };

/** A point in a building's own frame (front +Z, scaled) placed in the base. */
const local = (at: V3, yaw: number, scale: number, [x, y, z]: V3): V3 =>
  [at[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale, at[1] + y * scale, at[2] + (-x * Math.sin(yaw) + z * Math.cos(yaw)) * scale];
/** A dome hall at `at` turned by `yaw` (its front, +Z, turned round Y): the service ring on the sand before its
 *  counter, the sign on the navy board over the opening. */
const hall = (at: V3, yaw: number, scale: number) => ({ at, yaw, scale, ring: local(at, yaw, scale, [0, 0, 7.4]), sign: local(at, yaw, scale, [0, 5.6, 2.46]) });
const portal = worldPortal(2), portalYaw = Math.PI;

export const TECH_BASE = {
  asset: 'tech-base',
  worldZ: 224,
  /** The basin the mesas close round (inner faces at its edges). */
  basin: { x: [-34, 34] as const, z: [-24, 67] as const },
  /** The ore buyer (west, yellow) and the gear shop (east, teal), fronts toward the lanes and the spawn. */
  kiosks: {
    sell: hall([-22.5, 0, 24], Math.PI / 2 - .4, 1.15),
    shop: hall([22.5, 0, 24], -Math.PI / 2 + .4, 1.15),
  },
  /** The teleport station (TeleportStations draws its portal disc 2.75 m up between the pillars). */
  station,
  /** World 2's portal (worldPortal(2): x 0, z 62, facing the shaft) on a dais `floor` high, steps toward the
   *  spawn; its sign over the lintel. */
  portal: { at: [0, 0, 62] as V3, yaw: portalYaw, floor: portal.y, sign: [0, portal.y + 7.7, 62] as V3 },
  /** Painted lanes (centre lines, width in metres): the trunk from the dais steps to the spawn, two curves from
   *  the spawn round either side to the loop round the shaft (half size, corner radius). */
  lanes: {
    width: 2.6,
    trunk: [[0, 54.4], [0, 43]] as readonly XZ[],
    curve: [[0, 43.5], [-3.6, 37.5], [-9, 31.5], [-12, 24], [-12.6, 16], [-12.6, 8]] as readonly XZ[],
    loop: { half: 12.6, corner: 4.6 },
  },
  /** The concrete apron round the shaft, the pit rail (posts every ~2.2 m, an opening in the middle of each side). */
  apron: 11,
  rail: { at: 8.9, opening: 3.4 },
  /** The drill tower: four legs from feet at the apron's corners leaning in to the column over the shaft; its bit
   *  turns below; the world's name on the column's screen, facing the spawn. */
  rig: { feet: 10.2, column: 12.5, sign: [0, 16.4, 2.78] as V3 },
  /** The ore line: a conveyor from the rig's east side (x 11) to the silo, along x at z -4. */
  conveyor: { from: 11, to: 27, z: -4, height: 3.2 },
  silo: { at: [30, 0, -4] as V3, radius: 3.2 },
  /** The west yard: a raised deck (1 m, steps on its east side) with tanks, containers and the beacon. */
  deck: { x: [-32, -19] as const, z: [-21, 0] as const, height: 1 },
  tanks: [[-28.5, -16], [-23.5, -16], [-8, -19], [0, -19.5], [8, -19]] as readonly XZ[],
  beacon: [-29, 1, -6] as V3,
  /** Cargo containers: [x, y, z, yaw, colour]. */
  containers: [[-28, 1, -9.5, 1.57, 'Orange'], [-28, 3.5, -9.5, 1.6, 'Teal'], [-22.5, 1, -4, .05, 'Teal'],
    [27.5, 0, 60, .08, 'Orange'], [27.5, 2.5, 60, .04, 'Teal'], [21, 0, 63, 1.5, 'Navy'], [-27.5, 0, 62, -.06, 'Navy'],
    [29, 0, 9.5, 1.57, 'Teal'], [-29.5, 0, 12, 1.5, 'Orange']] as readonly (readonly [number, number, number, number, string])[],
  /** Habitat domes and a module round the plaza: [x, z, radius scale, yaw]. */
  domes: [[-24, 50, 1, Math.PI / 2], [-17.5, 62, .62, Math.PI * .6], [15.5, 57, .7, -Math.PI * .4]] as readonly (readonly [number, number, number, number])[],
  module: { at: [25.5, 0, 46] as V3, yaw: -Math.PI / 2 },
  mech: { at: [-22, 0, 8.5] as V3, yaw: 1.2 },
  solar: { x: 22, rows: [-17, -12.5] as readonly number[] },
  /** Lamp posts along the lanes and round the plaza: [x, z, yaw]. */
  lamps: [[-6.4, 41, 0], [6.4, 41, Math.PI], [-17.5, 30.5, 0], [17.5, 30.5, Math.PI], [-16, 13, 0], [16, 13, Math.PI],
    [-16, -13, 0], [16, -13, Math.PI], [-6, 50.5, 0], [6, 50.5, Math.PI]] as readonly (readonly [number, number, number])[],
  /** Palms (thick trunks, a few broad fronds), cacti and boulders on the sand: [x, z, scale, yaw]. */
  palms: [[-9.5, 47, 1, 0], [9.5, 47.5, .9, 2.1], [-8.5, 64, 1.1, 1], [8.5, 64.5, 1, 4], [-31, 35, 1.15, 3], [31, 34.5, 1.05, 5],
    [-17, 38, .85, 2.4], [17.5, 37, .95, .6], [-31, -1, 1, 1.4], [30.5, 19.5, .9, 2.7]] as readonly (readonly [number, number, number, number])[],
  cacti: [[-27, 40, 1, 0], [30, 40, 1.1, 2], [-14.5, 49, .8, 1], [12, 52, .9, 3], [-31.5, 22, 1.2, 4], [31, 3, 1, 5],
    [-14, -21.5, .9, 2], [15, -22, 1.1, 1], [-31, -21, 1, 0], [31.5, -20, .85, 3]] as readonly (readonly [number, number, number, number])[],
  /** Crates of ore by the buyer, barrels by the shop: [x, z, yaw, kind]. */
  crates: [[-15.5, 15.5, .3, 'red'], [-16.8, 16.6, .1, 'blue'], [-14.4, 16.6, .5, 'red'], [-17.4, 33.2, .2, 'blue'], [-18.2, 34.6, .7, 'red'],
    [15.2, 15.6, .2, 'barrel'], [16.5, 15.2, 0, 'barrel'], [16.3, 33.4, .4, 'barrel'], [-15.5, 44.5, .3, 'red'], [-16.6, 45.6, .1, 'blue']] as readonly (readonly [number, number, number, 'red' | 'blue' | 'barrel'])[],
} as const;
