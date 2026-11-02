import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeContext, seeded } from './fixtures/fakeAudio.mjs';
import { Ambience, ZONES } from '../../src/game/audio/ambience.ts';
import { Soundscape } from '../../src/game/audio/soundscape.ts';
import { creekDistance } from '../../src/game/content/pinewindSurface.ts';
import { worldSpawn } from '../../src/game/content/worldJourney.ts';
import { makeLoopNoise, makeNoise } from '../../src/game/audio/synth.ts';

test('地表：鼓点齐全；下到矿井曲子变闷、换洞穴声；在洞口跳一下不会来回切换', () => {
  const s = new Soundscape();
  const noon = s.scene({ theme: 'meadow_mine', surfaceLight: 1 });
  assert.deepEqual([noon.song, noon.ambience, noon.rhythm, noon.muffle, noon.cave], ['meadow', 'meadow', 1, 0, 0]);
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.45 }).ambience, 'meadow', 'still outdoors at the rim');
  const shaft = s.scene({ theme: 'meadow_mine', surfaceLight: 0.2 });
  assert.deepEqual([shaft.song, shaft.ambience, shaft.muffle, shaft.rhythm], ['meadow', 'shallow', 1, 0]);
  assert.ok(shaft.cave > 0, 'effects echo underground');
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.5 }).ambience, 'shallow', 'hysteresis: a jump does not flip back');
  assert.equal(s.scene({ theme: 'meadow_mine', surfaceLight: 0.7 }).ambience, 'meadow');
  const deep = s.scene({ theme: 'frozen_cave', surfaceLight: 0 });
  assert.deepEqual([deep.song, deep.ambience, deep.muffle], ['ice', 'ice', 0]);
});

test('底声只在开阔处：挖进石头七格就听不见；小溪的水声只在溪边，下到矿井里没有', () => {
  const s = new Soundscape(), hall = dug => s.scene({ theme: 'lava_cave', surfaceLight: 0, dug });
  assert.equal(hall(0).beds, 1, 'in the hall');
  assert.equal(hall(2).beds, 1, 'standing in a one-block pit');
  assert.ok(hall(6).beds > 0.2 && hall(6).beds < 0.6, `three blocks down: ${hall(6).beds}`);
  assert.equal(hall(14).beds, 0, 'seven blocks of rock');
  assert.equal(hall(0).creek, 0, 'no creek away from the valley');
  // The valley: the spawn is by the creek, the mine's pit across the plaza from it.
  const valley = (feet, light = 1) => s.scene({ theme: 'meadow_mine', surfaceLight: light, dug: Math.max(0, -feet[1]), creek: creekDistance(...feet) });
  const spawn = valley(worldSpawn(1)), bank = valley([0, -.2, 33.5]), pit = valley([0, .1, 0]), shaft = valley([0, -30, 0], 0);
  assert.equal(bank.creek, 1, 'on the bank');
  assert.ok(spawn.creek > 0.2 && spawn.creek < 1, `at the spawn, a few metres off: ${spawn.creek}`);
  assert.equal(pit.creek, 0, 'the creek is not heard at the mine');
  assert.deepEqual([shaft.ambience, shaft.creek, shaft.beds], ['shallow', 0, 0], 'fifteen blocks down the shaft: no creek, no wind');
});

function ambience(id, levels = [1, 0]) {
  const ctx = new FakeContext({ time: 0, rate: 4000 }), dry = ctx.createGain(), wet = ctx.createGain();
  const a = new Ambience(ctx, dry, wet, makeNoise(ctx, 0.5), makeLoopNoise(ctx, 1), seeded(3));
  a.setLevels(...levels);
  a.setScene(id);
  const run = seconds => { for (let t = 0; t < seconds; t += 0.1) { ctx.currentTime = +(ctx.currentTime + 0.1).toFixed(6); a.tick(); } };
  return { ctx, a, run };
}

test('地表有鸟叫和树叶声；风一阵一阵，中间有停下来的时候（一直不停的风声听着像流水）', () => {
  const day = ambience('meadow');
  day.run(120);
  assert.ok(day.a.played.bird >= 8, `birds: ${day.a.played.bird}`);
  assert.ok(day.a.played.leaves >= 3, `leaves: ${day.a.played.leaves}`);
  const band = day.ctx.nodes.find(n => n.kind === 'filter' && n.type === 'bandpass' && n.Q.value === 0.6), wind = band.outputs[0].gain;
  const levels = wind.events.filter(e => e[0] === 'target').map(e => e[1] / 0.04);
  assert.ok(levels.filter(l => l < 0.15).length >= 3, `calm spells: ${levels.map(l => l.toFixed(2))}`);
  assert.ok(levels.filter(l => l > 0.5).length >= 3, `gusts: ${levels.map(l => l.toFixed(2))}`);
});

test('小溪的水声跟着离水的远近；离得远时不排气泡声', () => {
  const bubbles = creek => {
    const { ctx, a, run } = ambience('meadow', [1, creek]);
    run(20);
    assert.ok(a.diagnostics().creek);
    const level = ctx.nodes.filter(n => n.kind === 'gain' && n.gain.value === creek);
    assert.ok(level.length, 'the creek bed sits under its own level');
    return ctx.nodes.filter(n => n.kind === 'osc').length;
  };
  const far = bubbles(0), near = bubbles(1);
  assert.ok(near - far > 60, `bubbles near the water: ${near - far} more voices in 20 s`);
  const { ctx, a } = ambience('meadow', [1, 1]);
  a.setLevels(0.5, 0.2);
  const targets = ctx.nodes.filter(n => n.kind === 'gain').flatMap(n => n.gain.events.filter(e => e[0] === 'target').map(e => e[1]));
  assert.ok(targets.includes(0.5) && targets.includes(0.2), 'walking away turns the beds and the creek down smoothly');
});

test('普通的土和石头里没有持续底声；熔岩、机器、风、晶体这些发声的地方才有；每处都有偶发的声音，只排在前方一小段', () => {
  for (const id of Object.keys(ZONES)) {
    const { ctx, a, run } = ambience(id);
    run(40);
    if (['shallow', 'timber', 'mushroom'].includes(id)) assert.equal(a.diagnostics().beds, 0, `${id}: no steady hum in plain rock`);
    else assert.ok(a.diagnostics().beds >= 1, `${id} has a bed`);
    assert.ok(Object.values(a.played).reduce((x, y) => x + y, 0) >= 3, `${id} events: ${JSON.stringify(a.played)}`);
    const starts = ctx.nodes.filter(n => n.kind === 'osc' && n.startTime !== undefined).map(n => n.startTime);
    assert.ok(starts.every(t => t <= ctx.currentTime + 0.41 + 2), `${id} schedules only a little ahead`);
  }
});

test('换地方时旧的底声淡出后释放，新的淡入；关掉则全部停下', () => {
  const { ctx, a, run } = ambience('meadow');
  run(2);
  const sources = ctx.nodes.filter(n => n.kind === 'source' && n.loop);
  assert.ok(sources.length >= 2, 'looping beds (wind, creek) started');
  a.setScene('lava');
  assert.equal(a.diagnostics().id, 'lava');
  assert.equal(a.diagnostics().fading, 1);
  run(4);
  assert.ok(sources.every(s => s.stopTime !== undefined && s.disconnected), 'old beds stopped and released after the fade');
  a.setScene(null);
  run(4);
  assert.deepEqual([a.diagnostics().id, a.diagnostics().fading], [null, 0]);
});
