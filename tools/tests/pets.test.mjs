import test from 'node:test';
import assert from 'node:assert/strict';
import { PetCatalog } from '../../src/game/logic/pets/PetCatalog.ts';
import { PetInventory } from '../../src/game/logic/pets/PetInventory.ts';
import { PetEquipment } from '../../src/game/logic/pets/PetEquipment.ts';
import { calculateMiningStats, calculatePetBonus, drawEgg, selectBestPets } from '../../src/game/logic/pets/petRules.ts';
import { PetService } from '../../src/game/application/PetService.ts';
import { MiningAttributes } from '../../src/game/application/MiningAttributes.ts';
import { PetUiAdapter } from '../../src/game/application/PetUiAdapter.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { Pickaxe } from '../../src/game/logic/Pickaxe.ts';
import { PET_CONTENT } from '../../src/game/content/pets.ts';
import { SESSION_CONTENT } from '../../src/game/world/sessionContent.ts';

const pet = (id, speciesId = 'moss-slime') => ({ id, speciesId, level: 1 });
const setup = (coins = 100, overrides = {}) => {
  const wallet = new Wallet(coins); let serial = 0;
  const service = new PetService({ content: PET_CONTENT, wallet, random: () => 0, createPetId: () => `pet-${++serial}`, ...overrides });
  return { wallet, service };
};

test('pet catalog validates references and owns immutable copies of content', () => {
  const input = structuredClone(PET_CONTENT), catalog = new PetCatalog(input);
  input.eggs[0].outcomes[0].weight = 0; input.pets[0].name = 'changed';
  assert.equal(catalog.pet('moss-slime').name, '苔团');
  assert.equal(catalog.egg('meadow-egg').outcomes[0].weight, 40);
  assert.throws(() => { catalog.egg('meadow-egg').outcomes[0].weight = 4; });
  for (const mutate of [
    c => { c.eggs[0].outcomes[0].speciesId = 'missing'; },
    c => { c.eggs[0].outcomes[0].weight = 0; },
    c => { c.eggs[0].outcomes.push(c.eggs[0].outcomes[0]); },
    c => { c.pets.push(c.pets[0]); },
    c => { c.equipSlots = 0; },
    c => { c.eggs[0].price = -1; },
    c => { c.pets[0].powerBonusBps = Number.MAX_SAFE_INTEGER; },
  ]) { const c = structuredClone(PET_CONTENT); mutate(c); assert.throws(() => new PetCatalog(c)); }
});

test('pet inventory accepts batches without capacity policy and never aliases caller data', () => {
  const inventory = new PetInventory(), source = pet('one');
  inventory.add([source, ...Array.from({ length: 200 }, (_, i) => pet(`bulk-${i}`))]);
  source.speciesId = 'changed';
  assert.equal(inventory.get('one').speciesId, 'moss-slime');
  assert.equal(inventory.getSnapshot().count, 201);
  const before = inventory.getSnapshot(); inventory.add([]); assert.equal(inventory.getSnapshot(), before);
  assert.throws(() => { before.pets[0].level = 2; });
  const dto = inventory.exportData(); dto.pets[0].id = 'changed'; assert.ok(inventory.has('one'));
  assert.deepEqual(PetInventory.fromData(inventory.exportData()).exportData(), inventory.exportData());
});

test('invalid or duplicate pet batches do not partially insert or remove', () => {
  const inventory = new PetInventory(); inventory.add([pet('a')]); const before = inventory.getSnapshot();
  for (const batch of [[pet('b'), pet('a')], [pet('b'), pet('b')], [pet('b'), { ...pet('c'), level: 2 }]]) {
    assert.throws(() => inventory.add(batch)); assert.equal(inventory.getSnapshot(), before);
  }
  assert.equal(inventory.remove(['a', 'missing']), false); assert.equal(inventory.getSnapshot(), before);
  assert.throws(() => inventory.remove(['a', 'a'])); assert.equal(inventory.getSnapshot(), before);
  assert.equal(inventory.remove(['a']), true); assert.equal(inventory.has('a'), false);
});

