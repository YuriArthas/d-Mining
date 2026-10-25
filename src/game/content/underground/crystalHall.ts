import type { HallDefinition, HallLight } from './hall.ts';

/** 水晶洞穴 — the rest hall of world 1's crystal layer (1200 m): a geode cavern. See hall.ts for the frame. */

type Tint = 'cyan' | 'pink' | 'violet';
type HallSpire = Readonly<{ at: readonly [number, number, number]; height: number; tint: Tint; yaw: number }>;
const spire = (x: number, z: number, height: number, tint: Tint, yaw = 0): HallSpire => ({ at: [x, 0, z], height, tint, yaw });

export const CRYSTAL_HALL = {
  id: 'crystal',
  asset: 'crystal-hall',
  size: [40, 20, 40],
  pit: 8,
  spawn: [0, 0, 12],
  stalls: {
    sell: { at: [-12, 0, 15.2], ring: [-12, 0, 11.4] },
  },
  board: [0, 7.6, -17.4],
  /** Giant crystal spires, the hall's landmarks and its main light: four big ones in the floor ring's corners,
   *  smaller ones along the walls. Each is a clump of faceted prisms on a rock foot (unit height, scaled). */
  spires: [
    spire(-13.4, -13.4, 11, 'cyan', .4), spire(13.2, -13.2, 12, 'pink', 1.3),
    spire(-14.6, 2.6, 7.6, 'violet', 2.2), spire(14.6, 1.8, 8, 'cyan', .8),
    spire(-6.6, -15.6, 5.4, 'pink', 1.7), spire(7.2, -15.6, 6, 'violet', 2.5),
    spire(-16.3, -6.8, 4.6, 'pink', .9), spire(16.3, -7.4, 4.4, 'violet', 1.4),
    spire(-16.4, 8.6, 4.2, 'cyan', 2.9), spire(16.5, 8.8, 4.4, 'pink', .2),
    // Behind the spawn, either side of the lantern posts, clear of the camera behind the player.
    spire(-6.8, 17.9, 4.8, 'cyan', 1.1), spire(6.4, 17.9, 4.4, 'violet', 2.3),
  ] as readonly HallSpire[],
  /** A raised geode basin in the north-east: a ring of pale geode stones round a glowing crystal pool. */
  pool: { at: [12.6, 0, -5.6] as const, radius: 2.8 },
  /** An open geode half shell in the south-east corner (where shop layers have their stall): crystals inside. */
  geode: { at: [12.4, 0, 15.6] as const, yaw: Math.PI },
  /** Real-time lights: inside the four big spires, over the sale stall and in the open geode. */
  lights: [
    { at: [-13.4, 6.5, -13.4], color: '#63e8ff', intensity: 130, distance: 30 },
    { at: [13.2, 7, -13.2], color: '#ff7ad8', intensity: 130, distance: 30 },
    { at: [-14.6, 4.6, 2.6], color: '#b48cff', intensity: 75, distance: 22 },
    { at: [14.6, 4.8, 1.8], color: '#66e6ff', intensity: 75, distance: 22 },
    { at: [-12, 3.8, 13.6], color: '#fff0d8', intensity: 60, distance: 18 },
    { at: [12.4, 3, 14.2], color: '#ff8ae0', intensity: 70, distance: 20 },
  ] as readonly HallLight[],
  /** The mood: an icy blue geode. Pale blue sky fill, a violet ground bounce, a cool top light, deep blue fog. */
  look: { sky: '#9cc4ff', ground: '#46407a', ambient: 1.05, key: '#d0e4ff', keyIntensity: .95, fog: '#1a2448' },
} as const;
// Checked against the shared frame without its extra theme data (spires, pool, geode) counting as excess.
CRYSTAL_HALL satisfies HallDefinition;
