import test from 'node:test';
import assert from 'node:assert/strict';
import { PetCatalog } from '../../src/game/logic/pets/PetCatalog.ts';
import { PetInventory } from '../../src/game/logic/pets/PetInventory.ts';
import { PetEquipment } from '../../src/game/logic/pets/PetEquipment.ts';
import { calculatePetBonus, drawEgg, petBonusIn, selectBestPets } from '../../src/game/logic/pets/petRules.ts';
import { PetService } from '../../src/game/application/PetService.ts';
import { PetCommands } from '../../src/game/application/PetCommands.ts';
import { PetUiAdapter } from '../../src/game/application/PetUiAdapter.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { Wallet } from '../../src/game/logic/Wallet.ts';
import { PET_CONTENT } from './fixtures/pets.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
const LIVE_SESSION_CONTENT = GAME_CONTENT.session;

const SESSION_CONTENT = {...LIVE_SESSION_CONTENT, initialCoins:200, petContent:PET_CONTENT};
function goToEgg(session,eggId='meadow-egg') {
  const station=SESSION_CONTENT.eggStations.find(station=>station.eggId===eggId);
  session.updatePosition([station.zone.x,station.zone.y,station.zone.z],true);
}
const pet = (id, speciesId = 'moss-slime') => ({ id, speciesId, level: 1 });
const setup = (coins = 100, overrides = {}) => {
  const wallet = new Wallet({ gold: coins }); let serial = 0;
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
    c => { c.pets[0].bonusPct = -1; },
    c => { c.pets[0].currency = 'coin'; },
    c => { c.eggs[0].currency = undefined; },
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
  assert.equal(wallet.getBalance('gold'), 0); assert.equal(service.getInventory().count, 2);
  assert.deepEqual(service.getEquipment().slots, [null, null, null]);
  assert.equal(service.hatch('meadow-egg').status, 'insufficient-coins');
});

test('insufficient funds and unknown eggs do not consume randomness; bad IDs do not debit', () => {
  let draws = 0;
  const { service, wallet } = setup(9, { random: () => { draws++; return 0; } });
  assert.equal(service.hatch('missing').status, 'unknown-egg');
  assert.equal(service.hatch('meadow-egg').status, 'insufficient-coins');
  assert.equal(draws, 0); assert.equal(wallet.getBalance('gold'), 9);
  for (const createPetId of [() => '', () => 'same']) {
    const s = setup(20, { createPetId }); s.service.grant([pet('same')]);
    assert.throws(() => s.service.hatch('meadow-egg'));
    assert.equal(s.wallet.getBalance('gold'), 20); assert.equal(s.service.getInventory().count, 1);
  }
  const invalid = setup(20, { random: () => 1 });
  assert.throws(() => invalid.service.hatch('meadow-egg')); assert.equal(invalid.wallet.getBalance('gold'), 20);
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
  assert.equal(service.getInventory().count, 6); assert.deepEqual(service.getBonus(), { gold: 30, tech: 0, star: 0, mining: 30 });
  assert.equal(service.remove(['a', 'missing']), false); assert.equal(service.getEquipment().slots[0], 'a');
  assert.equal(service.remove(['a', 'b']), true); assert.deepEqual(service.getEquipment().slots, [null, null, 'c']);
  assert.equal(service.getBonus().gold, 10);
  const before = service.getInventory();
  assert.throws(() => service.grant([pet('valid'), pet('bad', 'unknown')])); assert.equal(service.getInventory(), before);
});

test('best equipment is deterministic, including ties, duplicates and small inventories', () => {
  const catalog = new PetCatalog(PET_CONTENT), read = id => catalog.pet(id);
  const owned = [pet('b'), pet('a'), pet('x', 'moon-dragon'), pet('y', 'amber-fox')];
  assert.deepEqual(selectBestPets(owned, read, 3, 'gold'), ['x', 'y', 'a']);
  assert.deepEqual(selectBestPets([...owned].reverse(), read, 3, 'gold'), ['x', 'y', 'a']);
  // In another currency's world that currency's pets come first, however strong the others are; the slots left go
  // to the strongest miners (every pet mines faster everywhere).
  const mixed = id => id === 'amber-fox' ? { ...catalog.pet(id), currency: 'tech' } : id === 'moon-dragon' ? { ...catalog.pet(id), miningPct: 50 } : catalog.pet(id);
  assert.deepEqual(selectBestPets(owned, mixed, 2, 'tech'), ['y', 'x']);
  assert.deepEqual(selectBestPets(owned, mixed, 3, 'star'), ['x', 'a', 'b']);
  const { service } = setup(); service.grant([pet('a')]); service.equipBest();
  assert.deepEqual(service.getEquipment().slots, ['a', null, null]); assert.equal(service.equipBest(), false);
  service.remove(['a']); assert.equal(service.equipBest(), false);
});

