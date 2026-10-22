import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../../src/game/audio/GameAudio.ts';
import { CUE_LENGTH, makeNoise, playCue } from '../../src/game/audio/sfx.ts';

// Minimal Web Audio stand-in that records every scheduled node and parameter ramp.
class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    this.events.push(['exp', v, t]); return this;
  }
}
class Node {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outputs = []; ctx.nodes.push(this); }
  connect(node) { this.outputs.push(node); return node; }
}
class FakeContext {
  constructor() { this.nodes = []; this.state = 'suspended'; this.currentTime = 10; this.sampleRate = 8000; this.destination = new Node(this, 'destination'); FakeContext.created++; }
  createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
  createOscillator() { const n = new Node(this, 'osc'); n.frequency = new Param(440); n.start = t => { n.startTime = t; }; n.stop = t => { n.stopTime = t; }; return n; }
  createBiquadFilter() { const n = new Node(this, 'filter'); n.frequency = new Param(350); n.Q = new Param(1); return n; }
  createBufferSource() { const n = new Node(this, 'source'); n.start = (t, offset, duration) => { Object.assign(n, { startTime: t, offset, duration }); }; return n; }
  createBuffer(channels, length, rate) { const data = new Float32Array(length); return { duration: length / rate, length, sampleRate: rate, getChannelData: () => data }; }
  createDynamicsCompressor() { const n = new Node(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(); return n; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
FakeContext.created = 0;
const store = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
function withAudioContext(run) {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext;
  try { return run(); } finally { if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext; }
}

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
    ...['soil', 'rock', 'ore', 'gem'].flatMap(material => [{ type: 'hit', material }, { type: 'break', material }]),
    ...[0, 1, 2].map(tier => ({ type: 'pickup', tier })),
    { type: 'sell' }, { type: 'jump' }, { type: 'land', strength: 1 }, { type: 'ui' }, { type: 'purchase' }, { type: 'reward' },
    ...[0, 3].flatMap(tier => [{ type: 'hatch', tier }, { type: 'hatch', tier, auto: true }]),
    { type: 'unlock' }, { type: 'travel' }, { type: 'denied' },
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