test('equipment preserves identity, rejects duplicate slots, and never replaces a full slot', () => {
  const equipment = new PetEquipment(2);
  assert.deepEqual(equipment.equip('a'), { status: 'equipped', slot: 0 });
  assert.deepEqual(equipment.equip('a'), { status: 'already-equipped', slot: 0 });
  equipment.equip('b'); const before = equipment.getSnapshot();
  assert.deepEqual(equipment.equip('c'), { status: 'full' }); assert.equal(equipment.getSnapshot(), before);
  for (const slots of [['a', 'a'], ['a'], Array(2)]) assert.throws(() => equipment.replace(slots));
  assert.equal(equipment.getSnapshot(), before);
  assert.deepEqual(PetEquipment.fromData(equipment.exportData(), 2).exportData(), equipment.exportData());
  assert.equal(equipment.unequip('a'), true); assert.equal(equipment.unequip('a'), false);
  assert.deepEqual(equipment.equip('c'), { status: 'equipped', slot: 0 });
});

test('weighted draw uses exact cumulative boundaries and rejects invalid RNG', () => {
  const egg = new PetCatalog(PET_CONTENT).egg('meadow-egg');
  for (const [roll, species] of [[0, 'moss-slime'], [.399999, 'moss-slime'], [.4, 'quarry-mole'], [.7, 'amber-fox'], [.9, 'crystal-owl'], [.98, 'moon-dragon'], [1 - Number.EPSILON, 'moon-dragon']]) assert.equal(drawEgg(egg, roll), species);
  for (const roll of [-1, 1, NaN, Infinity]) assert.throws(() => drawEgg(egg, roll));
});

test('hatch settles once per explicit call, permits duplicates and does not automatically equip', () => {
  const { service, wallet } = setup(20);
  const first = service.hatch('meadow-egg'), second = service.hatch('meadow-egg');
  assert.equal(first.status, 'hatched'); assert.equal(second.status, 'hatched');
  assert.notEqual(first.pet.id, second.pet.id); assert.equal(first.pet.speciesId, second.pet.speciesId);
  assert.equal(wallet.getBalance(), 0); assert.equal(service.getInventory().count, 2);
  assert.deepEqual(service.getEquipment().slots, [null, null, null]);
  assert.equal(service.hatch('meadow-egg').status, 'insufficient-coins');
});

test('insufficient funds and unknown eggs do not consume randomness; bad IDs do not debit', () => {
  let draws = 0;
  const { service, wallet } = setup(9, { random: () => { draws++; return 0; } });
  assert.equal(service.hatch('missing').status, 'unknown-egg');
  assert.equal(service.hatch('meadow-egg').status, 'insufficient-coins');
  assert.equal(draws, 0); assert.equal(wallet.getBalance(), 9);
  for (const createPetId of [() => '', () => 'same']) {
    const s = setup(20, { createPetId }); s.service.grant([pet('same')]);
    assert.throws(() => s.service.hatch('meadow-egg'));
    assert.equal(s.wallet.getBalance(), 20); assert.equal(s.service.getInventory().count, 1);
  }
  const invalid = setup(20, { random: () => 1 });
  assert.throws(() => invalid.service.hatch('meadow-egg')); assert.equal(invalid.wallet.getBalance(), 20);
});

test('debit refusal is respected and does not grant a pet', () => {
  const service = setup(0, { wallet: { getBalance: () => 10, debit: () => false } }).service;
  assert.equal(service.hatch('meadow-egg').status, 'insufficient-coins'); assert.equal(service.getInventory().count, 0);
});

