import type { HallDefinition } from './hall.ts';

/** 冰封矿洞 — the rest hall of world 1's frozen layer (2000 m). See hall.ts for the frame. */

type IceSpire = Readonly<{ at: readonly [number, number, number]; height: number; yaw: number }>;
const spire = (x: number, z: number, height: number, yaw = 0): IceSpire => ({ at: [x, 0, z], height, yaw });

export const FROZEN_HALL = {
  id: 'frozen',
  asset: 'frozen-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  /** Glowing ice formations: the hall's landmarks and its cold light. The four big ones stand in the floor
   *  ring's corners; smaller ones along the walls and one behind the spawn. */
  spires: [
    spire(-13.4, -13.4, 10.5, .3), spire(13.6, -14, 11.2, 1.2),
    spire(-14.8, 2.6, 7.4, 2.1), spire(15.4, 5, 6.8, .7),
    spire(-6.5, -15.6, 5.2, 1.9), spire(7, -15.8, 5.8, 2.6),
    spire(-16.3, -6.8, 4.4, .9), spire(-16.4, 8.8, 4, 2.9),
    spire(0, 17.6, 5.6, 1.1),
  ] as readonly IceSpire[],
  /** A frozen waterfall pours down the east wall into a frozen pond. */
  waterfall: { z: -5.6, width: 6.4, top: 13 },
  pond: { at: [12.4, 0, -5.6] as const, radius: 2.7 },
  /** Warm corners: a campfire with log seats by the sale stall, an igloo with a laden sled in the south-east. */
  campfire: [-6.6, 0, 13.4] as const,
  igloo: [12.6, 0, 15.2] as const,
  /** Real-time lights: under the two big ice formations, the waterfall, the west formation, campfire and igloo. */
  lights: [
    { at: [-13.4, 7, -13.4], color: '#8fe8ff', intensity: 125, distance: 30 },
    { at: [13.6, 7.4, -14], color: '#9fd8ff', intensity: 125, distance: 30 },
    { at: [14.6, 5.5, -5.6], color: '#7ff0ff', intensity: 95, distance: 24 },
    { at: [-14.8, 4.8, 2.6], color: '#b8ecff', intensity: 70, distance: 22 },
    { at: [-6.6, 2.4, 13.4], color: '#ffad5c', intensity: 85, distance: 20 },
    { at: [12, 3.4, 12.6], color: '#ffc890', intensity: 60, distance: 18 },
  ],
  /** The mood: a cold blue cave, bright on top with a steel-blue fog. */
  look: { sky: '#b4d8ff', ground: '#4a6282', ambient: 1.05, key: '#dceeff', keyIntensity: .95, fog: '#22344c' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
FROZEN_HALL satisfies HallDefinition;
