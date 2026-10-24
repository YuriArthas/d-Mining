import { STATION_LOCAL } from '../worldJourney.ts';

/** 第二世界 surface: a compact near-future mining base in a basin ringed by red-rock cliffs. Local metres: origin at
 *  the mine shaft's centre (world z 224), +Z toward the spawn plaza (spawn at z 46, facing the shaft) and the world
 *  portal at the plaza's far end (z 62); world 3's border wall stands at z 69. One source for the offline art build
 *  (surface-game-art/tools/underground/techBaseHall.ts) and the game (placement, service rings, signs, colliders).
 *  The shaft (|x|, |z| < 8) stays open; the walls round each world are WorldBorders'. */
type V3 = readonly [number, number, number];
const station = { x: STATION_LOCAL.x, z: STATION_LOCAL.z, yaw: Math.atan2(-STATION_LOCAL.x, 46 - STATION_LOCAL.z) };

export const TECH_BASE = {
  asset: 'tech-base',
  worldZ: 224,
  /** The basin the cliffs close round (inner faces at its edges). */
  basin: { x: [-34, 34] as const, z: [-24, 67] as const },
  /** Service buildings either side of the walk from the plaza to the shaft, fronts toward it (yaw turns the
   *  prop's front, +Z, round Y). Rings (radius 3, the session's zones) on open paving before each counter window;
   *  the sign hangs on the building's facade screen. */
  kiosks: {
    sell: { at: [-21, 0, 26] as V3, yaw: Math.PI / 2, scale: 1.2, ring: [-12.4, 0, 22.6] as V3, sign: [-17.55, 5.95, 26] as V3 },
    shop: { at: [21, 0, 26] as V3, yaw: -Math.PI / 2, scale: 1.2, ring: [12.4, 0, 22.6] as V3, sign: [17.55, 5.95, 26] as V3 },
  },
  /** The teleport station (TeleportStations draws its portal disc 2.75 m up between the pillars). */
  station,
  /** World 2's portal frame (worldPortal(2): x 0, z 62, facing the shaft); its sign over the lintel. */
  portal: { at: [0, 0, 62] as V3, yaw: Math.PI, sign: [0, 7.6, 62] as V3 },
  /** Paving: the plaza, the walk to the shaft, the ring walk round it and the aprons before the services. */
  plaza: { x: [-11, 11] as const, z: [34, 66] as const },
  walk: { halfWidth: 4, z: [14, 34] as const },
  ring: { inner: 8.6, outer: 14 },
  aprons: [[-15, -5, 17, 30], [5, 15, 17, 30]] as readonly (readonly [number, number, number, number])[],
  /** Planters of ore crystals and benches along the plaza's sides: [x, z, kind]. */
  plazaDecor: [[-12.6, 39, 'planter'], [12.6, 39, 'planter'], [-12.6, 47, 'bench'], [12.6, 47, 'bench'], [-12.6, 59, 'planter'], [12.6, 57, 'planter']] as readonly (readonly [number, number, 'planter' | 'bench'])[],
  /** A gantry over the walk between the two buildings, a glowing screen facing the spawn. */
  gantry: { z: 32.5, x: 13, height: 8.4 },
  /** The drill rig standing over the shaft: four legs at its corners, the drill head hanging over the middle. */
  rig: { legs: 10.4, deck: 15 },
  /** The ore line: a conveyor from the rig's east side (x 11) to the silo, along x at z -4. */
  conveyor: { from: 11, to: 27, z: -4, height: 3.2 },
  silo: { at: [30, 0, -4] as V3, radius: 3.2 },
  /** The west yard: a raised deck (1 m, steps on its east and south sides) with tanks, containers and the beacon. */
  deck: { x: [-32, -19] as const, z: [-21, 0] as const, height: 1 },
  tanks: [[-28.5, -16], [-23.5, -16], [-8, -19], [0, -19.5], [8, -19]] as readonly (readonly [number, number])[],
  beacon: [-29, 1, -6] as V3,
  /** Cargo containers: [x, y, z, yaw, colour]. */
  containers: [[-28, 1, -9.5, 1.57, 'Orange'], [-28, 3.5, -9.5, 1.6, 'Navy'], [-22.5, 1, -4, .05, 'Teal'],
    [27.5, 0, 60, .08, 'Orange'], [27.5, 2.5, 60, .04, 'Teal'], [21, 0, 62.5, 1.5, 'Navy'], [-27, 0, 62, -.06, 'Navy'],
    [28.5, 0, 9.5, 1.57, 'Teal'], [-29, 0, 13, 1.5, 'Orange']] as readonly (readonly [number, number, number, number, string])[],
  dome: { at: [-24, 0, 50] as V3, radius: 6.4 },
  module: { at: [24.5, 0, 49] as V3, yaw: -Math.PI / 2 },
  mech: { at: [-22, 0, 8.5] as V3, yaw: 1.2 },
  solar: { x: 22, rows: [-17, -12.5] as readonly number[] },
  /** Lamp posts along the walk and round the plaza: [x, z, yaw]. */
  lamps: [[-5.2, 16.5, 0], [5.2, 16.5, Math.PI], [-11.6, 34.6, 0], [11.6, 34.6, Math.PI],
    [-11.6, 52.5, 0], [11.6, 52.5, Math.PI], [-11.6, 65, 0], [11.6, 65, Math.PI], [-15, -15, 0], [15, -15, Math.PI]] as readonly (readonly [number, number, number])[],
  /** Hazard bollards round the shaft, leaving the four approaches open. */
  bollards: [[-6, -9.3], [6, -9.3], [-6, 9.3], [6, 9.3], [-9.3, -6], [-9.3, 6], [9.3, -6], [9.3, 6]] as readonly (readonly [number, number])[],
} as const;
