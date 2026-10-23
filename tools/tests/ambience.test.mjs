import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeContext, seeded } from './fixtures/fakeAudio.mjs';
import { Ambience, ZONES } from '../../src/game/audio/ambience.ts';
import { Soundscape } from '../../src/game/audio/soundscape.ts';
import { makeLoopNoise, makeNoise } from '../../src/game/audio/synth.ts';

test('地表：白天鼓点齐全，入夜鼓组渐歇；下到矿井曲子变闷、换洞穴声；在洞口跳一下不会来回切换', () => {
  const s = new Soundscape();
  const noon = s.scene({ theme: 'meadow_mine', surfaceLight: 1, daylight: 1 });
  assert.deepEqual([noon.song, noon.ambience, noon.rhythm, noon.muffle, noon.cave], ['meadow', 'meadow', 1, 0, 0]);
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 1, daylight: 0 }).rhythm, 0, 'no drums at night');
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.45, daylight: 1 }).ambience, 'meadow', 'still outdoors at the rim');
  const shaft = s.scene({ theme: 'meadow_mine', surfaceLight: 0.2, daylight: 1 });
  assert.deepEqual([shaft.song, shaft.ambience, shaft.muffle, shaft.rhythm], ['meadow', 'shallow', 1, 0]);
  assert.ok(shaft.cave > 0, 'effects echo underground');
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.5, daylight: 1 }).ambience, 'shallow', 'hysteresis: a jump does not flip back');
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.7, daylight: 1 }).ambience, 'meadow');
  const deep = s.scene({ theme: 'frozen_cave', surfaceLight: 0, daylight: 1 });
  assert.deepEqual([deep.song, deep.ambience, deep.muffle], ['ice', 'ice', 0]);
});

function ambience(id, daylight = 1) {
  const ctx = new FakeContext({ time: 0, rate: 4000 }), dry = ctx.createGain(), wet = ctx.createGain();
  const a = new Ambience(ctx, dry, wet, makeNoise(ctx, 0.5), makeLoopNoise(ctx, 1), seeded(3));
  a.setScene({ id, daylight });
  const run = seconds => { for (let t = 0; t < seconds; t += 0.1) { ctx.currentTime = +(ctx.currentTime + 0.1).toFixed(6); a.tick(); } };
  return { ctx, a, run };
}

test('白天有鸟叫没有虫鸣，夜里反过来；风声一直在', () => {
  const day = ambience('meadow', 1);
  day.run(60);
  assert.ok(day.a.played.bird >= 8, `birds by day: ${day.a.played.bird}`);
  assert.equal(day.a.played.cricket ?? 0, 0);
  const night = ambience('meadow', 0);
  night.run(30);
  assert.ok(night.a.played.cricket >= 20, `crickets at night: ${night.a.played.cricket}`);
  assert.equal(night.a.played.bird ?? 0, 0);
  assert.equal(night.a.diagnostics().beds, 1, 'the wind bed plays all the time');
});

test('每个地方都有持续的底声和偶发的声音；事件只排在前方一小段', () => {
  for (const id of Object.keys(ZONES)) {
    const { ctx, a, run } = ambience(id, 1);
    run(40);
    assert.ok(a.diagnostics().beds >= 1, `${id} has a bed`);
    assert.ok(Object.values(a.played).reduce((x, y) => x + y, 0) >= 3, `${id} events: ${JSON.stringify(a.played)}`);
    const starts = ctx.nodes.filter(n => n.kind === 'osc' && n.startTime !== undefined).map(n => n.startTime);
    assert.ok(starts.every(t => t <= ctx.currentTime + 0.41 + 2), `${id} schedules only a little ahead`);
  }
});

test('换地方时旧的底声淡出后释放，新的淡入；关掉则全部停下', () => {
  const { ctx, a, run } = ambience('timber');
  run(2);
  const sources = ctx.nodes.filter(n => n.kind === 'source' && n.loop);
  assert.ok(sources.length >= 2, 'looping beds started');
  a.setScene({ id: 'lava', daylight: 1 });
  assert.equal(a.diagnostics().id, 'lava');
  assert.equal(a.diagnostics().fading, 1);
  run(4);
  assert.ok(sources.every(s => s.stopTime !== undefined && s.disconnected), 'old beds stopped and released after the fade');
  a.setScene({ id: null, daylight: 1 });
  run(4);
  assert.deepEqual([a.diagnostics().id, a.diagnostics().fading], [null, 0]);
});
