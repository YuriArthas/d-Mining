import type { HallDefinition } from './hall.ts';

type V3 = readonly [number, number, number];
/** A cluster of hexagonal basalt columns: `height` of its tallest column, `radius` of its footprint. */
type HallColumns = Readonly<{ at: V3; height: number; radius: number; yaw: number }>;
const columns = (x: number, z: number, height: number, yaw = 0): HallColumns => ({ at: [x, 0, z], height, radius: height * .36, yaw });

/** 熔岩矿洞 — the rest hall of world 1's deepest layer (2400 m). See hall.ts for the frame. Cool grey-violet
 *  basalt lit by lava: column clusters stand along the walls, a raised lava pool glows in the north-west and an
 *  ember vent smoulders behind the spawn. */
export const VOLCANIC_HALL = {
  id: 'volcanic',
  asset: 'volcanic-hall',
  depth: 2400,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
    shop: { at: [12, 0, 15.2], ring: [12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  /** Basalt column clusters: the hall's landmarks. The first four are the big ones (kept clear by the walls). */
  columns: [
    columns(13.4, -13.4, 10), columns(-15, -14.6, 7.5, 1.1), columns(15.6, 2.4, 6.5, 2.3), columns(-16.2, 7.6, 5.4, .6),
    columns(6.8, -16.2, 4.4, 2.9), columns(16.4, 8.6, 3.8, 1.7), columns(-7.4, -16.4, 3.6, .3),
  ] as readonly HallColumns[],
  /** A raised lava basin in the north-west; the voxel floor below stays whole. */
  pool: { at: [-12.4, 0, -4] as V3, radius: 3 },
  /** Ember vents: low cones with a glowing crater. The first stands behind the spawn between the lanterns. */
  vents: [{ at: [0, 0, 17.4] as V3, scale: 1.9 }, { at: [16.6, 0, -6.2] as V3, scale: 1.2 }, { at: [-16.8, 0, 1.8] as V3, scale: 1.1 }],
  /** Real-time lights (a fixed pool of six): the lava pool, the big columns, the east wall, both stalls, the vent. */
  lights: [
    { at: [-9.6, 6, -3.2], color: '#ff7a2a', intensity: 120, distance: 30 },
    { at: [9.6, 6.5, -9.6], color: '#ff9a48', intensity: 120, distance: 30 },
    { at: [12, 4.6, 2.4], color: '#ffa850', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [0, 3.2, 16.4], color: '#ff8030', intensity: 70, distance: 22 },
  ],
  /** The mood: violet-grey fill from above, ember red from below, a dark plum fog. */
  look: { sky: '#9ca2d8', ground: '#5a3026', ambient: 1.15, key: '#c8ccff', keyIntensity: 1, fog: '#241a28' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
VOLCANIC_HALL satisfies HallDefinition;
