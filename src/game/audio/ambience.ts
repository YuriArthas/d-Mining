import { hiss, tone, type Voice } from './synth.ts';

/** Where the player is, for the background sound: the valley above ground, the shallow dig under it,
 *  or one of the themed layers. */
export type AmbienceId = 'meadow' | 'shallow' | 'timber' | 'mushroom' | 'crystal' | 'ruins' | 'ice' | 'lava' | 'fossil' | 'machine' | 'core';

type Ports = Readonly<{ ctx: BaseAudioContext; dry: AudioNode; wet: AudioNode; noise: AudioBuffer; loop: AudioBuffer; random: () => number }>;
/** `update` gets how much of the bed is heard now (0..1), so a far-off bed can skip its detail. */
type Bed = Readonly<{ output: GainNode; sources: readonly AudioScheduledSourceNode[]; nodes: readonly AudioNode[]; update?: (now: number, heard: number) => void }>;
type Emitter = Readonly<{
  name: string; every: readonly [number, number];
  play: (v: Voice, ports: Ports) => void;
}>;
type MakeBed = (p: Ports, out: AudioNode) => Bed;
/** `beds` belong to the place's open space (the valley, a layer's hall) and fade as the player digs into the rock
 *  under it (`setLevels`); `creek` is the valley's water, heard only near it. Plain rock has no bed: a steady
 *  noise there sounded like a river that followed the player down (2026-11-01). */
type Zone = Readonly<{ beds: readonly MakeBed[]; creek?: MakeBed; emitters: readonly Emitter[] }>;

const LOOKAHEAD = 0.4;
const FADE = 2.5;

// ---- Beds: continuous layers -------------------------------------------------------------------

function source(p: Ports, buffer: AudioBuffer, rate = 1) {
  const s = p.ctx.createBufferSource();
  s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
  s.start(p.ctx.currentTime, p.random() * buffer.duration);
  return s;
}
function biquad(p: Ports, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = p.ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f;
}
function level(p: Ports, value: number) { const g = p.ctx.createGain(); g.gain.value = value; return g; }

/** Wind: pink noise through a band-pass, in gusts with calm spells between them (a steady band of noise reads
 *  as running water); the colour drifts too. */