test('team bonuses add up per currency; a pet counts only in its own currency', () => {
  const catalog = new PetCatalog(PET_CONTENT), read = id => id === 'moon-dragon' ? { ...catalog.pet(id), currency: 'star' } : catalog.pet(id);
  assert.deepEqual(calculatePetBonus([pet('a'), pet('b'), pet('c', 'moon-dragon')], read), { gold: 20, tech: 0, star: 75, mining: 30 });
  assert.equal(petBonusIn(read('moon-dragon'), 'star'), 75); assert.equal(petBonusIn(read('moon-dragon'), 'gold'), 0);
});

test('restoring pets validates the whole candidate before replacing live state', () => {
  const { service } = setup(); service.grant([pet('a'), pet('b', 'moon-dragon')]); service.equip('b');
  const saved = service.exportData(), restored = setup().service; restored.restoreData(saved);
  assert.deepEqual(restored.exportData(), saved); assert.equal(restored.getBonus().gold, 75);
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
  const { service, wallet } = setup(30), listeners = new Set();
  let emissions = 0, currency = 'gold';
  const publish = () => { for (const listener of listeners) listener(); };
  const adapter = new PetUiAdapter(service, { balances: () => wallet.getBalances(), currency: () => currency, commands: new PetCommands(service, publish), subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } });
  const unsubscribe = adapter.subscribe(() => { emissions++; assert.equal(adapter.getSnapshot().balances.gold, wallet.getBalance('gold')); });
  const first = adapter.getSnapshot(); publish(); assert.equal(emissions, 0); assert.equal(adapter.getSnapshot(), first);
  const result = adapter.hatch('meadow-egg'); assert.equal(emissions, 1);
  assert.equal(adapter.getSnapshot().pets.length, 1); assert.equal(adapter.getSnapshot().balances.gold, 20);
  adapter.equip(result.pet.id); assert.equal(adapter.getSnapshot().bonus.gold, 10); assert.equal(emissions, 2);
  adapter.equip(result.pet.id); assert.equal(emissions, 2);
  const cards = adapter.getSnapshot().pets; wallet.debit('gold', 20); publish();
  assert.equal(adapter.getSnapshot().eggs[0].canAfford, false); assert.equal(adapter.getSnapshot().pets, cards);
  wallet.credit('tech', 10); publish(); assert.equal(adapter.getSnapshot().eggs[0].canAfford, false, 'other currencies do not buy a gold egg');
  wallet.credit('gold', 10); publish(); assert.equal(adapter.getSnapshot().eggs[0].canAfford, true);
  currency = 'tech'; publish(); assert.equal(adapter.getSnapshot().currency, 'tech'); assert.equal(emissions, 6);
  adapter.unequipAll(); assert.equal(adapter.getSnapshot().bonus.gold, 0);
  unsubscribe(); assert.equal(listeners.size, 0);
});

test('equipped pets raise what ore sells for in their currency and mine faster in every world', () => {
  let now = 0, serial = 0;
  const session = new GameSession(SESSION_CONTENT, 50, () => now, { random: () => 0, createPetId: () => `p${++serial}` });
  session.attach({ cell: () => 65, pending: () => false, mine: () => true, cancelMining() {} });
  goToEgg(session);
  const acquired = session.pets.hatch('meadow-egg'); assert.equal(acquired.status, 'hatched'); assert.equal(session.getSnapshot().coins, 190);
  session.pets.equip(acquired.pet.id); assert.equal(session.getSnapshot().saleMultiplier, 1.1);
  // +10 % mining: below the speed cap it is swing speed; the damage per hit stays the pickaxe's.
  assert.equal(session.getSnapshot().miningStats.speed, 2.2); assert.equal(session.getSnapshot().miningStats.power, session.getSnapshot().pickaxe.power);
  session.resetPosition(); assert.equal(session.hit([0, -1, 0]).damage, session.getSnapshot().pickaxe.power);
  assert.ok(Math.abs(session.combatDebug().nextAttackAt - 1 / 2.2) < 1e-9);
  session.collected(Array.from({ length: 20 }, () => ({ kind: 64 })));
  assert.deepEqual(session.getSnapshot().sale, { status: 'quoted', count: 20, coins: 22 });
  const sale = SESSION_CONTENT.sales[0]; session.updatePosition([sale.x, sale.y, sale.z], true);
  assert.equal(session.getSnapshot().coins, 212);
  session.pets.unequipAll(); assert.equal(session.getSnapshot().saleMultiplier, 1); assert.equal(session.getSnapshot().miningStats.speed, 2);
  // At the speed cap the pets' mining bonus becomes damage.
  const capped = session.exportProgress(); capped.pickaxe.level = capped.equipment.toolLevel = 12; capped.pets.equipment.slots = [acquired.pet.id, null, null];
  const strong = GameSession.fromData(capped, SESSION_CONTENT).getSnapshot();
  assert.equal(strong.miningStats.speed, 8); assert.equal(strong.miningStats.power, Math.round(strong.pickaxe.power * 1.1));
});

