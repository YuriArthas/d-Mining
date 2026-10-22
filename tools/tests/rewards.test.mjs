import test from 'node:test';
import assert from 'node:assert/strict';
import { Rewards, localRewardDay } from '../../src/game/logic/Rewards.ts';
import { createInviteCode, parseInviteCode } from '../../src/game/logic/InviteCode.ts';
import { stageCoinReward } from '../../src/game/content/rewards.ts';

const DAY = '2026-10-18';
const make = (options = {}) => new Rewards({ day: () => DAY, createInviteId: () => 'own-invite-001', ...options });
const funded = (balance, random = () => 0) => {
  const data = make().exportData(); data.balance = balance;
  return Rewards.fromData(data, { day: () => DAY, random });
};

test('new rewards have an independent zero balance and restore without generating identity or offline time', () => {
  const rewards = make();
  assert.equal(rewards.getSnapshot().balance, 0);
  rewards.advance(42); rewards.claimDaily();
  const data = rewards.exportData();
  const restored = Rewards.fromData(data, { day: () => '2026-11-01', createInviteId: () => { throw Error('must not generate'); } });
  assert.deepEqual(restored.exportData(), data);
  assert.equal(parseInviteCode(restored.getSnapshot().inviteCode), 'own-invite-001');
  data.balance = 999; data.permanent.mining = true; data.timed.speed = 10; data.onlineClaimed.push(30);
  assert.equal(restored.getSnapshot().balance, 1);
  assert.equal(restored.getSnapshot().permanent.mining, false);
  assert.deepEqual(restored.getSnapshot().onlineClaimed, []);
  assert.deepEqual(restored.advance(0, DAY), { changed: false, clockReversed: false });
});

test('missing, corrupted and unknown-version reward saves fail explicitly', () => {
  const valid = make().exportData();
  for (const invalid of [undefined, null, {}, { ...valid, version: 2 }, { ...valid, extra: 1 }]) {
    assert.throws(() => Rewards.fromData(invalid));
  }
  const patches = [
    { balance: -1 }, { balance: 1.5 }, { balance: Number.MAX_SAFE_INTEGER + 1 },
    { inviteId: 'short' }, { day: '2026-02-30' }, { day: '18/10/2026' },
    { onlineSeconds: Infinity }, { onlineSeconds: -1 }, { onlineClaimed: [5] },
    { onlineSeconds: 300, onlineClaimed: [5, 5] }, { onlineSeconds: 600, onlineClaimed: [7] }, { onlineClaimed: new Array(1) },
    { lastSigninDay: DAY }, { signinStreak: 1 }, { lastShareDay: '2026-10-19' },
    { lastSigninDay: '2026-10-19', signinStreak: 1 },
    { redeemedInviteId: valid.inviteId }, { redeemedInviteId: 'invalid' },
    { permanent: { mining: 1, travel: false, autoHatch: false } },
    { timed: { speed: NaN, luck: 0 } }, { timed: { speed: 0 } },
  ];
  for (const patch of patches) assert.throws(() => Rewards.fromData({ ...valid, ...patch }), JSON.stringify(patch));
});

test('each daily online threshold is collectible once and persists across reload', () => {
  let rewards = make();
  assert.equal(rewards.claimOnline(5).status, 'not-ready');
  rewards.advance(299);
  assert.equal(rewards.claimOnline(5).status, 'not-ready');
  rewards.advance(1);
  assert.deepEqual(rewards.claimOnline(5), { status: 'claimed', amount: 1 });
  rewards = Rewards.fromData(rewards.exportData(), { day: () => DAY });
  assert.equal(rewards.claimOnline(5).status, 'already-claimed');
  assert.equal(rewards.claimOnline(10).status, 'not-ready');
  rewards.advance(1500);
  for (const minute of [30, 10, 20]) assert.deepEqual(rewards.claimOnline(minute), { status: 'claimed', amount: 1 });
  assert.equal(rewards.getSnapshot().balance, 4);
  const before = rewards.exportData();
  assert.throws(() => rewards.claimOnline(7));
  assert.deepEqual(rewards.exportData(), before);
});

test('a new local day resets only its online progress; backward dates do not reopen old claims', () => {
  const rewards = make(); rewards.advance(1800); rewards.claimOnline(5); rewards.claimShare(); rewards.claimDaily();
  const balance = rewards.getSnapshot().balance;
  assert.deepEqual(rewards.advance(12, '2026-10-19'), { changed: true, clockReversed: false });
  assert.equal(rewards.getSnapshot().onlineSeconds, 12);
  assert.deepEqual(rewards.getSnapshot().onlineClaimed, []);
  assert.equal(rewards.claimOnline(5, '2026-10-19').status, 'not-ready');
  assert.equal(rewards.claimOnline(5, DAY).status, 'clock-reversed');
  assert.equal(rewards.claimShare(DAY).status, 'clock-reversed');
  assert.equal(rewards.claimDaily(DAY).status, 'clock-reversed');
  assert.equal(rewards.advance(1800, DAY).clockReversed, true);
  assert.equal(rewards.getSnapshot().onlineSeconds, 12);
  assert.equal(rewards.getSnapshot().balance, balance);
  assert.equal(rewards.claimShare('2026-10-19').status, 'claimed');
});

