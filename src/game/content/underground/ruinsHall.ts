import type { HallDefinition } from './hall.ts';

type V3 = readonly [number, number, number];
type HallColumn = Readonly<{ at: V3; broken: boolean; yaw: number }>;
const column = (x: number, z: number, broken: boolean, yaw = 0): HallColumn => ({ at: [x, 0, z], broken, yaw });

/** 地下遗迹 — the rest hall of world 1's ruins layer (1600 m): a buried sandstone temple. See hall.ts for the frame. */
export const RUINS_HALL = {
  id: 'ruins',
  asset: 'ruins-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
    shop: { at: [12, 0, 15.2], ring: [12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  /** Colonnades down the west and east sides of the floor ring, some columns snapped off. */
  columns: [
    column(-14.6, -11, false, .2), column(-14.6, -3, false, 1.1), column(-14.6, 5, true, 2.3),
    column(14.6, -11, true, .7), column(14.6, -3, false, 2.9), column(14.6, 5, false, .4),
  ] as readonly HallColumn[],
  /** Fallen drums at the broken columns' feet: [x, z, yaw]. */
  drums: [[-12.6, 7.4, .5], [12.4, -8.6, 1.3]] as readonly V3[],
  /** The temple gate frames the name board; two guardian heads flank it, braziers burn before it. */
  guardians: [[-10.6, -15.4, .15], [10.6, -15.4, -.15]] as readonly V3[],
  braziers: [[-7.6, -14.2], [7.6, -14.2], [0, 17.2]] as readonly (readonly [number, number])[],
  /** Real-time lights: the gate braziers, the jade glyph bands of the two middle columns, the stall lanterns. */
  lights: [
    { at: [-7.6, 3.4, -14.2], color: '#ffb45c', intensity: 95, distance: 26 },
    { at: [7.6, 3.4, -14.2], color: '#ffb45c', intensity: 95, distance: 26 },
    { at: [-14, 4.6, -3], color: '#6ff0c0', intensity: 50, distance: 20 },
    { at: [14, 4.6, -3], color: '#6ff0c0', intensity: 50, distance: 20 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 65, distance: 20 },
    { at: [12, 3.8, 13.6], color: '#ffc27a', intensity: 65, distance: 20 },
  ],
  /** The mood: warm sand light from above, a jade-tinted shadow, a dusty umber fog. */
  look: { sky: '#f2dcae', ground: '#4e5a44', ambient: 1.05, key: '#ffe8c4', keyIntensity: .9, fog: '#2e2a20' },
} as const;
// Checked against the shared frame without its extra theme data (columns, guardians...) counting as excess.
RUINS_HALL satisfies HallDefinition;
