import { deriveFacility, type SurfaceFacility } from '../../world/deriveFacility.ts';
import { eggColor, eggsOfWorld } from '../eggStands.ts';
import type { Sign } from '../../world/sceneryKit.ts';
import { CAPSULE_MACHINE_AT, CAPSULE_MACHINE_YAW } from '../feedbackFacilities.ts';
import { worldStation } from '../worldJourney.ts';

import { tr } from '../../i18n/i18n.ts';
/** Pinewind hub plan for world 1. One source for the playable zones, collision, the
 *  runtime composition and the offline art pipeline (tools/export-pinewind-layout.mjs).
 *  Coordinates: +X east, +Z toward the spawn (south); the mine square spans 8 m either side of the origin. */
const DEG = Math.PI / 180;
const round = (value: number) => Math.round(value * 100) / 100;

export const PINEWIND_SPAWN = { x: 0, z: 46 } as const;
/** Sandy plaza between the mine and the creek. The shops and the bridge open onto it. */
export const PINEWIND_PLAZA = { x: 0, z: 20, radius: 15 } as const;

// The sell house stands north-east of the plaza, between the headframe and the egg terraces, turned a little
// south toward the arriving player so a walkway stays open past the terrace stairs to the capsule machine.
// The two shops stand side by side on the west, each facing the plaza centre: the forge sells pickaxes, the
// pack shop next to it backpacks. From the spawn the sell house and the shops read either side of the headframe.
// Every building: its ring 6.7 m in front of the anchor, a 8.6 x 6 x 6.8 m collider, and its word on a dark plate.
const facility = (id: string, type: 'sell' | 'shop', anchor: SurfaceFacility['anchor'], title: string, color: string, ringColor: string): SurfaceFacility => ({
  id, type, anchor, ringColor,
  trigger: { x: 0, z: 6.7, radius: 1.7, heightTolerance: 0.25, hysteresis: 0.25 },
  collider: { x: 0, y: 3, z: 0, half: [4.3, 3, 3.4], yaw: 0 },
  sign: { title, color, background: '#18283d', width: 3.6, y: 4.5 },
});
export const PINEWIND_FACILITIES = {
  sale: facility('surface-sale', 'sell', { x: 18.8, z: 9.58, yaw: -44 * DEG }, 'SELL', '#ffe35c', '#ffe77d'),
  shop: facility('surface-upgrade', 'shop', { x: -18.87, z: 10.79, yaw: 64 * DEG }, 'PICKAXE', '#40deff', '#44cfff'),
  bags: facility('surface-bags', 'shop', { x: -19.18, z: 28.54, yaw: 114 * DEG }, 'BACKPACK', '#ffb44a', '#ffbf5e'),
} as const;
/** The footbridge over the creek, along the main path (local Z runs along the deck). The deck is one smooth
 *  raised-cosine arch, `rise` metres high in the middle, meeting the path at ground level `halfSpan` metres
 *  either side of the centre; `width` is the boarded deck between its overhanging board ends. */
export const PINEWIND_BRIDGE = { x: 0, z: 36.5, halfSpan: 5.6, rise: 1.15, width: 5.24 } as const;
/** The creek across the valley: its centre line, flowing from the north-east round to the west, and its half
 *  width along it (`base + wave * sin(t * waves)` at fraction t of the line, water and inner banks); the banks
 *  reach `bank` metres further. Its bed lies below the surface floor, so the voxel floor under it is left out
 *  of the terrain meshes (pinewindSurface.ts, PINEWIND_GENERATION). */
export const PINEWIND_CREEK = {
  points: [[64, -70], [57, -30], [54, 10], [52, 32], [44, 51], [28, 49], [15, 39], [0, 36.5], [-18, 40], [-38, 50], [-70, 55], [-110, 57]],
  width: { base: 2.45, wave: .22, waves: 14 }, bank: 1.05,
  /** Height of the water surface, sunk below the meadow (the bed is about 0.55 m lower). */
  water: -.4,
} as const;
/** Where the bridge lands on the plaza. */
const BRIDGE_EXIT = { x: 0, z: 30 } as const;
/** Forward offset of each building's visual centre from its anchor (authored GLB bounds), and where its big
 *  word floats: `signForward` metres in front of the anchor (over the sell house's ring, against the shops'
 *  front walls so the two neighbouring shops never swap words in a view along the row), `signY` high. */
