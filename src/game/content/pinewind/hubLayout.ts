import { SURFACE_FACILITIES, type SurfaceFacility } from '../surfaceFacilities.ts';
import { deriveFacility } from '../../world/deriveFacility.ts';
import { EGG_DISPLAY_ROWS } from '../petAppearance.ts';
import type { Sign } from '../../world/sceneryKit.ts';
import { CAPSULE_MACHINE_AT, CAPSULE_MACHINE_YAW, CHALLENGE_BOARD_AT } from '../feedbackFacilities.ts';

/** Pinewind hub plan for world 1. One source for the playable zones, collision, the
 *  runtime composition and the offline art pipeline (tools/export-pinewind-layout.mjs).
 *  Coordinates: +X east, +Z toward the spawn (south); the mine square spans 8 m either side of the origin. */
const DEG = Math.PI / 180;
const round = (value: number) => Math.round(value * 100) / 100;

export const PINEWIND_SPAWN = { x: 0, z: 46 } as const;
/** Sandy plaza between the mine and the creek. Services, the leaderboard and the bridge open onto it. */
export const PINEWIND_PLAZA = { x: 0, z: 20, radius: 15 } as const;

// Sell and shop flank the mine on opposite sides of the plaza (sell west, shop north-east), each
// turned toward the plaza centre, so from the spawn they read left and right of the headframe and
// never line up one behind the other.
export const PINEWIND_FACILITIES = {
  sale: { ...SURFACE_FACILITIES.sale, anchor: { x: -20.5, z: 14, yaw: 70 * DEG } },
  shop: { ...SURFACE_FACILITIES.shop, anchor: { x: 18.5, z: 11, yaw: -62 * DEG } },
} as const satisfies Record<'sale' | 'shop', SurfaceFacility>;
/** The footbridge over the creek, along the main path (local Z runs along the deck). The deck is one smooth
 *  raised-cosine arch, `rise` metres high in the middle, meeting the path at ground level `halfSpan` metres
 *  either side of the centre; `width` is the boarded deck between its overhanging board ends. */
export const PINEWIND_BRIDGE = { x: 0, z: 36.5, halfSpan: 5.6, rise: 1.15, width: 5.24 } as const;
/** Where the bridge lands on the plaza. */
const BRIDGE_EXIT = { x: 0, z: 30 } as const;
/** Forward offset of each building's visual centre from its anchor (authored GLB bounds). */
const BUILDING = { sale: { forward: 1.1, signY: 5.6 }, shop: { forward: 0, signY: 7 } } as const;

function service(kind: keyof typeof PINEWIND_FACILITIES) {
  const config = PINEWIND_FACILITIES[kind], derived = deriveFacility(config), { x, z, yaw } = config.anchor;
  const forward = BUILDING[kind].forward;
  const center: [number, number, number] = [round(x + Math.sin(yaw) * forward), 1, round(z + Math.cos(yaw) * forward)];
  // Big word floating over the service ring, turned toward the bridge exit so it reads on arrival,
  // across the plaza and from the spawn while staying inside the third-person camera's view.
  const ring = derived.trigger, yawToBridge = Math.atan2(BRIDGE_EXIT.x - ring.x, BRIDGE_EXIT.z - ring.z);
  // The two signs sit at different heights so they never merge when seen together from the spawn.
  const sign: Sign = { ...derived.sign, at: [ring.x, BUILDING[kind].signY, ring.z], yaw: round(yawToBridge), width: 4.2 };
  return { ...derived, sign, center, trigger: { ...derived.trigger, lookAt: center } };
}
export const PINEWIND_SERVICES = { sale: service('sale'), shop: service('shop') } as const;

/** The gate to the next world stands in the pass of the wooded ridge behind the portal ring. */
export const PINEWIND_GATE = { x: 0, z: 69, opening: 8, height: 9.6, wallTo: 14 } as const;

