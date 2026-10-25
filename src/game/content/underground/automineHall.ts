import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });
/** 自动化矿道 — world 2's first rest hall (400 m): a near-future mining base built into the cave. World 2's base kit
 *  (the poured floor, lanes, pit rail, white kiosks), a drill machine and conveyors feeding a hopper and a crusher, an ore cart on a rail, two
 *  mining robots, bulkheads and fans on the rock, light trusses under the ceiling, a garage bay where the shop
 *  would stand (this layer has none). The hero is a tunnel boring machine in the north wall above the name board,
 *  its cutterhead turning in a white shield. See hall.ts for the frame. */
export const AUTOMINE_HALL = {
  id: 'world2.1',
  asset: 'automine-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  layout: {
    /** The facade covers the north wall between x = -half and +half (its rock masses are left out); the boring
     *  machine's shield stands in it, centre `y` up. */
    facade: { z: -19.6, half: 9.6 },
    shield: { y: 12.4, z: -18.7 },
    drill: { at: [-13.2, -13.2] as XZ, yaw: Math.PI / 4 },
    /** Conveyors: start point, axis, length; ore rides toward the far end (the hopper, the crusher). */
    conveyors: [
      { from: [9.6, -12.4] as XZ, axis: 'x' as const, length: 5.2, to: 'Ore_Hopper', end: [16.4, -12.4] as XZ },
      { from: [-12.6, -8.4] as XZ, axis: 'z' as const, length: 11.6, to: 'Crusher', end: [-12.6, 5.4] as XZ },
    ],
    rail: { x: 13, from: -7, to: 8.5, cart: -.5 },
    robots: [{ at: [15.6, 6.8] as XZ, yaw: -Math.PI / 2 - .5 }, { at: [-16, -3.6] as XZ, yaw: Math.PI / 2 }],
    garage: [12, 18.2] as XZ,
    /** Bulkheads and fans go on the rock: side 0 north, 1 south, 2 west, 3 east; `d` along the wall. */
    bulkheads: [{ side: 0, d: -13.4 }, { side: 0, d: 13.4 }, { side: 2, d: -10.4 }, { side: 2, d: 9 }, { side: 3, d: -4.4 }, { side: 1, d: -5.6 }],
    fans: [{ side: 0, d: 14, y: 10 }, { side: 2, d: -1, y: 9.5 }, { side: 3, d: 9.5, y: 9.5 }, { side: 1, d: 6, y: 10 }],
    trusses: [-4.5, 4.5, 13.5],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-6.4, -13.6, 0], [6.4, -13.6, Math.PI]] as readonly (readonly [number, number, number])[],
    /** Lamp light baked into the poured floor: the drill bay, the hopper, both conveyors, the stall, the garage,
     *  the lamp posts, the boring machine's glow and the light trusses' strips. */
    pools: [
      pool(-12, -11, 6, '#ffb070', .6), pool(13, -11, 5.5, '#86ecff', .55), pool(-13, 0, 4.5, '#94eaff', .45), pool(13, 1, 4.5, '#94eaff', .45),
      pool(-12, 12.6, 5, '#ffe6c8', .6), pool(12, 15, 4.5, '#ffa850', .55),
      pool(-3.6, 14.6, 3, '#ffd8a8', .4), pool(3.6, 14.6, 3, '#ffd8a8', .4), pool(-6.4, -13, 3, '#ffd8a8', .4), pool(6.4, -13, 3, '#ffd8a8', .4),
      pool(0, -14, 8, '#86ecff', .6), pool(0, -4.5, 6, '#9ae8ff', .25), pool(0, 4.5, 6, '#9ae8ff', .25), pool(0, 12, 5, '#fff0e0', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: the drill bay (orange), the hopper and both conveyor sides (cyan), the stall, the garage. */
  lights: [
    { at: [-11, 6, -11], color: '#ffb070', intensity: 100, distance: 26 },
    { at: [12, 6, -11], color: '#86ecff', intensity: 100, distance: 26 },
    { at: [-13.5, 5, 0], color: '#94eaff', intensity: 75, distance: 22 },
    { at: [13.5, 5, 1], color: '#94eaff', intensity: 75, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffe4c0', intensity: 60, distance: 18 },
    { at: [12, 3.6, 14.6], color: '#ffa850', intensity: 70, distance: 20 },
  ],
  /** The mood: cool steel-blue fill from above, slate below, a deep blue-grey fog. */
  look: { sky: '#b4d0f2', ground: '#3e4654', ambient: 1.05, key: '#dcefff', keyIntensity: .95, fog: '#1c2432' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
AUTOMINE_HALL satisfies HallDefinition;
