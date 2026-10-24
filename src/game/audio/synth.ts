/** Building blocks shared by the sound cues, the music instruments and the ambience: oscillator and
 *  filtered-noise voices with exponential envelopes, scheduled on any BaseAudioContext so tests and
 *  offline renders can reuse them. */
export type Voice = Readonly<{ ctx: BaseAudioContext; out: AudioNode; t: number; noise: AudioBuffer; random: () => number }>;
const SILENT = 0.0001;

/** Deterministic xorshift noise in [-1, 1]: identical sounds every session, no Math.random at load. */
function fillNoise(data: Float32Array, seed: number) {
  for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = ((seed >>> 0) / 4294967295) * 2 - 1; }
}

export function makeNoise(ctx: BaseAudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  fillNoise(buffer.getChannelData(0), 0x9e3779b9);
  return buffer;
}

/** Seamless looping pink noise for continuous beds (wind, rumble, hum). Each channel has its own seed
 *  so stereo beds are wide; the tail is cross-faded into the head so the loop point never clicks. */
export function makeLoopNoise(ctx: BaseAudioContext, seconds = 6, channels = 2) {
  const length = Math.round(ctx.sampleRate * seconds), fade = Math.round(ctx.sampleRate * 0.25);
  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const white = new Float32Array(length + fade), out = buffer.getChannelData(c);
    fillNoise(white, 0x2545f491 + c * 0x9e37);
    // Paul Kellet's economy pinking filter, normalised to about +-1.
    let b0 = 0, b1 = 0, b2 = 0;
    const pink = new Float32Array(length + fade);
    for (let i = 0; i < pink.length; i++) {
      const w = white[i];
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      pink[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    for (let i = 0; i < length; i++) out[i] = i < fade ? pink[i] * (i / fade) + pink[length + i] * (1 - i / fade) : pink[i];
  }
  return buffer;
}

/** Exponential attack/decay envelope feeding the voice output. The gain starts silent: a GainNode
 *  defaults to 1 until its first scheduled event, which lets a noise burst's first sample click. */
export function envelope(v: Voice, peak: number, attack: number, decay: number, start: number) {
  const gain = v.ctx.createGain(), t = v.t + start;
  gain.gain.value = SILENT;
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  gain.connect(v.out);
  return gain;
}

export type Tone = { wave?: OscillatorType; from: number; to?: number; sweep?: number; peak: number; attack?: number; decay: number; start?: number };
export function tone(v: Voice, { wave = 'sine', from, to = from, sweep = 0.05, peak, attack = 0.003, decay, start = 0 }: Tone) {
  const osc = v.ctx.createOscillator(), t = v.t + start;
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + sweep);
  osc.connect(envelope(v, peak, attack, decay, start));
  osc.start(t); osc.stop(t + attack + decay + 0.02);
}

type Hiss = { filter: BiquadFilterType; from: number; to?: number; sweep?: number; q?: number; peak: number; attack?: number; decay: number; start?: number };
export function hiss(v: Voice, { filter, from, to = from, sweep = 0.05, q = 1, peak, attack = 0.002, decay, start = 0 }: Hiss) {
  const source = v.ctx.createBufferSource(), biquad = v.ctx.createBiquadFilter(), t = v.t + start;
  source.buffer = v.noise;
  biquad.type = filter; biquad.Q.value = q;
  biquad.frequency.setValueAtTime(from, t);
  if (to !== from) biquad.frequency.exponentialRampToValueAtTime(to, t + sweep);
  source.connect(biquad).connect(envelope(v, peak, attack, decay, start));
  const length = attack + decay + 0.02;
  source.start(t, v.random() * Math.max(0, v.noise.duration - length - 0.01), length);
}

export const vary = (v: Voice, amount = 0.06) => 1 + (v.random() * 2 - 1) * amount;

/** A voice that starts later or plays into another node, for layering. */
export const at = (v: Voice, out: AudioNode, start = 0): Voice => ({ ...v, out, t: v.t + start });
