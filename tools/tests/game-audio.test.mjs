import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../../src/game/audio/GameAudio.ts';
import { CUE_LENGTH, makeNoise, playCue } from '../../src/game/audio/sfx.ts';
import { FakeContext, seeded, settings as store, withAudioContext } from './fixtures/fakeAudio.mjs';


test('声音只在首次手势后开始：之前不建上下文、不出声；关掉后记住选择', () => withAudioContext(() => {
  const settings = store(), audio = new GameAudio(settings);
  assert.equal(audio.play({ type: 'ui' }), false);
  assert.equal(audio.diagnostics().state, 'locked');
  audio.unlock();
  assert.equal(audio.diagnostics().state, 'running');
  assert.equal(audio.play({ type: 'hit', material: 'rock' }), true);
  audio.setEnabled(false);
  assert.equal(settings.data.get('mining:sound'), 'off');
  assert.equal(audio.play({ type: 'hit', material: 'rock' }), false, 'muted');
  assert.equal(new GameAudio(settings).isEnabled(), false, 'the choice survives a reload');
  audio.setEnabled(true);
  assert.equal(audio.diagnostics().state, 'running', 'turning sound on inside the tap resumes at once');
  assert.deepEqual(audio.diagnostics().requested, { ui: 1, hit: 2 });
  assert.deepEqual(audio.diagnostics().played, { hit: 1 });
  audio.dispose();
  assert.equal(audio.diagnostics().state, 'locked');
}));

test('加载时就把声音建好（暂停着），首次点击只需恢复：不在点击里卡几百毫秒；点击之前不出声', () => withAudioContext(() => {
  const timers = [], listeners = new Map();
  const target = {
    addEventListener: (type, f) => listeners.set(type, f), removeEventListener: type => listeners.delete(type),
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    setInterval: () => 1, clearInterval() {}, setTimeout: f => timers.push(f), clearTimeout() {},
  };
  const audio = new GameAudio(store()), detach = audio.attach(target);
  assert.equal(audio.diagnostics().state, 'locked', 'nothing is built inside attach itself');
  for (const run of timers) run();
  assert.equal(audio.diagnostics().state, 'suspended', 'built while loading, still silent');
  assert.equal(audio.play({ type: 'ui' }), false);
  const context = audio['context'];
  listeners.get('pointerdown')();
  assert.equal(audio['context'], context, 'the first click reuses it');
  assert.equal(audio.diagnostics().state, 'running');
  assert.equal(audio.play({ type: 'ui' }), true);
  detach(); audio.dispose();
  const muted = store(); muted.setItem('mining:sound', 'off'); muted.setItem('mining:music', 'off');
  const silent = new GameAudio(muted); timers.length = 0; silent.attach(target); for (const run of timers) run();
  assert.equal(silent.diagnostics().state, 'locked', 'sound and music off: no audio device is opened');
}));

test('同类音效连发会合并，不同类不受影响', () => withAudioContext(() => {
  const audio = new GameAudio(store());
  audio.unlock();
  assert.equal(audio.play({ type: 'pickup', tier: 0 }), true);
  assert.equal(audio.play({ type: 'pickup', tier: 0 }), false, 'second pickup in the same instant merges');
  assert.equal(audio.play({ type: 'sell' }), true);
  const context = audio['context'];
  context.currentTime += 0.08;
  assert.equal(audio.play({ type: 'pickup', tier: 1 }), true, 'after the gap it plays again');
}));

