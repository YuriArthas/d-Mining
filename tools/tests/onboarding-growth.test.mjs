import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { worldRequirement, worldSpawn } from '../../src/game/content/worldJourney.ts';
import { BASIC_TIP_IDS } from '../../src/game/logic/Onboarding.ts';
import { TIP_SECONDS } from '../../src/game/application/Tips.ts';

const content = GAME_CONTENT.session;
let now = 0;
const saved = () => {
  const data = new GameSession(content).exportProgress();
  data.onboarding = { ...data.onboarding, status: 'completed', seen: [...BASIC_TIP_IDS], minedOnce: true, soldOnce: true };
  return data;
};
function session(data, source = content) {
  now = 0;
  const s = new GameSession(source, 25, () => now, {}, data), travels = [];
  s.attach({ cell: () => 64, pending: () => false, mine: () => true, cancelMining() {}, travelTo: (feet, look) => travels.push({ feet, look }) });
  return { s, travels };
}
const tip = s => s.getSnapshot().tip?.id;
const firstLayer = content.destinations.find(d => d.worldId === 1);
function explored() {
  const data = saved();
  data.worldExploration['1'] = { version: 1, maxDepth: firstLayer.depth, unlockedDestinationIds: [firstLayer.id] };
  return data;
}
function ticketSave(id) {
  const data = saved(), ticket = worldRequirement(id).ticket;
  data.onboarding.seen.push('station', 'portal');
  data.worldProgress = { version: 2, openWorlds: id === 3 ? [1, 2] : [1] };
  data.pickaxe.level = ticket.toolLevel; data.equipment.toolLevel = ticket.toolLevel;
  data.wallet.balances[ticket.currency] = ticket.price;
  data.materials = { version: 1, items: Object.fromEntries(ticket.materials.map(m => [m.itemId, m.count])) };
  return data;
}

test('first egg hint respects affordability and access; following it only travels, never hatches or spends', () => {
  const data = saved(), egg = content.petContent.eggs.find(e => e.id === content.onboarding.eggId);
  data.onboarding.status = 'active'; data.onboarding.seen = ['dig', 'sell', 'shop'];
  data.wallet.balances[egg.currency] = egg.price - 1;
  let { s } = session(data); s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), undefined);
  data.wallet.balances[egg.currency] = egg.price;
  const run = session(data); s = run.s; s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'pets');
  const before = s.exportProgress(); assert.equal(s.followTip('pets'), true);
  const station = content.eggStations.find(e => e.eggId === egg.id);
  assert.deepEqual(run.travels[0].feet, [station.zone.x, station.zone.y + .1, station.zone.z]);
  assert.deepEqual(s.exportProgress().wallet, before.wallet); assert.deepEqual(s.exportProgress().pets, before.pets);
  assert.ok(s.exportProgress().onboarding.seen.includes('pets')); assert.equal(s.followTip('pets'), false);
  const lockedContent = { ...content, petContent: { ...content.petContent, eggs: content.petContent.eggs.map(e => ({ ...e, requiredDestination: firstLayer.id })) } };
  ({ s } = session(data, lockedContent)); s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), undefined, 'locked eggs are not suggested');
});

test('layer travel is introduced after unlocking and returning to the surface; reaching the station opens the existing selector', () => {
  let run = session(saved()); run.s.updatePosition(worldSpawn(1), true); assert.equal(tip(run.s), undefined);
  run = session(explored()); const { s, travels } = run;
  s.updatePosition([0, -firstLayer.depth, 0], true); assert.notEqual(tip(s), 'station');
  s.dismissTip(); now += 7; s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'station');
  assert.equal(s.followTip('station'), true);
  const zone = content.stations.find(p => p.worldId === 1).zone;
  assert.deepEqual(travels[0].feet, [zone.x, zone.y + .1, zone.z]);
  s.updatePosition([zone.x, zone.y, zone.z], true); assert.equal(s.getSnapshot().atStation, true);
  const restored = session(s.exportProgress()).s; restored.updatePosition(worldSpawn(1), true); assert.notEqual(tip(restored), 'station');
});

