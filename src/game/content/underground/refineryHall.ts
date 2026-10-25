import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
/** A pool of lamp light baked into the floor's colour: centre, radius, colour and strength (0-1). */
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });
const MAGENTA = '#d050e8', VIOLET = '#a860f0', WARM = '#ffd8a8';

/** 水晶精炼厂 — world 2's rest hall at 1200 m, on the world 2 base kit (techKit.ts): deep indigo rock where the
 *  colony harvests giant magenta crystals. Two giant crystals in yellow cradles stand in the north corners, each
 *  cut by a white laser rig's beam; crystal tanks line the west wall and stand where a shop would be in the
 *  south-east; crystal clusters grow out of the rock and along the wall feet. Sale only (no shop). See hall.ts. */
export const REFINERY_HALL = {
  id: 'world2.3',
  asset: 'refinery-hall',
  depth: 1200,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  layout: {
    /** Giant crystals in their cradles (base centre, height scale, yaw). */
    giants: [{ at: [-14.2, -14.2] as XZ, scale: 1.2, yaw: .4 }, { at: [14.4, -13.8] as XZ, scale: 1.08, yaw: 2.1 }],
    /** Laser rigs on the floor; each beams at the giant of the same index. */
    rigs: [[-16, -6.4], [16, -6.2]] as readonly XZ[],
    /** Crystal tanks: centre and yaw (front toward the hall). */
    tanks: [[-16.3, .2, Math.PI / 2], [-16.3, 4.6, Math.PI / 2], [10.6, 16.6, Math.PI], [14.6, 16.6, Math.PI]] as readonly (readonly [number, number, number])[],
    carts: [[16.2, 2.6, .2], [-13.4, 8.4, 1.4]] as readonly (readonly [number, number, number])[],
    lamps: [[-13, -3], [13, -3], [-12.5, 5.5], [12.5, 6.5]] as readonly XZ[],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.4, -13, 0], [8.4, -13, Math.PI]] as readonly (readonly [number, number, number])[],
    loop: { half: 10.8, corner: 2.6 },
    pools: [
      pool(-13.8, -13.2, 7.5, MAGENTA, .85), pool(13.8, -12.8, 7.5, MAGENTA, .85),
      pool(-14.8, 2.4, 5, VIOLET, .55), pool(12.6, 15, 4.6, VIOLET, .55),
      pool(-12, 12.4, 5.2, '#ffe6c8', .6),
      pool(-3.6, 14.6, 3, WARM, .4), pool(3.6, 14.6, 3, WARM, .4), pool(-8.4, -12.4, 3, WARM, .4), pool(8.4, -12.4, 3, WARM, .4),
      pool(-13, -3, 3.6, '#ffe2b8', .5), pool(13, -3, 3.6, '#ffe2b8', .5), pool(-12.5, 5.5, 3.6, '#ffe2b8', .5), pool(12.5, 6.5, 3.6, '#ffe2b8', .5),
      pool(0, 11, 5.5, '#fff0e0', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: both giants, the west tanks, the stall, the south-east tanks and a fill over the spawn. */
  lights: [
    { at: [-12, 6, -12], color: '#c050ff', intensity: 80, distance: 24 },
    { at: [12, 6, -12], color: '#c050ff', intensity: 80, distance: 24 },
    { at: [-13.5, 4, 2.4], color: '#b868ff', intensity: 70, distance: 18 },
    { at: [-12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [12.6, 4, 13.6], color: '#b868ff', intensity: 60, distance: 18 },
    { at: [0, 8, 9], color: '#f2f0ff', intensity: 55, distance: 26 },
  ],
  /** The mood: a neutral fill so white and yellow keep their colour (the magenta comes from the crystals), a dark
   *  indigo floor bounce and a deep indigo fog. */
  look: { sky: '#e4e6ee', ground: '#2a2238', ambient: .95, key: '#f6f2ff', keyIntensity: .75, fog: '#140e22' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
REFINERY_HALL satisfies HallDefinition;
