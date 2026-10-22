/** Procedural sound effects: every cue is synthesised from oscillators and one shared noise buffer,
 *  so the game ships no audio files. Recipes only schedule nodes on a BaseAudioContext, which lets
 *  tests and offline renders reuse them. Levels are per cue; the bus adds a gentle compressor. */
export type HitMaterial = 'soil' | 'rock' | 'ore' | 'gem';
export type SfxCue =
  | Readonly<{ type: 'hit'; material: HitMaterial }>
  | Readonly<{ type: 'break'; material: HitMaterial }>
  | Readonly<{ type: 'pickup'; tier: number }>
  | Readonly<{ type: 'sell' }>
  | Readonly<{ type: 'jump' }>
  | Readonly<{ type: 'land'; strength: number }>
  | Readonly<{ type: 'ui' }>
  | Readonly<{ type: 'purchase' }>
  | Readonly<{ type: 'reward' }>
  | Readonly<{ type: 'hatch'; tier: number; auto?: boolean }>
  | Readonly<{ type: 'unlock' }>
  | Readonly<{ type: 'travel' }>
  | Readonly<{ type: 'denied' }>;
export type CueType = SfxCue['type'];

export type Voice = Readonly<{ ctx: BaseAudioContext; out: AudioNode; t: number; noise: AudioBuffer; random: () => number }>;
const SILENT = 0.0001;

export function makeNoise(ctx: BaseAudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate), data = buffer.getChannelData(0);
  // Deterministic white noise: identical cues every session, no Math.random at load.
  let seed = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = ((seed >>> 0) / 4294967295) * 2 - 1; }
  return buffer;
}

/** Exponential attack/decay envelope feeding the voice output. */
function envelope(v: Voice, peak: number, attack: number, decay: number, start: number) {
  const gain = v.ctx.createGain(), t = v.t + start;
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  gain.connect(v.out);
  return gain;
}

type Tone = { wave?: OscillatorType; from: number; to?: number; sweep?: number; peak: number; attack?: number; decay: number; start?: number };
function tone(v: Voice, { wave = 'sine', from, to = from, sweep = 0.05, peak, attack = 0.003, decay, start = 0 }: Tone) {
  const osc = v.ctx.createOscillator(), t = v.t + start;
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + sweep);
  osc.connect(envelope(v, peak, attack, decay, start));
  osc.start(t); osc.stop(t + attack + decay + 0.02);
}

type Hiss = { filter: BiquadFilterType; from: number; to?: number; sweep?: number; q?: number; peak: number; attack?: number; decay: number; start?: number };
function hiss(v: Voice, { filter, from, to = from, sweep = 0.05, q = 1, peak, attack = 0.002, decay, start = 0 }: Hiss) {
  const source = v.ctx.createBufferSource(), biquad = v.ctx.createBiquadFilter(), t = v.t + start;
  source.buffer = v.noise;
  biquad.type = filter; biquad.Q.value = q;
  biquad.frequency.setValueAtTime(from, t);
  if (to !== from) biquad.frequency.exponentialRampToValueAtTime(to, t + sweep);
  source.connect(biquad).connect(envelope(v, peak, attack, decay, start));
  const length = attack + decay + 0.02;
  source.start(t, v.random() * Math.max(0, v.noise.duration - length - 0.01), length);
}

const vary = (v: Voice, amount = 0.06) => 1 + (v.random() * 2 - 1) * amount;
const notes = (v: Voice, frequencies: readonly number[], gap: number, peak: number, decay: number, wave: OscillatorType = 'triangle', start = 0) =>
  frequencies.forEach((f, i) => tone(v, { wave, from: f, peak, decay, start: start + i * gap }));
const sparkle = (v: Voice, start: number, count = 3, peak = 0.05) =>
  notes(v, [2637, 3136, 3951, 4699].slice(0, count), 0.05, peak, 0.28, 'sine', start);