test('daily sign-in follows seven-day schedule, survives duplicate calls and resets after a missed day', () => {
  let rewards = make();
  const earned = [];
  for (let day = 18; day <= 25; day++) {
    const date = `2026-10-${day}`;
    earned.push(rewards.claimDaily(date).amount);
    rewards = Rewards.fromData(rewards.exportData(), { day: () => date });
    assert.equal(rewards.claimDaily(date).status, 'already-claimed');
  }
  assert.deepEqual(earned, [1, 1, 1, 2, 2, 2, 3, 1]);
  assert.equal(rewards.getSnapshot().signinStreak, 8);
  assert.deepEqual(rewards.claimDaily('2026-10-27'), { status: 'claimed', amount: 1 });
  assert.equal(rewards.getSnapshot().signinStreak, 1);
});

test('sign-in consecutive calendar days work across month boundaries and leap days', () => {
  const rewards = make({ day: () => '2028-02-28' });
  rewards.claimDaily('2028-02-28'); rewards.claimDaily('2028-02-29'); rewards.claimDaily('2028-03-01');
  assert.equal(rewards.getSnapshot().signinStreak, 3);
  rewards.claimDaily('2028-04-30'); rewards.claimDaily('2028-05-01');
  assert.equal(rewards.getSnapshot().signinStreak, 2);
  assert.match(localRewardDay(new Date(2026, 9, 8, 23, 42)), /^2026-10-08$/);
});

test('both sharing platforms use one daily claim, retained on reload', () => {
  const rewards = make();
  assert.equal(rewards.getSnapshot().balance, 0); // Clipboard failure does not call the command.
  assert.deepEqual(rewards.claimShare(), { status: 'claimed', amount: 1 });
  const restored = Rewards.fromData(rewards.exportData(), { day: () => DAY });
  assert.equal(restored.claimShare().status, 'already-claimed');
  assert.equal(restored.getSnapshot().balance, 1);
  assert.equal(restored.claimShare('2026-10-19').status, 'claimed');
  assert.equal(restored.getSnapshot().balance, 2);
});

test('invite code has version and identifier only, detects damage, and accepts a copied share paragraph', () => {
  const code = createInviteCode('friend-invite-002');
  assert.equal(parseInviteCode(code), 'friend-invite-002');
  assert.equal(parseInviteCode(`一起挖矿！\nhttps://example.com/games/mining-test/index.html\n邀请码：${code}\n进入游戏兑换。`), 'friend-invite-002');
  assert.equal(parseInviteCode(`【${code}】`), 'friend-invite-002');
  for (const damaged of [
    '', code.replace('MINING:1:', 'MINING:2:'), code.replace('friend', 'friemd'),
    `${code}:999999`, `${code}x`, `${code}\n${code}`, code.slice(0, -1), 'x'.repeat(4097),
  ]) assert.equal(parseInviteCode(damaged), null, damaged);
  assert.throws(() => createInviteCode('id'));
});

test('only the redeemer gains two tokens, never self-redeems and never redeems a second invitation', () => {
  const inviter = make({ createInviteId: () => 'friend-invite-002' });
  let redeemer = make();
  const start = redeemer.exportData();
  assert.equal(redeemer.redeemInvite('bad').status, 'invalid-invite');
  assert.equal(redeemer.redeemInvite(redeemer.getSnapshot().inviteCode).status, 'self-invite');
  assert.deepEqual(redeemer.exportData(), start);
  assert.deepEqual(redeemer.redeemInvite(inviter.getSnapshot().inviteCode), { status: 'claimed', amount: 2 });
  assert.equal(inviter.getSnapshot().balance, 0);
  assert.equal(redeemer.getSnapshot().balance, 2);
  redeemer = Rewards.fromData(redeemer.exportData());
  assert.equal(redeemer.redeemInvite(createInviteCode('another-player-003')).status, 'already-claimed');
  assert.equal(redeemer.getSnapshot().balance, 2);
});

test('capsule sample boundaries match the configured 65/10/5/5/5/10 distribution', () => {
  const expected = [
    [0, 'coins'], [0.64999, 'coins'], [0.65, 'speed'], [0.74999, 'speed'],
    [0.75, 'mining'], [0.79999, 'mining'], [0.8, 'travel'], [0.84999, 'travel'],
    [0.85, 'autoHatch'], [0.89999, 'autoHatch'], [0.9, 'luck'], [0.99999, 'luck'],
  ];
  for (const [sample, reward] of expected) {
    const rewards = funded(1, () => sample);
    const result = rewards.spin(700);
    assert.equal(result.status, 'spun'); assert.equal(result.reward, reward, String(sample));
    assert.equal(result.coinReward, reward === 'coins' ? 700 : 0);
    assert.equal(rewards.getSnapshot().balance, 0);
  }
});

