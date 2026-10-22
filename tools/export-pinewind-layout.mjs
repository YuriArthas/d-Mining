import { mkdirSync, writeFileSync } from 'node:fs';
import { CHALLENGE_BOARD_AT, CAPSULE_MACHINE_AT } from '../src/game/content/feedbackFacilities.ts';
import { SURFACE_FACILITIES } from '../src/game/content/surfaceFacilities.ts';
import { PET_DISPLAYS, SURFACE_PORTALS } from '../src/game/world/SurfaceHub.ts';
import { PET_TIERS, PET_STAIR_STEPS } from '../src/game/world/PetTerraces.ts';
const root = new URL('../surface-game-art/', import.meta.url);
mkdirSync(root, { recursive: true });
writeFileSync(new URL('layout.json', root), JSON.stringify({
  feedback: { board: CHALLENGE_BOARD_AT, capsule: CAPSULE_MACHINE_AT },
  services: SURFACE_FACILITIES, eggs: PET_DISPLAYS, portals: SURFACE_PORTALS,
  tiers: PET_TIERS, steps: PET_STAIR_STEPS,
  mine: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, bridge: { x: 0, z: 36.5 },
}, null, 2) + '\n');
