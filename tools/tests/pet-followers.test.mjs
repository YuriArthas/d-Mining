import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, PerspectiveCamera } from 'three';
import { PetFollowers } from '../../src/game/presentation/PetFollowers.ts';
import { PET_CONTENT } from '../../src/game/content/petContent.ts';
import { petAppearance } from '../../src/game/content/petAppearance.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { PetService } from '../../src/game/application/PetService.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
const PET_DISPLAYS = GAME_CONTENT.eggs;

const pet = (id, slot, speciesId = 'moss-slime') => ({ id, slot, speciesId, level: 1 });
test('each displayed egg charges its own price and draws only from its own configured pool', () => {
  assert.equal(new Set(PET_DISPLAYS.map(p => p.eggId)).size, 16);
  const funds = currency => PET_CONTENT.eggs.filter(e => e.currency === currency).reduce((sum,e)=>sum+e.price*5,0);
  const wallet = new Wallet({ gold: funds('gold'), tech: funds('tech'), star: funds('star') }); let serial = 0, roll = 0;
  const service = new PetService({ content: PET_CONTENT, wallet, hasDestination:()=>true, worldOpen:()=>true, random: () => roll, createPetId: () => `p${++serial}` });
  const pools = new Set();
  for (const stand of PET_DISPLAYS) {
    const egg = service.catalog.egg(stand.eggId);
    assert.ok(egg); assert.equal(egg.outcomes.length, 5);
    const total = egg.outcomes.reduce((n, o) => n + o.weight, 0); let cumulative = 0;
    for (const outcome of egg.outcomes) {
      assert.ok(!pools.has(outcome.speciesId)); pools.add(outcome.speciesId);
      assert.ok(petAppearance(outcome.speciesId));
      roll = (cumulative + outcome.weight / 2) / total;
      const before = wallet.getBalances(), result = service.hatch(egg.id);
      assert.equal(result.status, 'hatched'); assert.equal(result.pet.speciesId, outcome.speciesId);
      assert.equal(before[egg.currency] - wallet.getBalance(egg.currency), egg.price);
      for (const other of ['gold', 'tech', 'star']) if (other !== egg.currency) assert.equal(wallet.getBalance(other), before[other]);
      cumulative += outcome.weight;
    }
  }
  assert.equal(pools.size, PET_CONTENT.pets.length);
});

const body = () => new BoxGeometry(1, 1, 1).translate(0, .5, 0);
const camera = () => { const c = new PerspectiveCamera(); c.position.set(0, 4, 10); return c; };

test('followers share the cube body, own their materials, and free the body once at the end', () => {
  const geometry = body(), view = new PetFollowers(geometry, () => .5);
  view.sync([pet('one', 0), pet('two', 1)]);
  const [first, second] = view.group.children;
  const bodies = [first, second].map(group => { let mesh = null; group.traverse(o => { if (!mesh && o.isMesh && o.geometry === geometry) mesh = o; }); return mesh; });
  assert.ok(bodies.every(Boolean), 'both pets use the shared body');
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  bodies[0].material.addEventListener('dispose', () => materialDisposals++);
  view.sync([pet('two', 0)]);
  assert.equal(view.group.children[0], second); assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 1);
  assert.equal(view.diagnostics()[0].slot, 0);
  view.dispose(); assert.equal(view.group.children.length, 0); assert.equal(geometryDisposals, 1);
});

test('followers wait out of sight while travelling and land beside the miner on arrival', () => {
  const view = new PetFollowers(body(), () => .5), cam = camera();
  view.sync([pet('one', 0), pet('two', 1), pet('three', 2)]);
  view.update([0, 0, 0], 0, cam, 1 / 60, false);
  const before = view.diagnostics();
  assert.equal(before.length, 3);
  assert.ok(before[0].position[0] < 0 && before[1].position[0] > 0);
  assert.ok(before.every(p => p.position[2] > 0), 'behind the miner');
  view.update([1, 0, 0], 0, cam, 1 / 60, false);
  const step = view.diagnostics()[0].position[0] - before[0].position[0];
  assert.ok(step > 0 && step < 1);
  view.update([100, -400, 0], 0, cam, 1 / 60, true);
  assert.ok(view.diagnostics().every(p => !p.visible));
  view.update([100, -400, 0], 0, cam, 1 / 60, false);
  assert.ok(view.diagnostics().every(p => p.visible && p.position[0] > 98 && p.position[1] < -398));
  view.sync([]); assert.equal(view.diagnostics().length, 0); view.dispose();
});

test('pets hop after a moving miner (up in the air, squash on landing) and stay grounded while the miner jumps', () => {
  const view = new PetFollowers(body(), () => .5), cam = camera();
  view.sync([pet('one', 0)]);
  view.update([0, 0, 0], 0, cam, 1 / 60, false);
  let hopped = false, highest = 0, squashed = false;
  for (let i = 0; i < 120; i++) {
    view.update([0, 0, -i * .05], 0, cam, 1 / 60, false);
    const d = view.diagnostics()[0];
    hopped ||= d.hopping; highest = Math.max(highest, d.position[1]); squashed ||= d.squash < .95;
  }
  assert.ok(hopped && highest > .15, `hops along (${highest.toFixed(2)} m)`);
  assert.ok(squashed, 'squashes on landing');
  assert.ok(Math.abs(view.diagnostics()[0].position[2] - (-6 + 1.5)) < 1.6, 'keeps up with the miner');
  for (let i = 0; i < 30; i++) view.update([0, 1.2, -6], 0, cam, 1 / 60, false, false);
  assert.ok(view.diagnostics()[0].position[1] < .5, 'stays on the ground while the miner is in the air');
  view.dispose();
});

test('a standing miner gets pets that turn to face the camera', () => {
  const view = new PetFollowers(body(), () => .99), cam = camera();
  view.sync([pet('one', 0)]);
  for (let i = 0; i < 240; i++) view.update([0, 0, 0], 0, cam, 1 / 60, false);
  const d = view.diagnostics()[0], toCamera = Math.atan2(cam.position.x - d.position[0], cam.position.z - d.position[2]);
  assert.ok(Math.abs(Math.atan2(Math.sin(d.yaw - toCamera), Math.cos(d.yaw - toCamera))) < .1, `yaw ${d.yaw} vs ${toCamera}`);
  view.dispose();
});