const wind = (gain: number, center: number, q: number) => (p: Ports, out: AudioNode): Bed => {
  const s = source(p, p.loop, 0.9 + p.random() * 0.2), band = biquad(p, 'bandpass', center, q), g = level(p, gain * 0.1), output = level(p, 1);
  s.connect(band).connect(g).connect(output).connect(out);
  let next = 0;
  return {
    output, sources: [s], nodes: [band, g, output],
    update: now => {
      if (now < next) return;
      const gust = p.random() < 0.5, strength = gust ? 0.55 + 0.6 * p.random() : 0.04 + 0.08 * p.random();
      g.gain.setTargetAtTime(gain * strength, now, gust ? 1 + p.random() : 1.6 + p.random() * 1.4);
      band.frequency.setTargetAtTime(center * (0.75 + 0.5 * p.random()), now, 2 + p.random() * 2);
      next = now + (gust ? 2.5 + p.random() * 3 : 4 + p.random() * 7);
    },
  };
};
/** A creek: bright rushing water and a babble of small bubbles over it, both shaking a little. */
const brook = (gain: number) => (p: Ports, out: AudioNode): Bed => {
  const s = source(p, p.loop, 1.3), hp = biquad(p, 'highpass', 350), band = biquad(p, 'bandpass', 1400, 0.5), body = level(p, gain);
  const bubbles = level(p, 1), output = level(p, 1);
  s.connect(hp).connect(band).connect(body).connect(output).connect(out);
  bubbles.connect(output);
  let next = 0;
  return {
    output, sources: [s], nodes: [hp, band, body, bubbles, output],
    update: (now, heard) => {
      if (heard < 0.02) return;
      body.gain.setTargetAtTime(gain * (0.75 + 0.5 * p.random()), now, 0.08);
      for (next = Math.max(next, now); next < now + LOOKAHEAD; next += 0.05 + p.random() * 0.22) bubble({ ctx: p.ctx, out: bubbles, t: next, noise: p.noise, random: p.random });
    },
  };
};
/** A steady tone bed (machine hum, core pulse) with slow amplitude movement. */
const hum = (gain: number, frequency: number, wave: OscillatorType, pulse: number, cutoff: number) => (p: Ports, out: AudioNode): Bed => {
  const ctx = p.ctx, now = ctx.currentTime, output = level(p, 1), lp = biquad(p, 'lowpass', cutoff), body = level(p, gain);
  const a = ctx.createOscillator(), b = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = level(p, gain * 0.45);
  a.type = wave; a.frequency.value = frequency; b.type = 'sine'; b.frequency.value = frequency * 2.003;
  lfo.frequency.value = pulse;
  a.connect(lp); b.connect(lp); lp.connect(body).connect(output).connect(out);
  lfo.connect(depth).connect(body.gain);
  for (const o of [a, b, lfo]) o.start(now);
  return { output, sources: [a, b, lfo], nodes: [lp, body, depth, output] };
};
/** Lava: a low, slowly heaving roar with a midrange hiss of heat that phone speakers can play. */
const roar = (gain: number) => (p: Ports, out: AudioNode): Bed => {
  const s = source(p, p.loop, 0.6), lp = biquad(p, 'lowpass', 320, 0.9), body = level(p, gain), output = level(p, 1);
  const heat = source(p, p.loop, 1.1), band = biquad(p, 'bandpass', 760, 0.8), heatGain = level(p, gain * 0.75);
  const lfo = p.ctx.createOscillator(), depth = level(p, gain * 0.5);
  lfo.frequency.value = 0.17; lfo.connect(depth).connect(body.gain); lfo.start(p.ctx.currentTime);
  s.connect(lp).connect(body).connect(output).connect(out);
  heat.connect(band).connect(heatGain).connect(output);
  return { output, sources: [s, heat, lfo], nodes: [lp, body, band, heatGain, depth, output] };
};
/** Two nearly equal high sines beating slowly: a faint crystalline shimmer. */
const shimmer = (gain: number, frequency: number) => (p: Ports, out: AudioNode): Bed => {
  const ctx = p.ctx, output = level(p, 1), body = level(p, gain);
  const a = ctx.createOscillator(), b = ctx.createOscillator();
  a.frequency.value = frequency; b.frequency.value = frequency * 1.0021;
  a.connect(body); b.connect(body); body.connect(output).connect(out);
  a.start(ctx.currentTime); b.start(ctx.currentTime);
  return { output, sources: [a, b], nodes: [body, output] };
};

// ---- Events: occasional sounds placed left, centre or right -------------------------------------

const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length) % list.length];