/** Portals ring the spawn: walk south from the spawn to travel, north over the bridge to work. */
const aroundSpawn = (theta: number, radius = 12) => ({
  x: round(PINEWIND_SPAWN.x + Math.sin(theta) * radius),
  z: round(PINEWIND_SPAWN.z + Math.cos(theta) * radius),
  // Face the spawn: local +Z points from the portal back to the ring centre.
  yaw: round(theta + Math.PI),
});
export const PINEWIND_PORTAL_SLOTS: Readonly<Record<string, Readonly<{ x: number; z: number; yaw: number }>>> = {
  old_mine: aroundSpawn(-90 * DEG), fungal: aroundSpawn(-60 * DEG), crystal: aroundSpawn(-30 * DEG),
  ruins: aroundSpawn(30 * DEG), frozen: aroundSpawn(60 * DEG), volcanic: aroundSpawn(90 * DEG),
  // Later legacy layers keep valid outer slots; the live first world has six portals.
  fossil: aroundSpawn(-45 * DEG, 18), machinery: aroundSpawn(45 * DEG, 18), core: aroundSpawn(75 * DEG, 18),
};
export const PINEWIND_PORTAL_RADIUS = 1.6;

/** Three egg terraces facing the plaza. Rows step up 2.2 m and alternate by half a bay,
 *  so the always-on name/price labels never stack. Progression runs north to south and low to high:
 *  front row = early first-world eggs, middle row = late first-world eggs, top row = later worlds. */
export const PINEWIND_EGG_TIERS = [
  { tier: 0, x: 28, y: 0.4 },
  { tier: 1, x: 34, y: 2.6 },
  { tier: 2, x: 40, y: 4.8 },
] as const;
export const PINEWIND_TERRACE = { minZ: 17, maxZ: 43, width: 6, stairs: [15.5, 44.5], stairDepth: 3, maxRiser: 0.3 } as const;
const EGG_ROWS = [
  { tier: 0, z0: 18.5, eggs: ['meadow-egg', 'pebble-egg', 'mushroom-egg', 'crystal-egg', 'copper-egg', 'ruin-egg'] },
  { tier: 1, z0: 24.5, eggs: ['tide-egg', 'frost-egg', 'fire-egg', 'lava-egg'] },
  { tier: 2, z0: 18.5, eggs: ['amber-egg', 'fossil-egg', 'silver-egg', 'gear-egg', 'star-egg', 'core-egg'] },
] as const;
const EGG_LOOKS = new Map<string, { asset: string; color: string }>(EGG_DISPLAY_ROWS.flat().map(row => [row.eggId, row]));
export const PINEWIND_EGG_DISPLAYS = EGG_ROWS.flatMap(row => row.eggs.map((eggId, index) => {
  const tier = PINEWIND_EGG_TIERS[row.tier], look = EGG_LOOKS.get(eggId);
  if (!look) throw Error(`Missing egg look: ${eggId}`);
  return { id: `stand-${eggId}`, eggId, tier: row.tier, x: tier.x, y: tier.y, z: row.z0 + index * 4, yaw: -Math.PI / 2, asset: look.asset, color: look.color };
}));
export type PinewindEggDisplay = (typeof PINEWIND_EGG_DISPLAYS)[number];

/** Side staircases at both terrace ends; each tier's flight rises over its own width. */
export const PINEWIND_STAIR_STEPS = PINEWIND_EGG_TIERS.flatMap((tier, i) => {
  const from = i === 0 ? 0 : PINEWIND_EGG_TIERS[i - 1].y, rise = tier.y - from;
  const count = Math.ceil(rise / PINEWIND_TERRACE.maxRiser - 1e-9), run = PINEWIND_TERRACE.width / count;
  return PINEWIND_TERRACE.stairs.flatMap(z => Array.from({ length: count }, (_, j) => ({
    x: round(tier.x - PINEWIND_TERRACE.width / 2 + (j + 0.5) * run), y: round(from + rise * (j + 1) / count), z,
    width: round(run), depth: PINEWIND_TERRACE.stairDepth,
  })));
});