test('world-ticket introduction starts after underground exploration and only takes the player to the portal', () => {
  const { s, travels } = session(explored());
  s.updatePosition([0, -firstLayer.depth, 0], true); assert.equal(tip(s), 'portal');
  const before = s.exportProgress(); assert.equal(s.followTip('portal'), true);
  const zone = content.portals.find(p => p.worldId === 1).zone;
  assert.deepEqual(travels[0].feet, [zone.x, zone.y + .1, zone.z]);
  assert.deepEqual(s.exportProgress().worldProgress, before.worldProgress);
  assert.deepEqual(s.exportProgress().wallet, before.wallet);
});

for (const id of [2, 3]) test(`world ${id}: exact level, currency and minerals are all required; the hint never pays the ticket`, () => {
  const ticket = worldRequirement(id).ticket;
  for (const missing of ['level', 'coins', 'minerals']) {
    const data = ticketSave(id);
    if (missing === 'level') { data.pickaxe.level--; data.equipment.toolLevel--; }
    if (missing === 'coins') data.wallet.balances[ticket.currency]--;
    if (missing === 'minerals') data.materials.items[ticket.materials[0].itemId]--;
    const { s } = session(data); s.updatePosition(worldSpawn(id - 1), true); assert.notEqual(tip(s), `world${id}`, missing);
  }
  const { s, travels } = session(ticketSave(id)); s.updatePosition(worldSpawn(id - 1), true);
  assert.equal(tip(s), `world${id}`); const before = s.exportProgress(); assert.equal(s.followTip(`world${id}`), true);
  assert.deepEqual(s.exportProgress().wallet, before.wallet); assert.deepEqual(s.exportProgress().materials, before.materials);
  assert.deepEqual(s.exportProgress().worldProgress, before.worldProgress);
  const zone = content.portals.find(p => p.worldId === id - 1).zone;
  assert.deepEqual(travels[0].feet, [zone.x, zone.y + .1, zone.z]);
  s.updatePosition([zone.x, zone.y, zone.z], true); assert.equal(s.unlockWorld(id).status, 'opened', 'the same exact resources pass the real unlock command');
  const restored = session(s.exportProgress()).s; restored.updatePosition(worldSpawn(id - 1), true); assert.notEqual(tip(restored), `world${id}`);
});

test('full bag interrupts growth advice without consuming it; a covered or dismissed hint behaves correctly', () => {
  const { s } = session(explored()); s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'station');
  s.collected(Array.from({ length: 25 }, () => ({ kind: 64 })));
  assert.equal(tip(s), undefined); assert.equal(s.getSnapshot().onboarding.seen.includes('station'), false);
  now += 100; s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), undefined);
  const sale = content.sales.find(z => z.y >= 0); s.updatePosition([sale.x, sale.y, sale.z], true);
  s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'station');
  s.coverTips(true); now += TIP_SECONDS.station + 5; s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'station');
  s.coverTips(false); s.dismissTip('station');
  const restored = session(s.exportProgress()).s; restored.updatePosition(worldSpawn(1), true); assert.notEqual(tip(restored), 'station');
});

test('a consumed ticket balance retracts the unlock hint without marking it seen', () => {
  const data = ticketSave(2), { s } = session(data); s.updatePosition(worldSpawn(1), true); assert.equal(tip(s), 'world2');
  const egg = content.eggStations.find(e => e.eggId === content.onboarding.eggId).zone;
  s.updatePosition([egg.x, egg.y, egg.z], true); assert.equal(s.pets.hatch(content.onboarding.eggId).status, 'hatched');
  assert.notEqual(tip(s), 'world2'); assert.equal(s.getSnapshot().onboarding.seen.includes('world2'), false);
  s.devGrantCoins(1000); assert.equal(tip(s), 'world2');
});