test('ownership rules stay at service boundary; full equipment never prevents earned rewards', () => {
  const { service } = setup(); service.grant([pet('a'), pet('b'), pet('c'), pet('d')]);
  assert.equal(service.equip('missing').status, 'not-owned');
  for (const id of ['a', 'b', 'c']) assert.equal(service.equip(id).status, 'equipped');
  assert.equal(service.equip('d').status, 'full');
  service.grant([pet('earned')]); assert.equal(service.hatch('meadow-egg').status, 'hatched');
  assert.equal(service.getInventory().count, 6); assert.equal(service.getBonus().powerBonusBps, 3000);
  assert.equal(service.remove(['a', 'missing']), false); assert.equal(service.getEquipment().slots[0], 'a');
  assert.equal(service.remove(['a', 'b']), true); assert.deepEqual(service.getEquipment().slots, [null, null, 'c']);
  assert.equal(service.getBonus().powerBonusBps, 1000);
  const before = service.getInventory();
  assert.throws(() => service.grant([pet('valid'), pet('bad', 'unknown')])); assert.equal(service.getInventory(), before);
});

test('best equipment is deterministic, including ties, duplicates and small inventories', () => {
  const catalog = new PetCatalog(PET_CONTENT), read = id => catalog.pet(id);
  const owned = [pet('b'), pet('a'), pet('x', 'moon-dragon'), pet('y', 'amber-fox')];
  assert.deepEqual(selectBestPets(owned, read, 3), ['x', 'y', 'a']);
  assert.deepEqual(selectBestPets([...owned].reverse(), read, 3), ['x', 'y', 'a']);
  const { service } = setup(); service.grant([pet('a')]); service.equipBest();
  assert.deepEqual(service.getEquipment().slots, ['a', null, null]); assert.equal(service.equipBest(), false);
  service.remove(['a']); assert.equal(service.equipBest(), false);
});

test('bonuses sum before rounding once; base stats and speed stay unchanged', () => {
  const base = Object.freeze({ power: 15, speed: 4 });
  assert.deepEqual(calculateMiningStats(base, { powerBonusBps: 3000 }), { power: 19, speed: 4 });
  assert.equal(base.power, 15);
  assert.equal(calculateMiningStats({ power: Number.MAX_SAFE_INTEGER, speed: 1 }, { powerBonusBps: 0 }).power, Number.MAX_SAFE_INTEGER);
  assert.throws(() => calculateMiningStats({ power: Number.MAX_SAFE_INTEGER, speed: 1 }, { powerBonusBps: 1 }));
  const catalog = new PetCatalog(PET_CONTENT);
  assert.equal(calculatePetBonus([pet('a'), pet('b')], id => catalog.pet(id)).powerBonusBps, 2000);
});

test('restoring pets validates the whole candidate before replacing live state', () => {
  const { service } = setup(); service.grant([pet('a'), pet('b', 'moon-dragon')]); service.equip('b');
  const saved = service.exportData(), restored = setup().service; restored.restoreData(saved);
  assert.deepEqual(restored.exportData(), saved); assert.equal(restored.getBonus().powerBonusBps, 7500);
  for (const mutate of [
    d => { d.version = 2; }, d => { d.inventory.pets.push(d.inventory.pets[0]); },
    d => { d.inventory.pets[0].speciesId = 'missing'; }, d => { d.inventory.pets[0].level = 2; },
    d => { d.equipment.slots = ['missing', null, null]; }, d => { d.equipment.slots = ['a', 'a', null]; },
    d => { d.equipment.slots = ['a']; },
  ]) {
    const bad = structuredClone(saved); mutate(bad); assert.throws(() => service.restoreData(bad));
    assert.deepEqual(service.exportData(), saved);
  }
});

