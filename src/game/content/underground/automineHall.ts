import type { HallDefinition } from './hall.ts';

/** 自动化矿道 — world 2's first rest hall (400 m): a mining base built into the cave. See hall.ts for the frame. */
export const AUTOMINE_HALL = {
  id: 'world2.1',
  asset: 'automine-hall',
  depth: 400,
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  lights: [
    { at: [-13, 6, -13], color: '#5ee8ff', intensity: 110, distance: 28 },
    { at: [13, 6, -13], color: '#ffa040', intensity: 110, distance: 28 },
    { at: [-15, 4.5, 2], color: '#7ae6ff', intensity: 70, distance: 22 },
    { at: [15, 4.5, 2], color: '#7ae6ff', intensity: 70, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#d8f4ff', intensity: 60, distance: 18 },
    { at: [0, 4, 15], color: '#ffb060', intensity: 60, distance: 18 },
  ],
  look: { sky: '#a8c8f0', ground: '#3a4250', ambient: 1.05, key: '#d8ecff', keyIntensity: .95, fog: '#1a2230' },
} as const satisfies HallDefinition;