const BUILDING = {
  sale: { forward: 1.1, signForward: 6.7, signY: 5.6 },
  shop: { forward: 0, signForward: 3.2, signY: 6.9 },
  bags: { forward: .8, signForward: 3.6, signY: 7.1 },
} as const;

function service(kind: keyof typeof PINEWIND_FACILITIES) {
  const config = PINEWIND_FACILITIES[kind], derived = deriveFacility(config), { x, z, yaw } = config.anchor;
  const forward = BUILDING[kind].forward;
  const center: [number, number, number] = [round(x + Math.sin(yaw) * forward), 1, round(z + Math.cos(yaw) * forward)];
  // Big word floating at the building's front, turned toward the bridge exit so it reads on arrival,
  // across the plaza and from the spawn while staying inside the third-person camera's view.
  const { signForward, signY } = BUILDING[kind], sx = x + Math.sin(yaw) * signForward, sz = z + Math.cos(yaw) * signForward;
  const yawToBridge = Math.atan2(BRIDGE_EXIT.x - sx, BRIDGE_EXIT.z - sz);
  // The signs sit at different heights so they never merge when seen together from the spawn.
  const sign: Sign = { ...derived.sign, at: [round(sx), signY, round(sz)], yaw: round(yawToBridge), width: 4.2 };
  return { ...derived, sign, center, trigger: { ...derived.trigger, lookAt: center } };
}
export const PINEWIND_SERVICES = { sale: service('sale'), shop: service('shop'), bags: service('bags') } as const;

/** The gate to the next world stands in the pass of the wooded ridge behind the spawn. */
export const PINEWIND_GATE = { x: 0, z: 69, opening: 8, height: 9.6, wallTo: 14 } as const;
/** The gate is world 1's portal to the other worlds; its name hangs over the opening, facing the valley. */
export const PINEWIND_PORTAL_SIGN: Sign = { at: [PINEWIND_GATE.x, PINEWIND_GATE.height + .9, PINEWIND_GATE.z - 1.3], yaw: Math.PI, width: 5.2, title: tr('世界传送门'), subtitle: '', color: '#ffe7a8', background: '#2a1d46' };

/** The teleport station west of the spawn, facing it (worldJourney.ts owns the spot for every world). Its
 *  pad opens this world's layers; the big word floats over the arch. */
const station = worldStation(1);
export const PINEWIND_STATION = { x: station.x, z: station.z, yaw: round(station.yaw), pad: { x: round(station.zone.x), z: round(station.zone.z) } } as const;
export const PINEWIND_STATION_SIGN: Sign = { at: [station.x, 7.6, station.z], yaw: round(station.yaw), width: 4.4, title: tr('传送站'), subtitle: '', color: '#9ff3ff', background: '#18283d' };

/** Two egg terraces facing the plaza: world 1's seven eggs (the later worlds' stand in their own bases). Rows
 *  step up 2.2 m and alternate by half a bay, so the always-on name/price labels never stack. Progression runs
 *  north to south and low to high: the front row holds the first four eggs, the upper row the last three. */
export const PINEWIND_EGG_TIERS = [
  { tier: 0, x: 28, y: 0.4 },
  { tier: 1, x: 34, y: 2.6 },
] as const;
export const PINEWIND_TERRACE = { minZ: 17, maxZ: 43, width: 6, stairs: [15.5, 44.5], stairDepth: 3, maxRiser: 0.3 } as const;
const WORLD1_EGGS = eggsOfWorld(1);
const EGG_ROWS = [
  { tier: 0, z0: 22.5, eggs: WORLD1_EGGS.slice(0, 4) },
  { tier: 1, z0: 25, eggs: WORLD1_EGGS.slice(4) },
] as const;
export const PINEWIND_EGG_DISPLAYS = EGG_ROWS.flatMap(row => row.eggs.map((eggId, index) => {
  const tier = PINEWIND_EGG_TIERS[row.tier];
  return { id: `stand-${eggId}`, eggId, tier: row.tier, x: tier.x, y: tier.y, z: row.z0 + index * 5, yaw: -Math.PI / 2, color: eggColor(eggId) };
}));

