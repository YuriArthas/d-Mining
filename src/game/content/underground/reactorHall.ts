import type { HallDefinition } from './hall.ts';

type XZ = readonly [number, number];
/** A pool of lamp light baked into the floor's colour: centre, radius, colour and strength (0-1). */
type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;
const pool = (x: number, z: number, radius: number, color: string, strength: number): Pool => ({ at: [x, z], radius, color, strength });

/** 地心反应堆 — world 2's deepest rest hall (2400 m), the style sample for the world 2 base kit: one smooth poured
 *  floor with painted lanes and lamp light baked into it, a yellow rail round the pit, white-and-yellow kiosks
 *  with icon screens. The hero is the planet's molten core set into the north wall above the name board, held by
 *  a white reactor ring and four yellow clamps; cooling towers flank it and red-hot seams crack the charcoal rock.
 *  Glow is faked for phones: soft additive halos, light cones and floor reflections, no post-processing.
 *  See hall.ts for the frame. */
export const REACTOR_HALL = {
  id: 'world2.6',
  asset: 'reactor-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  /** Where a shop stall would stand: crates (only layers 2 and 4 have a shop, 2026-10-29). */
  spare: [12, 0, 15.2] as const,
  board: [0, 7.6, -17.4],
  layout: {
    /** The molten core: centre and radius; it sits half in the reactor facade on the north wall. */
    core: { at: [0, 12.6, -19] as const, radius: 4.6 },
    /** The facade covers the north wall between x = -half and +half (its rock masses are left out). */
    facade: { z: -19.6, half: 9.6 },
    towers: [[-13, -15.6], [13, -15.6]] as readonly XZ[],
    /** Ceiling lamps over the floor ring, each with a light cone. */
    lamps: [[-13, -3], [13, -3], [-13, 6], [13, 6]] as readonly XZ[],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.4, -13, 0], [8.4, -13, Math.PI]] as readonly (readonly [number, number, number])[],
    /** The painted lane loop round the pit (half size, corner radius) and the floor's lamp light. */
    loop: { half: 10.8, corner: 2.6 },
    pools: [
      pool(0, -13.5, 9, '#ff7a2c', .95), pool(-13, -12.5, 5, '#ff8c40', .6), pool(13, -12.5, 5, '#ff8c40', .6),
      pool(-12, 12.4, 5.2, '#ffe6c8', .6), pool(12, 12.4, 5.2, '#ffe6c8', .6),
      pool(-3.6, 14.6, 3, '#ffd8a8', .4), pool(3.6, 14.6, 3, '#ffd8a8', .4), pool(-8.4, -12.4, 3, '#ffc890', .4), pool(8.4, -12.4, 3, '#ffc890', .4),
      pool(-13, -3, 3.6, '#ffe2b8', .5), pool(13, -3, 3.6, '#ffe2b8', .5), pool(-13, 6, 3.6, '#ffe2b8', .5), pool(13, 6, 3.6, '#ffe2b8', .5),
      pool(0, 11, 5.5, '#fff0e0', .35),
    ] as readonly Pool[],
  },
  /** Real-time lights: the core, both cooling towers, the stall and the crates in the spare place, a soft fill over
   *  the spawn. */
  lights: [
    { at: [0, 10, -12.5], color: '#ff6a1e', intensity: 170, distance: 32 },
    { at: [-12.5, 6, -12], color: '#ff8a3a', intensity: 80, distance: 20 },
    { at: [12.5, 6, -12], color: '#ff8a3a', intensity: 80, distance: 20 },
    { at: [-12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.4], color: '#fff0dc', intensity: 60, distance: 18 },
    { at: [0, 8, 9], color: '#f2f0ff', intensity: 55, distance: 26 },
  ],
  /** The mood: a neutral fill from above so the white and yellow blocks keep their colour (the orange comes from
   *  the core, the towers and the seams), a dark warm floor bounce and a deep charcoal-red fog. */
  look: { sky: '#e4e6ee', ground: '#3a2c28', ambient: .95, key: '#fff4e8', keyIntensity: .75, fog: '#1a0e0c' },
} as const;
// Checked against the shared frame without its extra theme data counting as excess.
REACTOR_HALL satisfies HallDefinition;
