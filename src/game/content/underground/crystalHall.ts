import type { HallDefinition } from './hall.ts';

/** 水晶洞穴 — the rest hall of world 1's crystal layer (1200 m). See hall.ts for the frame. */
export const CRYSTAL_HALL = {
  id: 'crystal',
  asset: 'crystal-hall',
  depth: 1200,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  lights: [
    { at: [-13, 6, -13], color: '#5ee8ff', intensity: 130, distance: 30 },
    { at: [13, 6, -13], color: '#ff7ad8', intensity: 130, distance: 30 },
    { at: [-15, 4.5, 2], color: '#ff86de', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#66e6ff', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [0, 4, 15], color: '#9ad8ff', intensity: 60, distance: 18 },
  ],
  look: { sky: '#8ab0f0', ground: '#3a3a6a', ambient: 1.05, key: '#b8d4ff', keyIntensity: 0.9, fog: '#1a2140' },
} as const satisfies HallDefinition;
