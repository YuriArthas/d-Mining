import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../../src/game/application/GameSession.ts';
import { GAME_CONTENT } from '../../src/game/content/gameContent.ts';
import { CAPSULE_MACHINE_ZONE } from '../../src/game/content/feedbackFacilities.ts';
import { ECONOMY } from '../../src/game/content/economy.ts';
import { parseInviteCode } from '../../src/game/logic/InviteCode.ts';
import { initPhysics, CharacterPhysics, RAPIER } from '../../src/game/validation/physics.ts';
const SESSION_CONTENT = GAME_CONTENT.session, EGG = SESSION_CONTENT.petContent.eggs.find(e => e.id === 'meadow-egg').price;

const DAY = '2026-10-18';
const origin = new GameSession(SESSION_CONTENT, 50, undefined, { rewards: { day: () => DAY, createInviteId: () => 'review-player-own' } }).exportProgress();
function sessionWith(change = () => {}, dependencies = {}) {
  const data = structuredClone(origin);
  change(data);
  delete data.equipment; // Legacy fixture sets the active gear directly.
  return new GameSession(SESSION_CONTENT, 50, undefined, {
    ...dependencies,
    rewards: { day: () => DAY, random: () => 0, ...dependencies.rewards },
  }, data);
}
function atMachine(session) {
  const z = CAPSULE_MACHINE_ZONE; session.updatePosition([z.x, z.y, z.z], true);
  assert.equal(session.getSnapshot().atMachine, true);
}
function atEgg(session) {
  const station = SESSION_CONTENT.eggStations.find(s => s.eggId === 'meadow-egg'), z = station.zone;
  session.updatePosition([z.x, z.y, z.z], true);
  assert.equal(session.getSnapshot().eggId, 'meadow-egg');
}

test('capsule spend and deepest-stage coin award appear in one persisted receipt and do not teach selling', () => {
  const session = sessionWith(data => { data.rewards.balance = 2; data.worldExploration[1].maxDepth = 800; });
  atMachine(session);
  const captures = []; session.onProgressCommitted(({ urgent }) => { if (urgent) captures.push(session.exportProgress()); });
  const award = session.getSnapshot().capsuleCoins, coins = session.getSnapshot().coins;
  // 800 m reaches world 1's fifth rest layer: the prize is about two minutes of income there, in gold.
  assert.equal(award, ECONOMY.layers[5].capsuleCoins); assert.equal(session.getSnapshot().capsuleCurrency, 'gold');
  assert.equal(session.spinCapsule().coinReward, award);
  assert.equal(captures.length, 1);
  assert.equal(captures[0].wallet.balances.gold, coins + award);
  assert.equal(captures[0].rewards.balance, 1);
  assert.equal(captures[0].onboarding.soldOnce, false);
  const restored = GameSession.fromData(captures[0], SESSION_CONTENT);
  assert.equal(restored.getSnapshot().coins, coins + award);
  assert.equal(restored.getSnapshot().capsuleCoins, award);
});

test('permanent mining win changes real mining stats and retains value at the speed cap', () => {
  for (const level of [1, 16, 26]) {
    const session = sessionWith(data => { data.pickaxe.level = level; data.rewards.balance = 2; }, { rewards: { random: () => 0.77 } });
    atMachine(session);
    const before = session.getSnapshot().miningStats;
    const won = session.spinCapsule(), after = session.getSnapshot().miningStats;
    assert.equal(won.reward, 'mining'); assert.equal(won.duplicate, false);
    assert.ok(after.power * after.speed >= before.power * before.speed * 1.49);
    assert.ok(after.speed <= 4 * ECONOMY.tools[0].speed);
    assert.equal(session.spinCapsule().duplicate, true);
    assert.deepEqual(session.getSnapshot().miningStats, after);
    assert.deepEqual(GameSession.fromData(session.exportProgress(), SESSION_CONTENT).getSnapshot().miningStats, after);
  }
});

test('lucky probability refresh and actual hatch share the same boundaries, including expiration', () => {
  let rolls = 0, ids = 0;
  const boosted = sessionWith(data => { data.rewards.timed.luck = 2; data.wallet.balances.gold = 3 * EGG; }, { random: () => { rolls++; return 0.5; }, createPetId: () => `lucky-${++ids}` });
  const baseline = sessionWith();
  atEgg(boosted);
  const boostedEgg = boosted.pets.getSnapshot().eggs.find(e => e.id === 'meadow-egg');
  const normalEgg = baseline.pets.getSnapshot().eggs.find(e => e.id === 'meadow-egg');
  for (const outcome of boostedEgg.outcomes) {
    if (outcome.rarity !== 'common') assert.ok(Math.abs(outcome.probability - normalEgg.outcomes.find(o => o.speciesId === outcome.speciesId).probability * 2) < 1e-12);
  }
  assert.equal(rolls, 0);
  const first = boosted.pets.hatch('meadow-egg');
  assert.equal(first.status, 'hatched'); assert.equal(first.pet.speciesId, 'amber-fox');
  boosted.advanceOnline(2);
  const expired = boosted.pets.getSnapshot().eggs.find(e => e.id === 'meadow-egg');
  assert.deepEqual(expired.outcomes, normalEgg.outcomes);
  const second = boosted.pets.hatch('meadow-egg');
  assert.equal(second.status, 'hatched'); assert.equal(second.pet.speciesId, 'quarry-mole');
  assert.equal(rolls, 2); assert.equal(boosted.getSnapshot().coins, EGG);
});

