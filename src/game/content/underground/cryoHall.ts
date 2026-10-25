import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
/** A pool of lamp light baked into the floor's colour: centre, radius, colour and strength (0-1). */
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });

/** 冰封实验室 — world 2's rest hall at 2000 m, on the world 2 base kit (techKit): the colony's cold lab dug into
 *  an ice cave. A frozen waterfall glows pale cyan down the north wall behind the name board, two giant ice pillars
 *  flank it with warm heater capsules at their feet, white insulated pods with orange bands stand along the side
 *  walls (and where a shop would be, this layer has none), frosted pipes run into the ice, icicles and glowing
 *  cracks in the walls. The cave stays dark: the light is the falls' cyan and the heaters' amber.
 *  See hall.ts for the frame. */
export const CRYO_HALL = {
  id: 'world2.5',
  asset: 'cryo-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  layout: {
    /** The frozen waterfall: its columns span x = -half..half against the north wall (rock masses left out). */
    falls: { half: 5.6, z: -19.1, top: 17 },
    pillars: [[-12.6, -14.2], [12.6, -14.2]] as readonly XZ[],
    /** Heater capsules (glowing amber glass in a yellow frame), [x, z, yaw]. */
    heaters: [[-6.4, -16.4, 0], [6.4, -16.4, 0], [-15.6, -3.8, Math.PI / 2], [15.6, -3.8, -Math.PI / 2], [9.4, 16.2, Math.PI], [15.6, 12.2, -Math.PI / 2]] as readonly (readonly [number, number, number])[],
    /** Insulated pods [x, z, yaw] (front +Z turned by yaw); the last stands in the shop's place. */
    pods: [[-15.4, -7.4, Math.PI / 2], [15.4, -7.4, -Math.PI / 2], [13, 16, Math.PI]] as readonly (readonly [number, number, number])[],
    lamps: [[-13, -1.5], [13, -1.5], [-13, 6.5], [13, 6.5]] as readonly XZ[],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.4, -13, 0], [8.4, -13, Math.PI]] as readonly (readonly [number, number, number])[],
    loop: { half: 10.8, corner: 2.6 },
    pools: [
      pool(0, -14.5, 8.5, '#58d4ff', .85), pool(-6.4, -15.6, 3.2, '#ffa456', .55), pool(6.4, -15.6, 3.2, '#ffa456', .55),
      pool(-14.6, -3.8, 2.8, '#ffa456', .45), pool(14.6, -3.8, 2.8, '#ffa456', .45),
      pool(-12, 12.4, 5.2, '#ffe6c8', .6), pool(11.6, 14.4, 5, '#ffc890', .55),
      pool(-13.4, -7.4, 3.2, '#ffc890', .4), pool(13.4, -7.4, 3.2, '#ffc890', .4),
      pool(-3.6, 14.6, 3, '#ffd8a8', .4), pool(3.6, 14.6, 3, '#ffd8a8', .4), pool(-8.4, -12.4, 3, '#ffd8a8', .35), pool(8.4, -12.4, 3, '#ffd8a8', .35),
      pool(-13, -1.5, 3.6, '#e8f4ff', .45), pool(13, -1.5, 3.6, '#e8f4ff', .45), pool(-13, 6.5, 3.6, '#e8f4ff', .45), pool(13, 6.5, 3.6, '#e8f4ff', .45),
      pool(0, 11, 5.5, '#eef4ff', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: the falls, the heaters by the board, the stall, the east pod and a cool fill over the spawn. */
  lights: [
    { at: [0, 8, -13.5], color: '#5cd2ff', intensity: 140, distance: 30 },
    { at: [-7, 3.6, -14], color: '#ffa050', intensity: 55, distance: 15 },
    { at: [7, 3.6, -14], color: '#ffa050', intensity: 55, distance: 15 },
    { at: [-12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [12, 4, 13.2], color: '#ffb878', intensity: 55, distance: 18 },
    { at: [0, 8, 9], color: '#e8f0ff', intensity: 50, distance: 26 },
  ],
  /** The mood: a cool neutral fill so the white and yellow blocks keep their colour, a dark blue bounce from the
   *  floor and a deep navy fog the ice sinks into. */
  look: { sky: '#d4e2f2', ground: '#22303e', ambient: .9, key: '#eef6ff', keyIntensity: .7, fog: '#0c1626' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
CRYO_HALL satisfies HallDefinition;
