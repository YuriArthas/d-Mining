/** 蘑菇洞穴 — the rest hall of world 1's second underground layer (800 m), in hall metres: origin at the room's
 *  floor centre, +X east, +Z toward the spawn side. The voxel room it fills is 40 x 40 m and 20 m high; the
 *  16 m mine pit in the middle stays open voxel floor to dig down from. One source for the offline art build
 *  (tools/build-underground.mjs) and the game (placement, lights, colliders). */

type HallLight = Readonly<{ at: readonly [number, number, number]; color: string; intensity: number; distance: number }>;
type HallMushroom = Readonly<{ at: readonly [number, number, number]; height: number; cap: number; tint: 'teal' | 'violet'; yaw: number }>;

const mushroom = (x: number, z: number, height: number, cap: number, tint: 'teal' | 'violet', yaw = 0): HallMushroom => ({ at: [x, 0, z], height, cap, tint, yaw });

export const FUNGAL_HALL = {
  id: 'fungal',
  asset: 'fungal-hall',
  depth: 800,
  size: [40, 20, 40] as const,
  /** Half width of the open mine pit (matches the shaft, ENTRANCE_WORLD). */
  pit: 8,
  spawn: [0, 0, 12] as const,
  /** Service stalls stand against the south wall, their counters facing the hall (-Z); the rings sit in front. */
  stalls: {
    sell: { at: [-12, 0, 15.2] as const, ring: [-12, 0, 11.4] as const },
    shop: { at: [12, 0, 15.2] as const, ring: [12, 0, 11.4] as const },
  },
  /** The layer's name board hangs on the north wall, facing the spawn across the pit. */
  board: [0, 7.6, -17.4] as const,
  /** Giant glowing mushrooms: the hall's landmarks and its main light. The four big ones stand in the floor
   *  ring's corners; smaller ones grow along the walls and on the rock shelves. */
  mushrooms: [
    mushroom(-13.4, -13.4, 10.5, 4.6, 'teal', .3), mushroom(13.2, -13.2, 11.5, 5, 'violet', 1.2),
    mushroom(-14.6, 2.5, 7.2, 3.3, 'violet', 2.1), mushroom(14.6, 1.8, 7.8, 3.5, 'teal', .7),
    mushroom(-6.5, -15.4, 5.6, 2.5, 'violet', 1.9), mushroom(7.2, -15.6, 6.2, 2.7, 'teal', 2.6),
    mushroom(-16.2, -6.8, 4.6, 2.1, 'teal', .9), mushroom(16.3, -7.4, 4.4, 2, 'violet', 1.4),
    mushroom(-16.4, 8.8, 4.2, 1.9, 'teal', 2.9), mushroom(16.4, 9.2, 4.1, 1.9, 'violet', .2),
    // Behind the spawn, between the two lantern posts, so the south wall has a glow of its own.
    mushroom(0, 17.6, 6.4, 2.8, 'teal', 1.1),
  ] as readonly HallMushroom[],
  /** A glowing pool in the north-east, a raised basin so the voxel floor below stays whole. */
  pool: { at: [12.6, 0, -5.6] as const, radius: 2.7 },
  /** Real-time lights (a fixed pool in the game): under the four big caps, over each stall and over the pool. */
  lights: [
    { at: [-13.4, 6.9, -13.4], color: '#4fe6d0', intensity: 130, distance: 30 },
    { at: [13.2, 7.6, -13.2], color: '#b07cff', intensity: 130, distance: 30 },
    { at: [-14.6, 4.7, 2.5], color: '#a27aff', intensity: 70, distance: 22 },
    { at: [14.6, 5.1, 1.8], color: '#53e0cf', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
  ] as readonly HallLight[],
  /** The mood: a deep indigo cave. Sky/ground fill, a soft violet top light, and the fog the far walls sink into. */
  look: { sky: '#8a90e0', ground: '#3d3560', ambient: 1.05, key: '#b4c0ff', keyIntensity: .9, fog: '#211f3c' },
} as const;
