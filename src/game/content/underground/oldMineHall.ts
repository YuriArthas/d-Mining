import type { HallDefinition } from './hall.ts';

/** 老矿井 — the rest hall of world 1's old_mine layer (400 m). See hall.ts for the frame. */
export const OLD_MINE_HALL = {
  id: 'old_mine',
  asset: 'old-mine-hall',
  depth: 400,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  lights: [
    { at: [-13, 5.5, -13], color: '#ffb05a', intensity: 110, distance: 28 },
    { at: [13, 5.5, -13], color: '#ffb05a', intensity: 110, distance: 28 },
    { at: [-15, 4.5, 2], color: '#ffc27a', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#ffc27a', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 60, distance: 18 },
    { at: [0, 4, 15], color: '#ffc27a', intensity: 60, distance: 18 },
  ],
  look: { sky: '#e0b48a', ground: '#5a4030', ambient: 1.0, key: '#ffd9a8', keyIntensity: 0.85, fog: '#2e2018' },
} as const satisfies HallDefinition;
