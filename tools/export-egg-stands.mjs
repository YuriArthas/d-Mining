// Offline: write the later worlds' eggs (world, stand id, colour) for the egg stand props
// (surface-game-art/tools/blender/build_egg_stands.py). World 1's stands are built with Pinewind's architecture.
import { writeFileSync } from 'node:fs';
import { eggColor, eggsOfWorld } from '../src/game/content/eggStands.ts';
const eggs = [2, 3].flatMap(world => eggsOfWorld(world).map(eggId => ({ id: `stand-${eggId}`, eggId, world, color: eggColor(eggId) })));
writeFileSync(new URL('../surface-game-art/egg-stands.json', import.meta.url), JSON.stringify({ eggs }, null, 2) + '\n');
console.log(eggs.length, 'egg stands');