test('每个音效都在声明的时长内结束，单个声部不过载，指数包络不碰零', () => {
  const ctx = new FakeContext(), noise = makeNoise(ctx, 1);
  const cues = [
    ...['rock', 'ore', 'gem'].flatMap(material => [{ type: 'hit', material }, { type: 'break', material }]),
    ...[0, 1, 2].map(tier => ({ type: 'pickup', tier })),
    { type: 'sell' }, { type: 'jump' }, { type: 'land', strength: 1 }, { type: 'ui' }, { type: 'purchase' }, { type: 'reward' },
    ...[0, 3].flatMap(tier => [{ type: 'hatch', tier }, { type: 'hatch', tier, auto: true }]),
    { type: 'unlock' }, { type: 'travel' }, { type: 'denied' },
    ...['grass', 'sand', 'dirt', 'stone', 'wood', 'metal', 'ice', 'crystal'].map(surface => ({ type: 'step', surface, strength: 1 })),
  ];
  let seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const cue of cues) {
    ctx.nodes.length = 0;
    const out = ctx.createGain(), t = 3;
    playCue({ ctx, out, t, noise, random }, cue);
    const gains = ctx.nodes.filter(n => n.kind === 'gain' && n !== out);
    assert.ok(gains.length > 0, `${cue.type} schedules sound`);
    const end = Math.max(...gains.flatMap(g => g.gain.events.map(e => e[2])));
    assert.ok(end - t <= CUE_LENGTH[cue.type] + 1e-9, `${JSON.stringify(cue)} ends after ${(end - t).toFixed(3)}s`);
    for (const g of gains) assert.ok(Math.max(...g.gain.events.map(e => e[1])) <= 0.55, `${cue.type} voice peak`);
    for (const source of ctx.nodes.filter(n => n.kind === 'source')) assert.ok(source.offset >= 0 && source.offset + source.duration <= noise.duration, 'noise window inside the buffer');
    for (const osc of ctx.nodes.filter(n => n.kind === 'osc')) assert.ok(osc.stopTime > osc.startTime, 'oscillators stop');
  }
});

test('噪声缓冲固定：每次进游戏的音色一致', () => {
  const a = makeNoise(new FakeContext(), 0.5).getChannelData(0), b = makeNoise(new FakeContext(), 0.5).getChannelData(0);
  assert.deepEqual(Array.from(a.slice(0, 64)), Array.from(b.slice(0, 64)));
  assert.ok(Math.max(...a) <= 1 && Math.min(...a) >= -1);
});

test('音乐和音效分开开关，各自记住；两个都关掉才暂停声音', () => withAudioContext(() => {
  const saved = store(), audio = new GameAudio(saved);
  audio.unlock();
  audio.setMusicEnabled(false);
  assert.equal(saved.data.get('mining:music'), 'off');
  assert.equal(audio.play({ type: 'ui' }), true, 'effects still play with music off');
  assert.equal(audio.diagnostics().state, 'running');
  audio.setEnabled(false);
  assert.equal(audio.diagnostics().state, 'suspended', 'everything off: the context sleeps');
  const reloaded = new GameAudio(saved);
  assert.deepEqual([reloaded.isEnabled(), reloaded.isMusicEnabled()], [false, false], 'both choices survive a reload');
  audio.setMusicEnabled(true);
  assert.equal(audio.diagnostics().state, 'running', 'music alone wakes the sound');
  assert.equal(audio.play({ type: 'ui' }), false, 'effects stay off');
  audio.dispose();
}));

test('场景决定曲目和环境声；开蛋、解锁这些大时刻会把音乐压低一下', () => withAudioContext(() => {
  const audio = new GameAudio(store());
  audio.random = seeded(4);
  audio.setScene({ song: 'meadow', rhythm: 1, lead: 1, muffle: 0, ambience: 'meadow', cave: 0 });
  audio.unlock();
  const context = audio['context'];
  for (let i = 0; i < 20; i++) { context.currentTime += 0.1; audio.tick(); }
  const d = audio.diagnostics();
  assert.equal(d.player.playing, 'meadow');
  assert.ok(d.player.scheduled > 0, 'notes scheduled');
  assert.equal(d.ambience.id, 'meadow');
  const duck = audio['mixer'].duck.gain;
  audio.play({ type: 'unlock' });
  assert.ok(duck.events.some(e => e[0] === 'target' && e[1] < 0.6), 'music ducks under the fanfare');
  audio.setEnabled(false);
  assert.equal(audio.diagnostics().ambience.id, null, 'ambience belongs to the effects switch');
  audio.dispose();
}));
