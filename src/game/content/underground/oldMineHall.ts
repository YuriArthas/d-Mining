import type { HallDefinition } from './hall.ts';

/** 老矿井 — the rest hall of world 1's first underground layer (400 m): a warm timber mine. See hall.ts for the
 *  frame. */
export const OLD_MINE_HALL = {
  id: 'old_mine',
  asset: 'old-mine-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  /** Landmarks and props, in hall metres (x, z) with their turn. */
  layout: {
    /** Hoist headframes in the north corners, facing the pit. */
    hoists: [{ at: [-13, -12.6], yaw: Math.PI / 4 }, { at: [13, -12.6], yaw: -Math.PI / 4 }],
    /** Timber support sets against the walls, facing in. */
    timberSets: [
      { at: [-16.6, -4.5], yaw: Math.PI / 2 }, { at: [-16.6, 4.5], yaw: Math.PI / 2 },
      { at: [16.6, -4.5], yaw: -Math.PI / 2 }, { at: [16.6, 4.5], yaw: -Math.PI / 2 },
      { at: [0, 17.3], yaw: Math.PI },
    ],
    /** Rail track along the floor ring's sides (z from..to) and the carts standing on it. */
    tracks: [{ x: -12.8, from: -9, to: 7 }, { x: 12.8, from: -7, to: 13 }],
    carts: [[-12.8, -4.4], [-12.8, 2.6], [12.8, 1.2], [12.8, 10.8]],
    /** The cart depot's ore pile in the south-east, where the shop stands on other layers. */
    depot: [15.2, 15.2],
    depotProps: [
      { name: 'Crate_Stack', at: [9.6, 16.6], yaw: .2 },
      { name: 'Barrel_Group', at: [16.4, 11.2], yaw: 1.1 },
      { name: 'Sack_Pile', at: [11.6, 17.2], yaw: 2.4 },
    ],
    lanterns: [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-6.6, -13.2, 0], [6.6, -13.2, Math.PI]],
  },
  /** Real-time lights: the hoists' lanterns, the timber sets along the sides, the stall and the depot. */
  lights: [
    { at: [-12.2, 8, -11.6], color: '#ffb45a', intensity: 125, distance: 30 },
    { at: [12.2, 8, -11.6], color: '#ffb45a', intensity: 125, distance: 30 },
    { at: [-14.6, 5.4, 0], color: '#ffc27a', intensity: 80, distance: 22 },
    { at: [14.6, 5.4, 0], color: '#ffc27a', intensity: 80, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#ffc27a', intensity: 65, distance: 18 },
    { at: [11.5, 4.6, 14], color: '#ffb866', intensity: 80, distance: 20 },
  ],
  /** The mood: warm lamplit timber and earth, a brown haze in the far corners. */
  look: { sky: '#eec29a', ground: '#604634', ambient: 1.05, key: '#ffdcae', keyIntensity: .9, fog: '#36261b' },
} as const;
// Checked against the shared frame without its extra theme data (layout) counting as excess.
OLD_MINE_HALL satisfies HallDefinition;
