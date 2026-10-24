import type { HallDefinition } from './hall.ts';

/** 熔岩矿洞 — the rest hall of world 1's volcanic layer (2400 m). See hall.ts for the frame. */
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
  lights: [
    { at: [-13, 5.5, -13], color: '#ff7a2a', intensity: 130, distance: 30 },
    { at: [13, 5.5, -13], color: '#ff7a2a', intensity: 130, distance: 30 },
    { at: [-15, 4.5, 2], color: '#ff9a40', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#ff9a40', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
  ],
  look: { sky: '#ff9a60', ground: '#4a2418', ambient: 1.0, key: '#ffc8a0', keyIntensity: 0.85, fog: '#2a1210' },
} as const satisfies HallDefinition;