/** The decorative pet house behind the egg terraces. */
export const PINEWIND_CONSERVATORY = { x: 34, z: 8, yaw: 0, half: [4.5, 3, 3.5] as const };
// "PETS" floats over the pet house, facing the plaza; clear of every egg label.
export const PINEWIND_EGG_SIGN: Sign = { at: [33, 10, 9], yaw: round(Math.atan2(PINEWIND_PLAZA.x - 33, PINEWIND_PLAZA.z - 9)), width: 6, title: 'PETS', subtitle: '', color: '#ffa6ee', background: '#18283d' };
/** Small authored props. Lamps frame the bridge exit; the signpost points the way on arrival. */
export const PINEWIND_PROPS = {
  lamps: [{ x: -5, z: 29.5, yaw: 0 }, { x: 5, z: 29.5, yaw: Math.PI }],
  signpost: { x: -4.5, z: 25 },
  capsule: CAPSULE_MACHINE_AT, capsuleYaw: CAPSULE_MACHINE_YAW, board: CHALLENGE_BOARD_AT,
} as const;

/** Ground plan for the offline landscape: sandy plazas, path ribbons, paving pads and
 *  the areas vegetation must keep clear. Exported to surface-game-art/layout.json. */
const spawnArc = Array.from({ length: 11 }, (_, i) => { const t = (-100 + i * 20) * DEG; return [round(Math.sin(t) * 12), round(46 + Math.cos(t) * 12)]; });
export const PINEWIND_GROUNDS = {
  plazas: [
    PINEWIND_PLAZA,
    { x: PINEWIND_SPAWN.x, z: PINEWIND_SPAWN.z, radius: 4.6 },
    { x: round(CAPSULE_MACHINE_AT[0] + Math.sin(CAPSULE_MACHINE_YAW) * 1.2), z: round(CAPSULE_MACHINE_AT[2] + Math.cos(CAPSULE_MACHINE_YAW) * 1.2), radius: 3.2 }, // capsule machine pad
  ],
  paths: [
    { width: 2.7, points: [[0, 104], [0, 80], [0, 54], [0, 46], [0, 36.5], [0, 26], [0, 16], [0, 8]] },
    { width: 1.9, points: [[13.5, 21], [22, 21], [22, 15.5], [27, 15.5]] },
    { width: 1.9, points: [[22, 21], [22, 44.5], [27, 44.5]] },
    { width: 1.5, points: spawnArc },
  ],
  pads: [[0, 16], [PINEWIND_SERVICES.sale.trigger.x, PINEWIND_SERVICES.sale.trigger.z], [PINEWIND_SERVICES.shop.trigger.x, PINEWIND_SERVICES.shop.trigger.z], [22, 29], [0, 47]],
  keepClear: [
    { kind: 'rect', minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    { kind: 'rect', minX: 20, maxX: 46, minZ: 12, maxZ: 48 },
    { kind: 'rect', minX: -7, maxX: 7, minZ: 30, maxZ: 104 },
    { kind: 'circle', x: PINEWIND_PLAZA.x, z: PINEWIND_PLAZA.z, radius: PINEWIND_PLAZA.radius + .5 },
    { kind: 'circle', x: PINEWIND_SPAWN.x, z: PINEWIND_SPAWN.z, radius: 15.5 },
    { kind: 'circle', x: PINEWIND_SERVICES.sale.center[0], z: PINEWIND_SERVICES.sale.center[2], radius: 7.5 },
    { kind: 'circle', x: PINEWIND_SERVICES.shop.center[0], z: PINEWIND_SERVICES.shop.center[2], radius: 7 },
    { kind: 'rect', minX: -PINEWIND_GATE.wallTo - 1, maxX: PINEWIND_GATE.wallTo + 1, minZ: PINEWIND_GATE.z - 4, maxZ: PINEWIND_GATE.z + 4 },
    { kind: 'circle', x: PINEWIND_CONSERVATORY.x, z: PINEWIND_CONSERVATORY.z, radius: 7 },
    { kind: 'circle', x: CAPSULE_MACHINE_AT[0], z: CAPSULE_MACHINE_AT[2], radius: 4 },
    { kind: 'circle', x: CHALLENGE_BOARD_AT[0], z: CHALLENGE_BOARD_AT[2], radius: 4 },
  ],
} as const;
