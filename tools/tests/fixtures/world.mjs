// Shared test fixtures: the game's real terrain generation and world 1's layers, plus the collision course
// the character physics tests walk (boxes, a stair, a ramp and a jump shaft west of the mine).
import { GAME_GENERATION } from '../../../src/game/content/gameContent.ts';
import { JOURNEY_WORLDS } from '../../../src/game/content/journeyWorlds.ts';
import { RAPIER } from '../../../src/game/validation/physics.ts';
import { generationAtZ } from '../../../src/game/terrain/SparseWorld.ts';

export const GENERATION = GAME_GENERATION;
export const WORLD1_LAYERS = JOURNEY_WORLDS[0].layers;
/** World 1's terrain on its own (the game's generation picks it by Z). */
export const WORLD1 = generationAtZ(GAME_GENERATION, 0);
/** World 1's blocks: the surface rock (soft), its two ores, and a later layer's rock. */
export const KIND = { rock: 64, deep: 65, coal: 66, copper: 67, deeperRock: 68 };

export const COURSE_SPAWN = [-24, 0.1, 12];
export const COURSE_BOXES = [
  // 1.4 m clear width, 2 m clear height; the capsule is 0.88 m wide / 1.85 m tall.
  { center: [-12, 1.5, 18], half: [0.5, 1.5, 4] },
  { center: [-9.6, 1.5, 18], half: [0.5, 1.5, 4] },
  { center: [-10.8, 2.15, 18], half: [0.7, 0.15, 2] },
  // L corner, with room to walk around the outer end.
  { center: [-18, 1.5, 19], half: [0.4, 1.5, 3] },
  { center: [-16, 1.5, 22], half: [2.4, 1.5, 0.4] },
  // Eight 1 m rises from the shaft floor (-8 m) to the surface, requiring jumps.
  ...Array.from({ length: 8 }, (_, i) => ({ center: [-28, -8 + (i + 1) / 2, -7 + i * 2], half: [2, (i + 1) / 2, 1] })),
  // A platform with a wall, and three shallow steps.
  { center: [0, 1, 16], half: [5, 1, 6] },
  { center: [5.5, 2.5, 17], half: [0.5, 2.5, 4] },
  { center: [-7, 0.2, 12], half: [1.5, 0.2, 1] },
  { center: [-7, 0.4, 14], half: [1.5, 0.4, 1] },
  { center: [-7, 0.6, 16], half: [1.5, 0.6, 1] },
];
export const RAMP = {
  positions: new Float32Array([-3, 0, 4, 3, 0, 4, -3, 2, 10, 3, 2, 10, -3, 0, 10, 3, 0, 10]),
  indices: new Uint32Array([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 5, 2, 5, 3, 0, 1, 4, 1, 5, 4]),
};
/** Adds the course to a CharacterPhysics world (the game itself has no such colliders). */
export function installCourse(physics) {
  for (const box of COURSE_BOXES) physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...box.half).setTranslation(...box.center));
  physics.world.createCollider(RAPIER.ColliderDesc.trimesh(RAMP.positions, RAMP.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES));
  return physics;
}