function bubble(v: Voice) {
  const f = 500 + v.random() * 900;
  tone(v, { from: f, to: f * (1.4 + v.random() * 0.6), sweep: 0.03, peak: 0.004 + v.random() * 0.008, attack: 0.003, decay: 0.03 + v.random() * 0.04 });
}
function bird(v: Voice) {
  const r = v.random, kind = Math.floor(r() * 3), base = 2600 + r() * 1200, peak = 0.02 + r() * 0.02;
  if (kind === 0) {
    // A few quick rising chirps.
    const count = 2 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) tone(v, { from: base, to: base * 1.35, sweep: 0.05, peak, attack: 0.006, decay: 0.06, start: i * (0.09 + r() * 0.03) });
  } else if (kind === 1) {
    // A trill.
    const count = 7 + Math.floor(r() * 6);
    for (let i = 0; i < count; i++) tone(v, { from: base * (i % 2 ? 1.12 : 1), peak: peak * 0.8, attack: 0.004, decay: 0.025, start: i * 0.034 });
  } else {
    // A two-note whistle, high then low.
    tone(v, { from: base * 1.1, to: base * 1.06, sweep: 0.2, peak, attack: 0.03, decay: 0.22 });
    tone(v, { from: base * 0.86, to: base * 0.82, sweep: 0.25, peak, attack: 0.03, decay: 0.26, start: 0.3 });
  }
}
function leaves(v: Voice) {
  hiss(v, { filter: 'highpass', from: 2400 + v.random() * 1500, q: 0.5, peak: 0.018 + v.random() * 0.012, attack: 0.25, decay: 0.7 });
}
function drip(v: Voice) {
  const f = 900 + v.random() * 900, peak = 0.03 + v.random() * 0.025;
  tone(v, { from: f, to: f * 1.7, sweep: 0.012, peak, attack: 0.002, decay: 0.09 });
  if (v.random() < 0.3) tone(v, { from: f * 1.15, to: f * 1.9, sweep: 0.012, peak: peak * 0.6, attack: 0.002, decay: 0.08, start: 0.15 + v.random() * 0.25 });
}
function rumble(v: Voice) {
  hiss(v, { filter: 'lowpass', from: 140, q: 0.8, peak: 0.12, attack: 1, decay: 1.6 });
  hiss(v, { filter: 'bandpass', from: 380, q: 0.9, peak: 0.025, attack: 0.9, decay: 1.4 });
}
function taps(v: Voice) {
  // Another miner somewhere far off.
  const count = 2 + Math.floor(v.random() * 3), f = 1700 + v.random() * 500;
  for (let i = 0; i < count; i++) {
    tone(v, { from: f, peak: 0.012, attack: 0.001, decay: 0.08, start: i * 0.48 });
    tone(v, { from: f * 1.83, peak: 0.006, attack: 0.001, decay: 0.05, start: i * 0.48 });
  }
}
function creak(v: Voice) {
  const ctx = v.ctx, t = v.t, len = 0.5 + v.random() * 0.5, o = ctx.createOscillator(), band = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(170 + v.random() * 80, t);
  o.frequency.linearRampToValueAtTime(150 + v.random() * 120, t + len);
  band.type = 'bandpass'; band.frequency.value = 620; band.Q.value = 3;
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + len * 0.3); g.gain.linearRampToValueAtTime(0, t + len);
  o.connect(band).connect(g).connect(v.out);
  o.start(t); o.stop(t + len + 0.02);
}
function blorp(v: Voice) {
  const f = 150 + v.random() * 70;
  tone(v, { from: f, to: f * 2.1, sweep: 0.12, peak: 0.035, attack: 0.01, decay: 0.12 });
}
function tinkle(v: Voice) {
  const scale = [2093, 2349, 2637, 3136, 3520, 4186], count = 2 + Math.floor(v.random() * 2);
  for (let i = 0; i < count; i++) tone(v, { from: pick(v.random, scale), peak: 0.012 + v.random() * 0.008, attack: 0.002, decay: 0.6 + v.random() * 0.6, start: i * (0.12 + v.random() * 0.2) });
}
function crack(v: Voice) {
  hiss(v, { filter: 'highpass', from: 3000, q: 0.7, peak: 0.05, attack: 0.001, decay: 0.03 });
  tone(v, { from: 95, to: 58, sweep: 0.35, peak: 0.05, attack: 0.01, decay: 0.4, start: 0.01 });
  tone(v, { wave: 'triangle', from: 310, to: 240, sweep: 0.3, peak: 0.012, attack: 0.01, decay: 0.3, start: 0.01 });
}
function lavaPop(v: Voice) {
  // A thick bubble: low body, a midrange "blub" that carries on phones, and a wet pop.
  hiss(v, { filter: 'lowpass', from: 900, q: 1, peak: 0.05, attack: 0.004, decay: 0.12 });
  tone(v, { from: 90, to: 190, sweep: 0.1, peak: 0.04, attack: 0.005, decay: 0.14 });
  tone(v, { wave: 'triangle', from: 320, to: 620, sweep: 0.06, peak: 0.05, attack: 0.004, decay: 0.07, start: 0.05 });
}
function crackle(v: Voice) {
  const count = 3 + Math.floor(v.random() * 6);
  for (let i = 0; i < count; i++) hiss(v, { filter: 'highpass', from: 2000 + v.random() * 3000, q: 0.7, peak: 0.022 + v.random() * 0.025, attack: 0.001, decay: 0.008, start: v.random() * 0.35 });
}
function trickle(v: Voice) {
  const count = 8 + Math.floor(v.random() * 8), length = 0.6 + v.random() * 0.6;
  for (let i = 0; i < count; i++) {
    const at = (i / count) ** 1.6 * length;
    hiss(v, { filter: 'bandpass', from: 2000 + v.random() * 3000, q: 2.5, peak: (0.016 + v.random() * 0.01) * (1 - at / length * 0.6), attack: 0.001, decay: 0.012, start: at });
  }
}
function steam(v: Voice) {
  hiss(v, { filter: 'highpass', from: 1800 + v.random() * 1200, q: 0.6, peak: 0.022, attack: 0.15, decay: 1.2 + v.random() * 0.8 });
}
function clank(v: Voice) {
  const f = 420 + v.random() * 200;
  for (const [ratio, peak, decay] of [[1, 0.018, 0.35], [2.76, 0.01, 0.25], [5.4, 0.005, 0.15]] as const) tone(v, { from: f * ratio, peak, attack: 0.001, decay });
  hiss(v, { filter: 'bandpass', from: 2500, q: 1.2, peak: 0.02, attack: 0.001, decay: 0.02 });
}
function chime(v: Voice) {
  const f = pick(v.random, [784, 880, 1047, 1175, 1319]);
  tone(v, { from: f, peak: 0.016, attack: 0.002, decay: 1.6 });
  tone(v, { from: f * 2.76, peak: 0.004, attack: 0.002, decay: 0.6 });
}
function grind(v: Voice) {
  hiss(v, { filter: 'bandpass', from: 220, to: 160, sweep: 1.2, q: 1.5, peak: 0.05, attack: 0.4, decay: 1.2 });
  hiss(v, { filter: 'bandpass', from: 900, q: 1.2, peak: 0.01, attack: 0.4, decay: 1 });
}
function surge(v: Voice) {
  // A soft rising swell of energy from the core.
  tone(v, { from: 220, to: 880, sweep: 1.4, peak: 0.012, attack: 0.6, decay: 1 });
  tone(v, { from: 330, to: 1320, sweep: 1.4, peak: 0.006, attack: 0.6, decay: 1 });
}