test('auto hatch charges real egg price, commits each pet once and stops when money runs out', () => {
  let id = 0;
  const session = sessionWith(data => { data.wallet.balances.gold = 2 * EGG; data.rewards.permanent.autoHatch = true; }, { createPetId: () => `auto-${++id}`, random: () => 0 });
  atEgg(session); const captures = [];
  session.onProgressCommitted(({ urgent }) => { if (urgent) captures.push(session.exportProgress()); });
  assert.equal(session.setAutoHatch(true), true);
  session.advanceOnline(1); assert.equal(session.getSnapshot().coins, 2 * EGG);
  session.advanceOnline(1); assert.equal(session.getSnapshot().coins, EGG);
  session.advanceOnline(2); assert.equal(session.getSnapshot().coins, 0);
  session.advanceOnline(2); assert.equal(session.getSnapshot().autoHatch, null);
  assert.equal(captures.length, 2);
  assert.equal(captures[0].pets.inventory.pets.length, 1); assert.equal(captures[0].wallet.balances.gold, EGG);
  assert.equal(captures[1].pets.inventory.pets.length, 2); assert.equal(captures[1].wallet.balances.gold, 0);
  assert.equal(GameSession.fromData(captures[1], SESSION_CONTENT).pets.getSnapshot().pets.length, 2);
});

test('leaving an egg station, explicit stop, or suspension prevents the next automatic purchase', () => {
  for (const stop of [s => s.updatePosition([0, 0, 40], true), s => s.setAutoHatch(false), s => s.setSuspended(true)]) {
    const session = sessionWith(data => { data.wallet.balances.gold = 2 * EGG; data.rewards.permanent.autoHatch = true; });
    atEgg(session); assert.equal(session.setAutoHatch(true), true); session.advanceOnline(1);
    stop(session); session.advanceOnline(5);
    assert.equal(session.getSnapshot().coins, 2 * EGG);
    assert.equal(session.pets.getSnapshot().pets.length, 0);
    assert.equal(session.exportProgress().pets.inventory.pets.length, 0);
  }
});

test('travel works from a mine for everyone, while locked floors stay rejected', () => {
  const reached = SESSION_CONTENT.destinations[0], locked = SESSION_CONTENT.destinations[1];
  const session = sessionWith(data => { data.worldExploration[1].maxDepth = reached.depth; });
  const arrivals = []; session.attach({ cell: () => 0, pending: () => false, mine: () => false, cancelMining() {}, travelTo: position => arrivals.push(position) });
  session.updatePosition([0, -20, 0], false);
  assert.equal(session.travelTo(locked.id), 'locked');
  assert.equal(session.travelTo(reached.id), 'travelling');
  assert.deepEqual(arrivals, [reached.spawn]);
});

test('failed clipboard does not award; copied WeChat and Douyin text redeem and share one daily reward', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://mining.example',pathname:'/games/mining/index.html'}});
  try {
    const session = sessionWith(), captures = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
    assert.equal((await session.shareReward('wechat')).status, 'clipboard-failed');
    assert.equal(session.getSnapshot().rewards.balance, 0);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { captures.push(text); } } });
    assert.equal((await session.shareReward('wechat')).status, 'claimed');
    assert.equal((await session.shareReward('douyin')).status, 'already-claimed');
    assert.equal(session.getSnapshot().rewards.balance, 1);
    assert.equal(captures.length, 2);
    for (const text of captures) assert.equal(parseInviteCode(text), session.getSnapshot().rewards.inviteId);
    const redeemer = sessionWith(data => { data.rewards.inviteId = 'other-review-player'; });
    assert.equal(redeemer.redeemInvite(captures[0]).status, 'claimed');
    assert.equal(redeemer.getSnapshot().rewards.balance, 2);
    assert.equal(session.getSnapshot().rewards.balance, 1);
  } finally {
    if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else delete navigator.clipboard;
  }
});

await initPhysics();
test('double movement multiplier doubles ground distance while the character still collides with walls', () => {
  function measure(multiplier, wall = false) {
    const physics = new CharacterPhysics();
    try {
      physics.world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0));
      if (wall) physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 5, 10).setTranslation(4, 5, 0));
      physics.teleport([0, 0.05, 0]);
      for (let i = 0; i < 30; i++) physics.tick(0, 0, 0, false, true, multiplier);
      for (let i = 0; i < 60; i++) physics.tick(1, 0, 0, false, true, multiplier);
      assert.equal(physics.grounded, true);
      return physics.feet()[0];
    } finally { physics.dispose(); }
  }
  const normal = measure(1), fast = measure(2);
  assert.ok(Math.abs(fast / normal - 2) < 0.01);
  assert.ok(measure(2, true) < 3.6);
});