/** Side staircases at both terrace ends; each tier's flight rises over its own width. */
export const PINEWIND_STAIR_STEPS = PINEWIND_EGG_TIERS.flatMap((tier, i) => {
  const from = i === 0 ? 0 : PINEWIND_EGG_TIERS[i - 1].y, rise = tier.y - from;
  const count = Math.ceil(rise / PINEWIND_TERRACE.maxRiser - 1e-9), run = PINEWIND_TERRACE.width / count;
  return PINEWIND_TERRACE.stairs.flatMap(z => Array.from({ length: count }, (_, j) => ({
    x: round(tier.x - PINEWIND_TERRACE.width / 2 + (j + 0.5) * run), y: round(from + rise * (j + 1) / count), z,
    width: round(run), depth: PINEWIND_TERRACE.stairDepth,
  })));
});

/** Small authored props. Lamps frame the bridge exit; the signpost points the way on arrival. */
export const PINEWIND_PROPS = {
  lamps: [{ x: -5, z: 29.5, yaw: 0 }, { x: 5, z: 29.5, yaw: Math.PI }],
  signpost: { x: -4.5, z: 25 },
  capsule: CAPSULE_MACHINE_AT, capsuleYaw: CAPSULE_MACHINE_YAW,
} as const;

/** Ground plan for the offline landscape: sandy plazas, path ribbons, paving pads and
 *  the areas vegetation must keep clear. Exported to surface-game-art/layout.json. */
const CAPSULE_FRONT = [round(CAPSULE_MACHINE_AT[0] + Math.sin(CAPSULE_MACHINE_YAW) * 1.2), round(CAPSULE_MACHINE_AT[2] + Math.cos(CAPSULE_MACHINE_YAW) * 1.2)] as const;
export const PINEWIND_GROUNDS = {
  plazas: [
    PINEWIND_PLAZA,
    { x: PINEWIND_SPAWN.x, z: PINEWIND_SPAWN.z, radius: 4.6 },
    { x: CAPSULE_FRONT[0], z: CAPSULE_FRONT[1], radius: 3.2 }, // capsule machine pad
    { x: PINEWIND_STATION.pad.x, z: PINEWIND_STATION.pad.z, radius: 3.4 }, // teleport station forecourt
  ],
  paths: [
    { width: 2.7, points: [[0, 104], [0, 80], [0, 54], [0, 46], [0, 36.5], [0, 26], [0, 16], [0, 8]] },
    { width: 1.9, points: [[13.5, 21], [22, 21], [22, 15.5], [27, 15.5]] },
    // Past the terrace stairs to the capsule machine where the pet house used to stand.
    { width: 1.7, points: [[24.5, 15.5], [26.5, 12.8], [CAPSULE_FRONT[0], CAPSULE_FRONT[1]]] },
    { width: 1.9, points: [[22, 21], [22, 44.5], [27, 44.5]] },
    { width: 1.7, points: [[PINEWIND_SPAWN.x, PINEWIND_SPAWN.z], [PINEWIND_STATION.pad.x, PINEWIND_STATION.pad.z]] },
  ],
  pads: [[0, 16], ...Object.values(PINEWIND_SERVICES).map(s => [s.trigger.x, s.trigger.z] as const), [22, 29], [0, 47]],
  keepClear: [
    { kind: 'rect', minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    { kind: 'rect', minX: 20, maxX: 40, minZ: 12, maxZ: 48 },
    { kind: 'rect', minX: -7, maxX: 7, minZ: 30, maxZ: 104 },
    { kind: 'circle', x: PINEWIND_PLAZA.x, z: PINEWIND_PLAZA.z, radius: PINEWIND_PLAZA.radius + .5 },
    { kind: 'circle', x: PINEWIND_SPAWN.x, z: PINEWIND_SPAWN.z, radius: 15.5 },
    { kind: 'circle', x: PINEWIND_SERVICES.sale.center[0], z: PINEWIND_SERVICES.sale.center[2], radius: 7.5 },
    { kind: 'circle', x: PINEWIND_SERVICES.shop.center[0], z: PINEWIND_SERVICES.shop.center[2], radius: 7 },
    { kind: 'circle', x: PINEWIND_SERVICES.bags.center[0], z: PINEWIND_SERVICES.bags.center[2], radius: 7 },
    { kind: 'rect', minX: -PINEWIND_GATE.wallTo - 1, maxX: PINEWIND_GATE.wallTo + 1, minZ: PINEWIND_GATE.z - 4, maxZ: PINEWIND_GATE.z + 4 },
    { kind: 'circle', x: CAPSULE_MACHINE_AT[0], z: CAPSULE_MACHINE_AT[2], radius: 4 },
    { kind: 'circle', x: PINEWIND_STATION.x, z: PINEWIND_STATION.z, radius: 6 },
  ],
} as const;
