import type { HallDefinition } from './hall.ts';

/** 冰封矿洞 — the rest hall of world 1's frozen layer (2000 m). See hall.ts for the frame. */
export const FROZEN_HALL = {
  id: 'frozen',
  asset: 'frozen-hall',
  depth: 2000,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  lights: [
    { at: [-13, 6, -13], color: '#8fe0ff', intensity: 120, distance: 30 },
    { at: [13, 6, -13], color: '#8fe0ff', intensity: 120, distance: 30 },
    { at: [-15, 4.5, 2], color: '#a8ecff', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#a8ecff', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffb878', intensity: 60, distance: 18 },
    { at: [0, 4, 15], color: '#ffb878', intensity: 60, distance: 18 },
  ],
  look: { sky: '#b0d4ff', ground: '#4a6080', ambient: 1.05, key: '#dceeff', keyIntensity: 0.95, fog: '#1e2c40' },
} as const satisfies HallDefinition;