// Phone speakers barely reproduce anything under ~250 Hz, so every impact pairs its low thump
// (for headphones) with a midrange knock that carries on a phone.
function hit(v: Voice, material: HitMaterial) {
  const d = vary(v);
  if (material === 'soil') {
    hiss(v, { filter: 'lowpass', from: 1700 * d, to: 520, sweep: 0.07, q: 0.7, peak: 0.45, decay: 0.09 });
    tone(v, { wave: 'triangle', from: 380 * d, to: 250, sweep: 0.05, peak: 0.5, attack: 0.002, decay: 0.08 });
    tone(v, { from: 150 * d, to: 62, sweep: 0.08, peak: 0.45, attack: 0.002, decay: 0.12 });
    return;
  }
  // Pick on stone: a bright chip, a stony knock, a short thump and a dry tick.
  hiss(v, { filter: 'bandpass', from: 3300 * d, to: 2300, sweep: 0.04, q: 0.8, peak: 0.5, attack: 0.001, decay: 0.05 });
  hiss(v, { filter: 'highpass', from: 2200, q: 0.7, peak: 0.35, attack: 0.001, decay: 0.03 });
  tone(v, { wave: 'triangle', from: 640 * d, to: 420, sweep: 0.04, peak: 0.52, attack: 0.001, decay: 0.07 });
  tone(v, { from: 215 * d, to: 86, sweep: 0.07, peak: 0.45, attack: 0.002, decay: 0.11 });
  tone(v, { wave: 'triangle', from: 1480 * d, peak: 0.06, attack: 0.001, decay: 0.06 });
  if (material === 'ore') {
    // Metal in the rock rings with two inharmonic partials.
    tone(v, { from: 1850 * d, peak: 0.11, attack: 0.001, decay: 0.22 });
    tone(v, { from: 1850 * 2.76 * d, peak: 0.045, attack: 0.001, decay: 0.14 });
  } else if (material === 'gem') {
    tone(v, { from: 2620 * d, peak: 0.09, attack: 0.001, decay: 0.34 });
    tone(v, { from: 3930 * d, peak: 0.045, attack: 0.001, decay: 0.24 });
  }
}

function crumble(v: Voice, material: HitMaterial) {
  const d = vary(v, 0.05), soft = material === 'soil';
  hiss(v, { filter: 'lowpass', from: (soft ? 1500 : 2600) * d, to: soft ? 240 : 320, sweep: 0.32, q: 0.8, peak: 0.5, attack: 0.003, decay: 0.34 });
  tone(v, { wave: 'triangle', from: (soft ? 360 : 520) * d, to: soft ? 220 : 300, sweep: 0.06, peak: 0.42, attack: 0.002, decay: 0.09 });
  tone(v, { from: 120 * d, to: 42, sweep: 0.16, peak: 0.5, attack: 0.002, decay: 0.2 });
  // Falling grains scattered over the first fifth of a second.
  for (let i = 0; i < 6; i++) {
    hiss(v, { filter: soft ? 'lowpass' : 'bandpass', from: soft ? 900 + v.random() * 600 : 1400 + v.random() * 2400, q: 2, peak: 0.15 + v.random() * 0.15, attack: 0.001, decay: 0.02 + v.random() * 0.025, start: 0.015 + v.random() * 0.17 });
  }
  if (material === 'ore') notes(v, [1320, 1980], 0.035, 0.07, 0.42, 'sine', 0.02);
  if (material === 'gem') sparkle(v, 0.03, 3, 0.055);
}

/** Tier 0 host rock, 1 the layer's common ore, 2 its rare gem. */
function pickup(v: Voice, tier: number) {
  const d = vary(v, 0.03);
  tone(v, { from: 620 * d, to: 1240 * d, sweep: 0.06, peak: 0.2, attack: 0.004, decay: 0.13 });
  if (tier >= 1) tone(v, { from: 930 * d, to: 1860 * d, sweep: 0.06, peak: 0.12, attack: 0.004, decay: 0.14, start: 0.05 });
  if (tier >= 2) sparkle(v, 0.1, 3, 0.045);
}

function sell(v: Voice) {
  hiss(v, { filter: 'bandpass', from: 2600, q: 1.5, peak: 0.24, attack: 0.001, decay: 0.03 });
  tone(v, { wave: 'square', from: 1047, peak: 0.06, attack: 0.002, decay: 0.06 });
  tone(v, { wave: 'triangle', from: 1568, peak: 0.16, decay: 0.5, start: 0.06 });
  tone(v, { wave: 'triangle', from: 2093, peak: 0.1, decay: 0.45, start: 0.06 });
  for (let i = 0; i < 8; i++) tone(v, { from: 2600 + v.random() * 1800, peak: 0.03 + v.random() * 0.03, attack: 0.001, decay: 0.06 + v.random() * 0.04, start: 0.08 + v.random() * 0.3 });
}

