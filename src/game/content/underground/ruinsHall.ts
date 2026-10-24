import type { HallDefinition } from './hall.ts';

/** 地下遗迹 — the rest hall of world 1's ruins layer (1600 m). See hall.ts for the frame. */
export const RUINS_HALL = {
  id: 'ruins',
  asset: 'ruins-hall',
  depth: 1600,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
    shop: { at: [12, 0, 15.2], ring: [12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  lights: [
    { at: [-13, 5.5, -13], color: '#ffb45c', intensity: 120, distance: 28 },
    { at: [13, 5.5, -13], color: '#ffb45c', intensity: 120, distance: 28 },
    { at: [-15, 4.5, 2], color: '#6ff0b0', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#6ff0b0', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
  ],
  look: { sky: '#e0c890', ground: '#5a4a30', ambient: 1.0, key: '#ffe4b0', keyIntensity: 0.85, fog: '#2a2216' },
} as const satisfies HallDefinition;
