import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
/** A pool of lamp light baked into the floor's colour: centre, radius, colour and strength (0-1). */
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });
/** A turning gear on the machine wall: centre, outer radius, teeth, turn rate (centi-radians per second). */
type Gear = Readonly<{ at: readonly [number, number, number]; radius: number; teeth: number; rate: number }>;

/** 巨齿工厂 — world 2's rest hall at 800 m, on the world 2 base kit (see reactorHall.ts). A huge half-buried ancient
 *  machine fills the north wall above the name board: bronze-and-teal gears turning slowly in a slate frame, two
 *  teal power cores standing either side, the colony's white catwalk with a yellow rail clamped across it, and a
 *  yellow jib crane on each side hanging a hazard crate over the floor. Teal power conduits run up the slate rock.
 *  See hall.ts for the frame. */
export const GEAR_HALL = {
  id: 'world2.2',
  asset: 'gear-hall',
  depth: 800,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
    shop: { at: [12, 0, 15.2], ring: [12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  layout: {
    /** The machine frame covers the north wall between x = -half and +half (its rock masses are left out). */
    facade: { z: -19.6, half: 12.8 },
    gears: [
      { at: [-5.6, 12.0, -18.5], radius: 5.0, teeth: 20, rate: 9 },
      { at: [5.4, 13.2, -18.3], radius: 4.2, teeth: 16, rate: -11 },
      { at: [.2, 17.2, -18.7], radius: 2.4, teeth: 10, rate: 19 },
    ] as readonly Gear[],
    /** Power cores stand on the floor before the frame, either side of the gears. */
    cores: [[-10.6, -17.9], [10.6, -17.9]] as readonly XZ[],
    /** The catwalk across the frame, clear in front of the cores: height of its deck, its centre line, half length. */
    catwalk: { y: 8.8, z: -15.3, half: 13.6 },
    /** Jib cranes: foot of the tower and the way the jib points (+1 east, -1 west). */
    cranes: [{ at: [-15.4, -8.6] as XZ, dir: 1 }, { at: [15.4, -8.6] as XZ, dir: -1 }],
    lamps: [[-13, -2], [13, -2], [-13, 6], [13, 6]] as readonly XZ[],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.4, -13, 0], [8.4, -13, Math.PI]] as readonly (readonly [number, number, number])[],
    loop: { half: 10.8, corner: 2.6 },
    pools: [
      pool(0, -14, 9, '#3ed8c8', .45), pool(0, -14.6, 5, '#ffe6c8', .35), pool(-10.6, -14.6, 4.5, '#3ed8c8', .6), pool(10.6, -14.6, 4.5, '#3ed8c8', .6),
      pool(-12, 12.4, 5.2, '#ffe6c8', .6), pool(12, 12.4, 5.2, '#ffe6c8', .6),
      pool(-3.6, 14.6, 3, '#ffd8a8', .4), pool(3.6, 14.6, 3, '#ffd8a8', .4), pool(-8.4, -12.4, 3, '#ffc890', .4), pool(8.4, -12.4, 3, '#ffc890', .4),
      pool(-13, -2, 3.6, '#ffe2b8', .5), pool(13, -2, 3.6, '#ffe2b8', .5), pool(-13, 6, 3.6, '#ffe2b8', .5), pool(13, 6, 3.6, '#ffe2b8', .5),
      pool(0, 11, 5.5, '#fff0e0', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: the machine (teal either side, warm white in the middle), both stalls and a fill over the spawn. */
  lights: [
    { at: [-8, 9, -13], color: '#3ee0d0', intensity: 75, distance: 24 },
    { at: [8, 9.5, -13], color: '#3ee0d0', intensity: 75, distance: 24 },
    { at: [-12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [0, 8, 9], color: '#f2f0ff', intensity: 55, distance: 26 },
    { at: [0, 11.5, -12.5], color: '#fff0dc', intensity: 70, distance: 26 },
  ],
  /** The mood: a neutral fill so white and yellow keep their colour (the teal comes from the machine), a dark
   *  slate floor bounce and a deep blue-grey fog. */
  look: { sky: '#e4e8f0', ground: '#2a3038', ambient: .95, key: '#f4f6ff', keyIntensity: .75, fog: '#0e141c' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
GEAR_HALL satisfies HallDefinition;
