import { STATION_LOCAL } from '../worldJourney.ts';

/** 第二世界 surface: a near-future mining base on a dusty plateau. Local metres: origin at the mine shaft's centre
 *  (world z 224), +Z toward the spawn plaza (spawn at z 46) and the gate to world 3 (z 69); world 1's gate is at
 *  z -155. One source for the offline art build (surface-game-art/tools/underground/techBaseHall.ts) and the game
 *  (placement, service rings, signs, colliders). The shaft (|x|, |z| < 8) stays open, its lid is JourneyGates'. */
type V3 = readonly [number, number, number];
const station = { x: STATION_LOCAL.x, z: STATION_LOCAL.z, yaw: Math.atan2(-STATION_LOCAL.x, 46 - STATION_LOCAL.z) };

export const TECH_BASE = {
  asset: 'tech-base',
  worldZ: 224,
  /** Service kiosks behind their rings, fronts toward the spawn (+Z); rings match the session's zones. */
  kiosks: {
    sell: { at: [-16, 0, 39.6] as V3, ring: [-16, 0, 44] as V3 },
    shop: { at: [16, 0, 39.6] as V3, ring: [16, 0, 44] as V3 },
  },
  /** The teleport station (TeleportStations draws its portal disc 2.75 m up between the pillars). */
  station,
  /** The plaza in front of the spawn, the ring path round the shaft and the walk south to world 1's gate. */
  plaza: { x: [-30, 30] as const, z: [24, 64] as const },
  ring: { inner: 8.6, outer: 18 },
  southWalk: { halfWidth: 5, to: -150 },
  /** The drill rig standing over the shaft: four legs at its corners, the drill head hanging over the middle. */
  rig: { legs: 10.4, deck: 15 },
  /** The ore line: a conveyor from the rig's east side (x 11) to the silo, along x at z -4. */
  conveyor: { from: 11, to: 27, z: -4, height: 3.2 },
  silo: { at: [30, 0, -4] as V3, radius: 3.2 },
  /** Wind turbines on the plateau, rotors facing the base: [x, z, yaw]. */
  turbines: [[-58, -46, .35], [52, -78, -.25], [-82, -6, .55]] as readonly (readonly [number, number, number])[],
  solar: { x: -40, rows: [-14, -8, -2, 4, 10, 16] as readonly number[] },
  dome: { at: [40, 0, 12] as V3, radius: 6.4 },
  module: { at: [43, 0, 32] as V3, yaw: Math.PI / 2 },
  /** Cargo containers: [x, y, z, yaw, colour]. */
  containers: [[34, 0, 52, .1, 'Orange'], [34, 2.6, 52, .05, 'Navy'], [41, 0, 58, 1.4, 'Teal'], [-36, 0, 50, -.2, 'Navy'], [-39, 0, 57, .3, 'Orange']] as readonly (readonly [number, number, number, number, string])[],
  mech: { at: [-22, 0, 18] as V3, yaw: .6 },
  antenna: [-34, 0, -26] as V3,
  /** Lamp posts round the plaza and along the walk south: [x, z, yaw]. */
  lamps: [[-28, 26, 0], [28, 26, Math.PI], [-28, 62, 0], [28, 62, Math.PI], [-9, 25, 0], [9, 25, Math.PI],
    ...[-35, -60, -85, -110, -135].flatMap(z => [[-6.5, z, 0], [6.5, z, Math.PI]] as const)] as readonly (readonly [number, number, number])[],
  /** Hazard bollards round the shaft, leaving the four approaches open. */
  bollards: [[-6, -9.3], [6, -9.3], [-6, 9.3], [6, 9.3], [-9.3, -6], [-9.3, 6], [9.3, -6], [9.3, 6]] as readonly (readonly [number, number])[],
} as const;
