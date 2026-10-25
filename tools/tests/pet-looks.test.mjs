import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry } from 'three';
import { PET_CONTENT } from '../../src/game/content/petContent.ts';
import { EGG_DEFINITIONS } from '../../src/game/content/pets.ts';
const stageOf = id => { const egg = EGG_DEFINITIONS.find(e => e.id === id); return (egg.world - 1) * 7 + egg.layer; };
import { PET_FACES, PET_PATTERNS, petLook, sparkleFrom } from '../../src/game/content/petLooks.ts';
import { PetModel, PetTextures } from '../../src/game/presentation/pets/PetModel.ts';

const order = { common: 0, rare: 1, epic: 2, legendary: 3 };

test('每只宠物都有方块外观：物种颜色、所在蛋的花纹、表明动物的脸，体型随稀有度变大', () => {
  for (const egg of PET_CONTENT.eggs) for (const { speciesId } of egg.outcomes) {
    const look = petLook(speciesId), pet = PET_CONTENT.pets.find(p => p.id === speciesId);
    assert.equal(look.eggId, egg.id); assert.equal(look.rarity, pet.rarity);
    assert.ok(PET_FACES.includes(look.face) && PET_PATTERNS.includes(look.pattern));
    assert.match(look.color, /^#[0-9a-f]{6}$/i);
  }
  const sizes = ['moss-slime', 'amber-fox', 'crystal-owl', 'moon-dragon'].map(id => petLook(id).size);
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes, 'common < rare < epic < legendary');
  assert.ok(sizes.at(-1) < 1, 'legendaries stay under a metre so they do not block the view');
  assert.equal(petLook('moss-slime').face, 'slime'); assert.equal(petLook('amber-fox').face, 'fox'); assert.equal(petLook('moon-dragon').face, 'dragon');
  assert.equal(new Set(PET_CONTENT.eggs.map(e => petLook(e.outcomes[0].speciesId).pattern)).size, 16, 'every egg has its own pattern');
});

test('粒子随蛋所在的层下放：第一世界前五层只有传说，之后到第二世界中段从史诗开始，再往后从稀有开始；光晕只给传说', () => {
  assert.equal(sparkleFrom(0), 'legendary'); assert.equal(sparkleFrom(4), 'legendary');
  assert.equal(sparkleFrom(5), 'epic'); assert.equal(sparkleFrom(11), 'epic');
  assert.equal(sparkleFrom(12), 'rare'); assert.equal(sparkleFrom(20), 'rare');
  for (const egg of PET_CONTENT.eggs) for (const { speciesId } of egg.outcomes) {
    const look = petLook(speciesId), from = sparkleFrom(stageOf(egg.id));
    assert.equal(look.particles, order[look.rarity] >= order[from], `${speciesId} in ${egg.id}`);
    assert.equal(look.glow, look.rarity === 'legendary');
    if (look.rarity === 'common') assert.equal(look.particles, false, 'commons never sparkle');
  }
});

test('宠物模型是身体加一块独立的脸；有粒子的才带粒子，传说带光晕；会眨眼；释放自己的资源', () => {
  const textures = new PetTextures(), geometry = new BoxGeometry(1, 1, 1);
  const plain = new PetModel(petLook('moss-slime'), geometry, textures, () => .5);
  const legend = new PetModel(petLook('moon-dragon'), geometry, textures, () => .5);
  const lateRare = new PetModel(petLook(PET_CONTENT.eggs.find(e => e.id === 'core-egg').outcomes.find(o => PET_CONTENT.pets.find(p => p.id === o.speciesId).rarity === 'rare').speciesId), geometry, textures, () => .5);
  assert.deepEqual([plain, legend, lateRare].map(m => m.diagnostics().sparkles > 0), [false, true, true]);
  assert.deepEqual([plain, legend, lateRare].map(m => m.diagnostics().glow), [false, true, false]);
  const meshes = []; plain.group.traverse(o => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 2, 'body and face');
  assert.ok(meshes.some(m => m.geometry === geometry) && meshes.some(m => m.geometry !== geometry && m.material.transparent), 'the face is its own transparent plane');
  let blinked = false;
  for (let i = 0; i < 600 && !blinked; i++) { plain.update(1 / 60); blinked = plain.diagnostics().blinking; }
  assert.ok(blinked, 'blinks within ten seconds');
  let disposed = 0; geometry.addEventListener('dispose', () => disposed++);
  for (const m of [plain, legend, lateRare]) m.dispose();
  assert.equal(disposed, 0, 'the shared body stays');
  textures.dispose();
});