test('UI adapter publishes coherent snapshots, filters unrelated frames, releases subscriptions', () => {
  const { service, wallet } = setup(30), pickaxe = new Pickaxe(), listeners = new Set();
  let emissions = 0;
  const publish = () => { for (const listener of listeners) listener(); };
  const attributes = new MiningAttributes(pickaxe.getSnapshot, service.getBonus);
  const adapter = new PetUiAdapter(service, { effectiveStats: attributes.getSnapshot, balance: () => wallet.getBalance(), baseStats: pickaxe.getSnapshot, publish, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } });
  const unsubscribe = adapter.subscribe(() => { emissions++; assert.equal(adapter.getSnapshot().coins, wallet.getBalance()); });
  const first = adapter.getSnapshot(); publish(); assert.equal(emissions, 0); assert.equal(adapter.getSnapshot(), first);
  const result = adapter.hatch('meadow-egg'); assert.equal(emissions, 1);
  assert.equal(adapter.getSnapshot().pets.length, 1); assert.equal(adapter.getSnapshot().coins, 20);
  adapter.equip(result.pet.id); assert.equal(attributes.getSnapshot().power, 11); assert.equal(emissions, 2);
  adapter.equip(result.pet.id); assert.equal(emissions, 2);
  const cards = adapter.getSnapshot().pets; wallet.debit(20); publish();
  assert.equal(adapter.getSnapshot().eggs[0].canAfford, false); assert.equal(adapter.getSnapshot().pets, cards);
  wallet.credit(10); publish(); assert.equal(adapter.getSnapshot().eggs[0].canAfford, true);
  pickaxe.setLevel(2); publish(); assert.equal(attributes.getSnapshot().power, 16);
  adapter.unequipAll(); assert.equal(attributes.getSnapshot().power, 15);
  unsubscribe(); assert.equal(listeners.size, 0);
});

test('session uses pet power for real combat without resetting damage or cooldown', () => {
  let now = 0, serial = 0;
  const session = new GameSession(SESSION_CONTENT, 50, () => now, { random: () => 0, createPetId: () => `p${++serial}` });
  session.attach({ cell: () => 2, pending: () => false, mine: () => true, cancelMining() {}, returnToSurface() {} });
  session.collected(Array.from({ length: 30 }, () => ({ kind: 1 })));
  const sale = SESSION_CONTENT.sales[0]; session.updatePosition([sale.x, sale.y, sale.z], true); session.resetPosition();
  const target = [0, -1, 0]; assert.equal(session.hit(target).damage, 10);
  const cooldown = session.combatDebug().nextAttackAt;
  const acquired = session.pets.hatch('meadow-egg'); assert.equal(acquired.status, 'hatched');
  session.pets.equip(acquired.pet.id);
  assert.equal(session.combatDebug().nextAttackAt, cooldown); assert.equal(session.hit(target).status, 'cooldown');
  assert.equal(session.getSnapshot().pickaxe.power, 10); assert.equal(session.getSnapshot().miningStats.power, 11);
  now = 1; assert.equal(session.hit([1, -1, 0]).damage, 11);
  session.pets.unequipAll(); now = 2; assert.equal(session.hit([2, -1, 0]).damage, 10);
});

test('egg proximity derives from display configuration and clears on leaving or travel', () => {
  const session = new GameSession(SESSION_CONTENT), station = SESSION_CONTENT.eggStations[0];
  const { x, y, z } = station.zone;
  session.updatePosition([x, y, z], true); assert.equal(session.getSnapshot().eggId, station.eggId);
  session.updatePosition([x - 5, y, z], true); assert.equal(session.getSnapshot().eggId, null);
  session.updatePosition([x, y, z], true); session.resetPosition(); assert.equal(session.getSnapshot().eggId, null);
});


test('a new game starts with 200 coins once, independent from UI subscriptions and egg visits', () => {
  const session = new GameSession(SESSION_CONTENT);
  assert.equal(session.getSnapshot().coins, 200);
  const result = session.pets.hatch('meadow-egg');
  assert.equal(result.status, 'hatched'); assert.equal(session.getSnapshot().coins, 190);
  for (let i=0; i<3; i++) {
    const unsubscribe = session.pets.subscribe(() => {});
    session.pets.getSnapshot(); unsubscribe(); session.resetPosition();
    const station = SESSION_CONTENT.eggStations[i];
    session.updatePosition([station.zone.x,station.zone.y,station.zone.z], true);
    assert.equal(session.getSnapshot().coins, 190);
  }
  const custom = new GameSession({...SESSION_CONTENT,initialCoins:0});
  assert.equal(custom.getSnapshot().coins,0);
  assert.equal(custom.pets.hatch('meadow-egg').status,'insufficient-coins');
});