const UNDER: readonly Emitter[] = [
  { name: 'drip', every: [1.4, 4.5], play: drip },
  { name: 'rumble', every: [28, 60], play: rumble },
];

export const ZONES: Readonly<Record<AmbienceId, Zone>> = {
  meadow: {
    beds: [wind(0.04, 650, 0.6)],
    creek: brook(0.04),
    emitters: [
      { name: 'bird', every: [1.8, 6], play: bird },
      { name: 'leaves', every: [4, 10], play: leaves },
    ],
  },
  shallow: { beds: [], emitters: [...UNDER, { name: 'taps', every: [14, 30], play: taps }] },
  timber: { beds: [], emitters: [...UNDER, { name: 'creak', every: [9, 22], play: creak }, { name: 'taps', every: [16, 32], play: taps }] },
  mushroom: { beds: [], emitters: [{ name: 'drip', every: [0.9, 3], play: drip }, { name: 'blorp', every: [3, 8], play: blorp }, { name: 'rumble', every: [30, 60], play: rumble }] },
  crystal: { beds: [shimmer(0.004, 2637)], emitters: [...UNDER, { name: 'tinkle', every: [3, 7], play: tinkle }] },
  ruins: { beds: [wind(0.035, 900, 3)], emitters: [...UNDER, { name: 'chime', every: [12, 26], play: chime }, { name: 'grind', every: [18, 40], play: grind }] },
  ice: { beds: [wind(0.045, 1000, 2.5)], emitters: [{ name: 'tinkle', every: [4, 9], play: tinkle }, { name: 'crack', every: [14, 32], play: crack }, { name: 'drip', every: [3, 8], play: drip }] },
  lava: { beds: [roar(0.03)], emitters: [{ name: 'pop', every: [1.5, 4], play: lavaPop }, { name: 'crackle', every: [0.8, 2.6], play: crackle }, { name: 'rumble', every: [20, 45], play: rumble }] },
  fossil: { beds: [wind(0.035, 520, 1)], emitters: [{ name: 'trickle', every: [7, 16], play: trickle }, ...UNDER] },
  machine: { beds: [hum(0.008, 55, 'sawtooth', 0.23, 420)], emitters: [{ name: 'steam', every: [10, 22], play: steam }, { name: 'clank', every: [5, 12], play: clank }, ...UNDER] },
  core: { beds: [hum(0.006, 98, 'sine', 0.5, 400), shimmer(0.003, 3136)], emitters: [{ name: 'surge', every: [8, 16], play: surge }, { name: 'chime', every: [10, 22], play: chime }, { name: 'rumble', every: [30, 60], play: rumble }] },
};

const PANS = [-0.65, 0, 0.65] as const;
type Active = { id: AmbienceId; beds: Bed[]; open: GainNode; creek: Bed | null; creekLevel: GainNode; slots: GainNode[]; nodes: AudioNode[]; next: number[]; output: GainNode };
/** How fast the beds follow the player's place (seconds, time constant). */
const FOLLOW = 0.5;

/** Background sound for the current place: beds that loop for as long as the player stays, and
 *  occasional events at random times and sides. Changing place cross-fades the beds. */
