// Minimal Web Audio stand-in for tests: records every node, connection, start/stop and parameter
// automation so tests can check what a recipe or player scheduled without rendering sound.
export class Param {
  constructor(value = 0) { this._value = value; this.events = []; }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    this.events.push(['exp', v, t]); return this;
  }
  setTargetAtTime(v, t, tc) { if (!(tc > 0)) throw new RangeError(`time constant ${tc}`); this.events.push(['target', v, t, tc]); return this; }
  cancelScheduledValues(t) { this.events = this.events.filter(e => e[2] < t); return this; }
}
export class Node {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outputs = []; this.disconnected = false; ctx.nodes.push(this); }
  connect(target) { this.outputs.push(target); return target instanceof Param ? undefined : target; }
  disconnect() { this.disconnected = true; this.outputs = []; }
}
export class FakeContext {
  constructor({ rate = 8000, time = 10 } = {}) {
    this.nodes = []; this.state = 'suspended'; this.currentTime = time; this.sampleRate = rate;
    this.destination = new Node(this, 'destination'); FakeContext.created++;
  }
  createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
  createOscillator() {
    const n = new Node(this, 'osc');
    Object.assign(n, { type: 'sine', frequency: new Param(440), detune: new Param(0), setPeriodicWave: w => { n.wave = w; } });
    n.start = t => { n.startTime = t; }; n.stop = t => { n.stopTime = t; };
    return n;
  }
  createBiquadFilter() { const n = new Node(this, 'filter'); Object.assign(n, { type: 'lowpass', frequency: new Param(350), Q: new Param(1) }); return n; }
  createBufferSource() {
    const n = new Node(this, 'source');
    Object.assign(n, { loop: false, playbackRate: new Param(1) });
    n.start = (t, offset, duration) => { Object.assign(n, { startTime: t, offset, duration }); };
    n.stop = t => { n.stopTime = t ?? this.currentTime; };
    return n;
  }
  createBuffer(channels, length, rate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / rate, length, sampleRate: rate, numberOfChannels: channels, getChannelData: c => data[c] };
  }
  createDynamicsCompressor() { const n = new Node(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(); return n; }
  createConvolver() { const n = new Node(this, 'convolver'); n.buffer = null; return n; }
  createStereoPanner() { const n = new Node(this, 'panner'); n.pan = new Param(0); return n; }
  createPeriodicWave(real, imag) { return { real, imag }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
FakeContext.created = 0;

export const settings = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; };
export function withAudioContext(run) {
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext;
  try { return run(); } finally { if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext; }
}
/** Deterministic random for tests. */
export const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
