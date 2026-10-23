// Offline: write the Pinewind hub plan for the Blender and landscape builders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHALLENGE_BOARD_AT, CAPSULE_MACHINE_AT, CAPSULE_MACHINE_YAW } from '../src/game/content/feedbackFacilities.ts';
import {
  PINEWIND_FACILITIES, PINEWIND_SERVICES, PINEWIND_EGG_DISPLAYS, PINEWIND_EGG_TIERS, PINEWIND_TERRACE,
  PINEWIND_STAIR_STEPS, PINEWIND_PORTAL_SLOTS, PINEWIND_CONSERVATORY, PINEWIND_GROUNDS, PINEWIND_SPAWN, PINEWIND_PROPS, PINEWIND_GATE, PINEWIND_BRIDGE,
} from '../src/game/content/pinewind/hubLayout.ts';
const root = new URL('../surface-game-art/', import.meta.url);
mkdirSync(root, { recursive: true });
writeFileSync(new URL('layout.json', root), JSON.stringify({
  version: 'pinewind-plaza-v4',
  feedback: { board: CHALLENGE_BOARD_AT, capsule: CAPSULE_MACHINE_AT, capsuleYaw: CAPSULE_MACHINE_YAW },
  services: Object.fromEntries(Object.entries(PINEWIND_FACILITIES).map(([id, f]) => [id, { anchor: f.anchor, center: PINEWIND_SERVICES[id].center }])),
  eggs: PINEWIND_EGG_DISPLAYS.map(({ id, eggId, tier, x, y, z, yaw, color }) => ({ id, eggId, tier, x, y, z, yaw, color })),
  tiers: PINEWIND_EGG_TIERS, terrace: PINEWIND_TERRACE, steps: PINEWIND_STAIR_STEPS,
  portals: Object.entries(PINEWIND_PORTAL_SLOTS).map(([id, slot]) => ({ id, ...slot })),
  conservatory: PINEWIND_CONSERVATORY, spawn: PINEWIND_SPAWN, grounds: PINEWIND_GROUNDS, props: PINEWIND_PROPS,
  mine: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, bridge: PINEWIND_BRIDGE, gate: PINEWIND_GATE,
}, null, 2) + '\n');