test('spins require funds, never reroll on snapshot, and invalid randomness has no partial mutation', () => {
  let calls = 0;
  const rewards = funded(1, () => { calls++; return 0; });
  const result = rewards.spin(200);
  assert.equal(result.coinReward, 200);
  rewards.getSnapshot(); rewards.exportData();
  assert.equal(calls, 1);
  const empty = rewards.exportData();
  assert.equal(rewards.spin(200).status, 'insufficient-currency');
  assert.equal(calls, 1); assert.deepEqual(rewards.exportData(), empty);
  for (const sample of [-0.1, 1, NaN, Infinity]) {
    const invalid = funded(1, () => sample), before = invalid.exportData();
    assert.throws(() => invalid.spin(200));
    assert.deepEqual(invalid.exportData(), before);
  }
  const broken = funded(1, () => { throw Error('random unavailable'); }), before = broken.exportData();
  assert.throws(() => broken.spin(200), /random unavailable/); assert.deepEqual(broken.exportData(), before);
  for (const price of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => broken.spin(price)); assert.deepEqual(broken.exportData(), before);
  }
});

test('each permanent entitlement is granted once and repeat wins return caller-scaled coins', () => {
  for (const [sample, entitlement] of [[0.77, 'mining'], [0.82, 'travel'], [0.87, 'autoHatch']]) {
    let rewards = funded(2, () => sample);
    let result = rewards.spin(300);
    assert.equal(result.duplicate, false); assert.equal(result.coinReward, 0);
    assert.equal(rewards.getSnapshot().permanent[entitlement], true);
    rewards = Rewards.fromData(rewards.exportData(), { random: () => sample });
    result = rewards.spin(1200);
    assert.equal(result.duplicate, true); assert.equal(result.coinReward, 1200);
    assert.equal(rewards.getSnapshot().permanent[entitlement], true);
    assert.equal(rewards.getSnapshot().balance, 0);
  }
});

test('timed buffs extend by five minutes, survive save without offline loss and expire independently', () => {
  let sample = 0.7;
  let rewards = funded(3, () => sample);
  assert.equal(rewards.spin(100).durationSeconds, 300);
  rewards.advance(60);
  rewards.spin(100);
  assert.equal(rewards.getSnapshot().timed.speed, 540);
  sample = 0.95; rewards.spin(100);
  assert.deepEqual(rewards.getSnapshot().timed, { speed: 540, luck: 300 });
  rewards = Rewards.fromData(rewards.exportData(), { day: () => '2026-11-19' });
  assert.deepEqual(rewards.getSnapshot().timed, { speed: 540, luck: 300 });
  rewards.advance(301);
  assert.deepEqual(rewards.getSnapshot().timed, { speed: 239, luck: 0 });
  rewards.advance(239);
  assert.deepEqual(rewards.getSnapshot().timed, { speed: 0, luck: 0 });
  const before = rewards.exportData();
  for (const bad of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => rewards.advance(bad));
  assert.deepEqual(rewards.exportData(), before);
});

test('clock rollback blocks daily rewards but cannot freeze active timed buffs', () => {
  const rewards = funded(1, () => 0.7); rewards.spin(100);
  assert.deepEqual(rewards.advance(60, '2026-10-17'), { changed: true, clockReversed: true });
  assert.equal(rewards.getSnapshot().timed.speed, 240);
  assert.equal(rewards.getSnapshot().onlineSeconds, 0);
});

test('balance and timed overflow fail without committing a claim, spend or entitlement', () => {
  const rich = funded(Number.MAX_SAFE_INTEGER), before = rich.exportData();
  assert.throws(() => rich.claimDaily()); assert.deepEqual(rich.exportData(), before);
  assert.throws(() => rich.claimShare()); assert.deepEqual(rich.exportData(), before);
  assert.throws(() => rich.redeemInvite(createInviteCode('friend-invite-002'))); assert.deepEqual(rich.exportData(), before);
  rich.advance(300); const onlineBefore = rich.exportData();
  assert.throws(() => rich.claimOnline(5)); assert.deepEqual(rich.exportData(), onlineBefore);
  const data = funded(1).exportData(); data.timed.speed = Number.MAX_SAFE_INTEGER;
  const long = Rewards.fromData(data, { random: () => 0.7 });
  assert.throws(() => long.spin(100)); assert.deepEqual(long.exportData(), data);
});

test('stage coins use the configured base-price multiplier and reject unsafe inputs', () => {
  assert.equal(stageCoinReward(1), 100); assert.equal(stageCoinReward(18), 1800);
  for (const bad of [0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => stageCoinReward(bad));
});
