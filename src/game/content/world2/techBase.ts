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
} as const;