function hatch(v: Voice, tier: number, auto?: boolean) {
  if (auto) {
    // Auto-hatching repeats every few seconds: a soft pop, a sparkle only for rare pets.
    tone(v, { from: 520, to: 1040, sweep: 0.08, peak: 0.14, decay: 0.16 });
    if (tier >= 1) sparkle(v, 0.08, 2 + Math.min(tier, 2), 0.04);
    return;
  }
  // Matches the reveal: egg wobbles for 0.8 s, cracks with a flash, the pet pops in at 1.0 s.
  for (const at of [0.1, 0.3, 0.5, 0.68]) tone(v, { wave: 'triangle', from: 380 + at * 300, peak: 0.07, attack: 0.002, decay: 0.07, start: at });
  hiss(v, { filter: 'bandpass', from: 3000, to: 1400, sweep: 0.12, q: 0.9, peak: 0.3, attack: 0.002, decay: 0.16, start: 0.8 });
  tone(v, { from: 180, to: 70, sweep: 0.12, peak: 0.3, decay: 0.16, start: 0.8 });
  const chord = [[523, 659, 784], [587, 740, 880], [659, 831, 988], [784, 988, 1175]][Math.max(0, Math.min(3, tier))];
  notes(v, chord, 0.045, 0.11, 0.55, 'triangle', 1.0);
  if (tier >= 1) sparkle(v, 1.12, 2 + tier, 0.045);
}

function travel(v: Voice) {
  hiss(v, { filter: 'bandpass', from: 1800, to: 300, sweep: 0.45, q: 0.9, peak: 0.2, attack: 0.05, decay: 0.5 });
  tone(v, { from: 220, to: 110, sweep: 0.4, peak: 0.12, attack: 0.04, decay: 0.45 });
}

export function playCue(v: Voice, cue: SfxCue) {
  switch (cue.type) {
    case 'hit': return hit(v, cue.material);
    case 'break': return crumble(v, cue.material);
    case 'pickup': return pickup(v, cue.tier);
    case 'sell': return sell(v);
    case 'jump':
      hiss(v, { filter: 'bandpass', from: 520, to: 1900, sweep: 0.14, q: 1.1, peak: 0.38, attack: 0.02, decay: 0.16 });
      return tone(v, { from: 320, to: 640, sweep: 0.1, peak: 0.16, attack: 0.005, decay: 0.12 });
    case 'land': {
      const s = Math.max(0.2, Math.min(1, cue.strength));
      hiss(v, { filter: 'lowpass', from: 1400, to: 300, sweep: 0.1, q: 0.7, peak: 0.42 * s, attack: 0.002, decay: 0.12 });
      tone(v, { wave: 'triangle', from: 300, to: 190, sweep: 0.05, peak: 0.5 * s, attack: 0.002, decay: 0.08 });
      return tone(v, { from: 96, to: 48, sweep: 0.12, peak: 0.4 * s, attack: 0.002, decay: 0.15 });
    }
    case 'ui':
      hiss(v, { filter: 'highpass', from: 4200, q: 0.7, peak: 0.08, attack: 0.001, decay: 0.015 });
      return tone(v, { from: 1600, to: 1250, sweep: 0.03, peak: 0.32, attack: 0.002, decay: 0.05 });
    case 'purchase':
      notes(v, [523, 659, 784, 1047], 0.06, 0.13, 0.22);
      return hiss(v, { filter: 'highpass', from: 6000, peak: 0.03, attack: 0.005, decay: 0.2, start: 0.18 });
    case 'reward':
      notes(v, [784, 1047, 1319, 1568], 0.07, 0.12, 0.3);
      return sparkle(v, 0.26, 3, 0.04);
    case 'hatch': return hatch(v, cue.tier, cue.auto);
    case 'unlock':
      notes(v, [523, 784, 1047], 0.09, 0.13, 0.25);
      notes(v, [659, 784, 1047, 1319], 0, 0.07, 0.7, 'triangle', 0.3);
      return sparkle(v, 0.36, 4, 0.04);
    case 'travel': return travel(v);
    case 'denied':
      tone(v, { wave: 'square', from: 233, peak: 0.16, attack: 0.004, decay: 0.08 });
      return tone(v, { wave: 'square', from: 196, peak: 0.16, attack: 0.004, decay: 0.1, start: 0.11 });
  }
}

/** Seconds a cue keeps sounding after it starts (for tests and offline renders). */
export const CUE_LENGTH: Readonly<Record<CueType, number>> = {
  hit: 0.4, break: 0.5, pickup: 0.5, sell: 0.65, jump: 0.25, land: 0.2, ui: 0.08, purchase: 0.45, reward: 0.7, hatch: 1.7, unlock: 1.05, travel: 0.6, denied: 0.25,
};
