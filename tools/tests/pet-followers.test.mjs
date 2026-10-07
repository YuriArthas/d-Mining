import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { PetFollowers } from '../../src/game/presentation/PetFollowers.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { petAppearance } from '../../src/game/content/petAppearance.ts';
import { PET_DISPLAYS } from '../../src/game/world/SurfaceHub.ts';
import { PetService } from '../../src/game/application/PetService.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';

const pet = (id, slot, speciesId = 'moss-slime') => ({ id, slot, speciesId, level: 1 });
test('each displayed egg charges its own price and draws only from its own configured pool', () => {
  assert.equal(new Set(PET_DISPLAYS.map(p => p.eggId)).size, 18);
  assert.equal(new Set(PET_CONTENT.eggs.map(e => e.price)).size, 18);
  const wallet = new Wallet(1000000); let serial = 0, roll = 0;
  const service = new PetService({ content: PET_CONTENT, wallet, random: () => roll, createPetId: () => `p${++serial}` });
  const pools = new Set();
  for (const stand of PET_DISPLAYS) {
    const egg = service.catalog.egg(stand.eggId);
    assert.ok(egg); assert.equal(egg.outcomes.length, 5);
    const total = egg.outcomes.reduce((n, o) => n + o.weight, 0); let cumulative = 0;
    for (const outcome of egg.outcomes) {
      assert.ok(!pools.has(outcome.speciesId)); pools.add(outcome.speciesId);
      assert.ok(petAppearance(outcome.speciesId));
      roll = (cumulative + outcome.weight / 2) / total;
      const before = wallet.getBalance(), result = service.hatch(egg.id);
      assert.equal(result.status, 'hatched'); assert.equal(result.pet.speciesId, outcome.speciesId);
      assert.equal(before - wallet.getBalance(), egg.price);
      cumulative += outcome.weight;
    }
  }
  assert.equal(pools.size, 90);
});

test('followers preserve instance identity, share sphere geometry and release only owned resources', () => {
  const view = new PetFollowers();
  view.sync([pet('one', 0), pet('two', 1)]);
  const first = view.group.children[0], second = view.group.children[1];
  const geometry = first.children[0].geometry;
  assert.equal(geometry, second.children[0].geometry);
  let geometryDisposals = 0, materialDisposals = 0, labelDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  first.children[0].material.addEventListener('dispose', () => materialDisposals++);
  first.children[1].children[0].geometry.addEventListener('dispose', () => labelDisposals++);
  view.sync([pet('two', 0)]);
  assert.equal(view.group.children[0], second); assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 1); assert.equal(labelDisposals, 1);
  assert.equal(view.diagnostics()[0].slot, 0);
  view.dispose(); assert.equal(view.group.children.length, 0); assert.equal(geometryDisposals, 1);
});

test('followers interpolate normal movement and reset on teleport without a long cross-world flight', () => {
  const view = new PetFollowers(), camera = new PerspectiveCamera();
  view.sync([pet('one', 0), pet('two', 1), pet('three', 2)]);
  view.update([0, 0, 0], 0, camera, 1/60, false);
  const before = view.diagnostics();
  assert.equal(before.length, 3);
  assert.ok(before[0].position[0] < 0 && before[1].position[0] > 0);
  assert.ok(before.every(p => p.position[2] > 0));
  view.update([1, 0, 0], 0, camera, 1/60, false);
  const step = view.diagnostics()[0].position[0] - before[0].position[0];
  assert.ok(step > 0 && step < 1);
  view.update([100, -400, 0], 0, camera, 1/60, true);
  assert.ok(view.diagnostics().every(p => !p.visible));
  view.update([100, -400, 0], 0, camera, 1/60, false);
  assert.ok(view.diagnostics().every(p => p.visible && p.position[0] > 98 && p.position[1] < -398));
  view.sync([]); assert.equal(view.diagnostics().length, 0); view.dispose();
});
