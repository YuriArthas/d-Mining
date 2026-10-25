import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
/** A pool of lamp light baked into the floor's colour: centre, radius, colour and strength (0-1). */
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });
/** A landmark on the floor: position and yaw (its front, local +Z, turned by yaw). */
type Spot = readonly [number, number, number];

/** 遗迹勘探站 — world 2's rest hall at 1600 m, on the world 2 base kit (techKit): the colony has found an ancient
 *  temple half sunk in the rock and set up a survey station in front of it. The hero is the temple front on the
 *  north wall: chunky sandstone courses between two pylons with cyan slits, teal banners, and a round glyph door
 *  above the name board whose golden glyph slowly turns. Two great seated statues stand in the north corners,
 *  sandstone pillars (one broken) along the side walls, white survey scaffolds and yellow lamp towers between
 *  them, gold veins in the warm brown rock. See hall.ts for the frame. */
export const SURVEY_HALL = {
  id: 'world2.4',
  asset: 'survey-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
    shop: { at: [12, 0, 15.2], ring: [12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  layout: {
    /** The temple front covers the north wall between x = -half and +half (its rock masses are left out). */
    facade: { z: -19.6, half: 9.6 },
    /** The glyph door: centre and the ring's outer radius. */
    door: { at: [0, 12.6, -18.6] as const, radius: 6 },
    statues: [[-13.6, -15.4, .4], [13.6, -15.4, -.4]] as readonly Spot[],
    /** Sandstone pillars: whole, then broken. */
    pillars: [[-16.4, -7, .3], [16.4, -7, 2.1]] as readonly Spot[],
    broken: [[-16.4, 5.6, 1.2], [16.4, 5.6, -.8]] as readonly Spot[],
    scaffolds: [[-15.4, -1, Math.PI / 2], [15.4, -1, -Math.PI / 2]] as readonly Spot[],
    towers: [[-10.6, -16.6, .3], [10.6, -16.6, -.3], [-15.8, 10.6, Math.PI / 2], [15.8, 10.6, -Math.PI / 2]] as readonly Spot[],
    /** Ceiling lamps over the floor ring, each with a light cone. */
    lamps: [[-12.6, -3.6], [12.6, -3.6], [-12.6, 6], [12.6, 6]] as readonly XZ[],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.4, -13, 0], [8.4, -13, Math.PI]] as readonly (readonly [number, number, number])[],
    /** The painted lane loop round the pit (half size, corner radius) and the floor's lamp light. */
    loop: { half: 10.8, corner: 2.6 },
    pools: [
      pool(0, -13.5, 9, '#ffb848', .9), pool(-13, -12.5, 5, '#ffc870', .55), pool(13, -12.5, 5, '#ffc870', .55),
      pool(-12, 12.4, 5.2, '#ffe6c8', .6), pool(12, 12.4, 5.2, '#ffe6c8', .6),
      pool(-3.6, 14.6, 3, '#ffd8a8', .4), pool(3.6, 14.6, 3, '#ffd8a8', .4), pool(-8.4, -12.4, 3, '#ffc890', .4), pool(8.4, -12.4, 3, '#ffc890', .4),
      pool(-12.6, -3.6, 3.6, '#ffe2b8', .5), pool(12.6, -3.6, 3.6, '#ffe2b8', .5), pool(-12.6, 6, 3.6, '#ffe2b8', .5), pool(12.6, 6, 3.6, '#ffe2b8', .5),
      pool(-14.6, 10.6, 3.2, '#ffe0a0', .45), pool(14.6, 10.6, 3.2, '#ffe0a0', .45),
      pool(0, 11, 5.5, '#fff0e0', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: the glyph door, both statues, both stalls and a soft fill over the spawn. */
  lights: [
    { at: [0, 10, -12.5], color: '#ffc468', intensity: 120, distance: 30 },
    { at: [-12, 7, -11.5], color: '#ffc870', intensity: 80, distance: 22 },
    { at: [12, 7, -11.5], color: '#ffc870', intensity: 80, distance: 22 },
    { at: [-12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [0, 8, 9], color: '#f2f0ff', intensity: 55, distance: 26 },
  ],
  /** The mood: a neutral fill from above so the white and yellow blocks keep their colour (the gold comes from the
   *  door, the statues' lamps and the veins), a warm brown floor bounce and a deep warm brown fog. */
  look: { sky: '#e6e4ea', ground: '#3e2e22', ambient: .95, key: '#fff4e4', keyIntensity: .75, fog: '#1e140e' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
SURVEY_HALL satisfies HallDefinition;