export class Ambience {
  private readonly ports: Ports;
  private id: AmbienceId | null = null;
  private active: Active | null = null;
  private fading: { zone: Active; until: number }[] = [];
  private levels = { open: 1, creek: 0 };
  readonly played: Record<string, number> = {};

  constructor(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, noise: AudioBuffer, loop: AudioBuffer, random: () => number = Math.random) {
    this.ports = { ctx, dry, wet, noise, loop, random };
  }

  setScene(id: AmbienceId | null) {
    if (id === this.id) return;
    this.id = id;
    if (this.active) this.fadeOut(this.active);
    this.active = id ? this.start(id) : null;
  }

  /** How much is heard of the place's beds (`open`: 1 in the valley or a hall, 0 a few blocks into the rock under
   *  it) and of the creek (0 away from the water). */
  setLevels(open: number, creek: number) {
    this.levels = { open, creek };
    const zone = this.active, now = this.ports.ctx.currentTime;
    if (!zone) return;
    zone.open.gain.setTargetAtTime(open, now, FOLLOW);
    zone.creekLevel.gain.setTargetAtTime(creek, now, FOLLOW);
  }

  tick() {
    const { ctx, random } = this.ports, now = ctx.currentTime;
    this.fading = this.fading.filter(f => { if (now < f.until) return true; release(f.zone); return false; });
    const zone = this.active;
    if (!zone) return;
    for (const bed of zone.beds) bed.update?.(now, this.levels.open);
    zone.creek?.update?.(now, this.levels.creek);
    ZONES[zone.id].emitters.forEach((emitter, i) => {
      while (zone.next[i] < now + LOOKAHEAD) {
        const t = Math.max(now, zone.next[i]);
        emitter.play({ ctx, out: zone.slots[Math.floor(random() * zone.slots.length) % zone.slots.length], t, noise: this.ports.noise, random }, this.ports);
        this.played[emitter.name] = (this.played[emitter.name] ?? 0) + 1;
        zone.next[i] = t + emitter.every[0] + random() * (emitter.every[1] - emitter.every[0]);
      }
    });
  }

  dispose() {
    if (this.active) release(this.active);
    for (const f of this.fading) release(f.zone);
    this.active = null; this.fading = [];
  }

  diagnostics() {
    return { id: this.active?.id ?? null, beds: this.active?.beds.length ?? 0, creek: !!this.active?.creek, levels: { ...this.levels }, fading: this.fading.length, played: { ...this.played } };
  }

  private start(id: AmbienceId): Active {
    const p = this.ports, ctx = p.ctx, now = ctx.currentTime, output = ctx.createGain(), nodes: AudioNode[] = [output];
    output.gain.value = 0;
    output.gain.setTargetAtTime(1, now, FADE / 4);
    output.connect(p.dry);
    const slots = PANS.map(pan => {
      const slot = ctx.createGain(), wet = ctx.createGain();
      wet.gain.value = 0.35;
      slot.connect(wet).connect(p.wet);
      if (typeof ctx.createStereoPanner === 'function') { const panner = ctx.createStereoPanner(); panner.pan.value = pan; slot.connect(panner).connect(output); nodes.push(panner); }
      else slot.connect(output);
      nodes.push(slot, wet);
      return slot;
    });
    const zone = ZONES[id], open = ctx.createGain(), creekLevel = ctx.createGain();
    open.gain.value = this.levels.open; creekLevel.gain.value = this.levels.creek;
    open.connect(output); creekLevel.connect(output);
    nodes.push(open, creekLevel);
    const beds = zone.beds.map(make => make(p, open)), creek = zone.creek?.(p, creekLevel) ?? null;
    // First events come soon but not all at once.
    const next = zone.emitters.map(e => now + 0.5 + p.random() * Math.min(4, e.every[1]));
    return { id, beds, open, creek, creekLevel, slots, nodes, next, output };
  }

  private fadeOut(zone: Active) {
    const now = this.ports.ctx.currentTime;
    zone.output.gain.setTargetAtTime(0, now, FADE / 5);
    this.fading.push({ zone, until: now + FADE + 1 });
  }
}

function release(zone: Active) {
  for (const bed of zone.creek ? [...zone.beds, zone.creek] : zone.beds) {
    for (const s of bed.sources) { try { s.stop(); } catch { /* already stopped */ } s.disconnect(); }
    for (const node of bed.nodes) node.disconnect();
  }
  for (const node of zone.nodes) node.disconnect();
}