test('egg proximity derives from display configuration and clears on leaving or travel', () => {
  const session = new GameSession(SESSION_CONTENT), station = SESSION_CONTENT.eggStations[0];
  const { x, y, z } = station.zone;
  session.updatePosition([x, y, z], true); assert.equal(session.getSnapshot().eggId, station.eggId);
  session.updatePosition([x - 5, y, z], true); assert.equal(session.getSnapshot().eggId, null);
  session.updatePosition([x, y, z], true); session.resetPosition(); assert.equal(session.getSnapshot().eggId, null);
});


test('explicit fixture starting coins are granted once, independent from UI subscriptions and egg visits', () => {
  const session = new GameSession(SESSION_CONTENT);
  assert.equal(session.getSnapshot().coins, 200);
  goToEgg(session);
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
  goToEgg(custom);
  assert.equal(custom.pets.hatch('meadow-egg').status,'insufficient-coins');
});

test('five identical ordinary pets merge into one golden pet with both bonuses ×2.5, unequipped ones first', () => {
  const { service } = setup(); service.grant(['a', 'b', 'c', 'd', 'e', 'f'].map(id => pet(id)));
  service.equip('a'); service.equip('f');
  assert.equal(service.mergeable('moss-slime'), 6);
  const merged = service.mergeGolden('moss-slime');
  assert.equal(merged.status, 'merged'); assert.equal(merged.pet.golden, true);
  // b-e (unequipped) and one equipped pet went; the golden pet took that pet's slot.
  assert.equal(service.getInventory().count, 2); assert.equal(service.mergeable('moss-slime'), 1);
  const slots = service.getEquipment().slots; assert.ok(slots.includes(merged.pet.id)); assert.equal(slots.filter(Boolean).length, 2);
  const read = id => new PetCatalog(PET_CONTENT).pet(id), base = read('moss-slime');
  assert.equal(service.getBonus().gold, Math.round(base.bonusPct * 2.5) + base.bonusPct);
  assert.equal(service.getBonus().mining, Math.round(base.miningPct * 2.5) + base.miningPct);
  assert.equal(service.mergeGolden('moss-slime').status, 'not-enough'); assert.equal(service.mergeGolden('missing').status, 'unknown');
  // Golden pets save and load; a golden flag other than true is rejected.
  const saved = service.exportData(), restored = setup().service; restored.restoreData(saved); assert.deepEqual(restored.exportData(), saved);
  const bad = structuredClone(saved); bad.inventory.pets[0].golden = 'yes'; assert.throws(() => setup().service.restoreData(bad));
});

test('bought pet slots widen the team up to the most, survive a reload and are filled by equip best', () => {
  const content = { ...PET_CONTENT, maxEquipSlots: 5 }, wallet = new Wallet({ gold: 100 }); let serial = 0;
  const service = new PetService({ content, wallet, random: () => 0, createPetId: () => `w-${++serial}` });
  service.grant(['a', 'b', 'c', 'd', 'e', 'f'].map(id => pet(id)));
  assert.equal(service.addSlot(), true); assert.equal(service.addSlot(), true); assert.equal(service.addSlot(), false);
  service.equipBest(); assert.equal(service.getEquipment().slots.filter(Boolean).length, 5);
  const restored = new PetService({ content, wallet, random: () => 0, createPetId: () => 'x' }); restored.restoreData(service.exportData());
  assert.equal(restored.getEquipment().slots.length, 5);
  const tooMany = service.exportData(); tooMany.equipment.slots.push(null); assert.throws(() => restored.restoreData(tooMany));
});
