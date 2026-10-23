/** Music instruments, synthesised like the sound cues: each note schedules a few oscillators, filters
 *  and gains on any BaseAudioContext and stops them when it has faded. Levels are per instrument so a
 *  track at level 1 sits right in the mix; tracks scale them further. */
export type InstrumentId =
  | 'marimba' | 'musicBox' | 'bell' | 'celesta' | 'kalimba' | 'pluck' | 'banjo' | 'harp' | 'pizz'
  | 'ocarina' | 'flute' | 'whistle' | 'softLead' | 'brass' | 'arpSynth'
  | 'pad' | 'choir' | 'glass' | 'drone' | 'bass' | 'pluckBass' | 'synthBass';
export type DrumId =
  | 'kick' | 'snare' | 'clap' | 'hat' | 'shaker' | 'woodblock' | 'rim' | 'tomLow' | 'tomHigh'
  | 'frameDum' | 'frameTek' | 'tick' | 'triangle' | 'timpani' | 'bubble';

export type NoteVoice = Readonly<{
  ctx: BaseAudioContext; out: AudioNode; t: number; midi: number; seconds: number; velocity: number;
  random: () => number; noise: AudioBuffer;
}>;

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** Natural decay: a time constant reaching about -60 dB after `seconds`. */
const fall = (seconds: number) => seconds / 6.9;

/** Percussive amplitude: quick linear attack, exponential fall to silence. */
function strike(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.value = 0; // silent until the note (a GainNode otherwise passes everything before its first event)
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, t + attack, fall(decay));
  g.connect(out);
  return g;
}

/** Held amplitude: attack, optional decay to a sustain level, release after `hold` seconds. */
function hold(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, holdFor: number, release: number, sustain = 1, decay = 0.3) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (sustain < 1) g.gain.setTargetAtTime(peak * sustain, t + attack, decay / 3);
  g.gain.setTargetAtTime(0, t + Math.max(holdFor, attack + 0.01), release / 4);
  g.connect(out);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType | PeriodicWave, frequency: number, t: number, end: number, detune = 0) {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type as OscillatorType; else o.setPeriodicWave(type);
  o.frequency.setValueAtTime(frequency, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t); o.stop(end);
  return o;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = frequency; f.Q.value = q;
  return f;
}

function noise(v: Readonly<{ ctx: BaseAudioContext; noise: AudioBuffer; random: () => number }>, t: number, length: number) {
  const source = v.ctx.createBufferSource();
  source.buffer = v.noise;
  source.start(t, v.random() * Math.max(0, v.noise.duration - length - 0.01), length);
  return source;
}

/** Slow vibrato on an oscillator's pitch, fading in after the note speaks. */
function vibrato(ctx: BaseAudioContext, target: OscillatorNode, t: number, end: number, rate: number, cents: number, delay = 0.22) {
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = rate;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(0, t + delay);
  depth.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
  lfo.connect(depth).connect(target.detune);
  lfo.start(t); lfo.stop(end);
}

// Custom wave shapes, built once per context.
const shapes = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function shape(ctx: BaseAudioContext, name: 'warm' | 'hollow' | 'reed') {
  let map = shapes.get(ctx);
  if (!map) shapes.set(ctx, map = new Map());
  let wave = map.get(name);
  if (!wave) {
    const n = 24, real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      // warm: a saw rolled off at 1/k^1.6; hollow: odd harmonics only (soft clarinet); reed: bright odd-heavy.
      imag[k] = name === 'warm' ? 1 / k ** 1.6 : name === 'hollow' ? (k % 2 ? 1 / k ** 1.8 : 0.04 / k) : (k % 2 ? 1 / k : 0.35 / k) / (1 + k * 0.08);
    }
    map.set(name, wave = ctx.createPeriodicWave(real, imag));
  }
  return wave;
}

/** Plays one note; returns when it has gone silent. */
export function playNote(id: InstrumentId, v: NoteVoice): number {
  const { ctx, out, t, velocity: vel } = v, f = hz(v.midi), dur = Math.max(0.05, v.seconds);
  switch (id) {
    case 'marimba': {
      // Wooden bar: fundamental plus the tuned 4th partial that dies quickly.
      const decay = clamp(1.5 - (v.midi - 48) * 0.028, 0.35, 1.4), end = t + decay + 0.05;
      osc(ctx, 'sine', f, t, end).connect(strike(ctx, out, t, 0.3 * vel, 0.004, decay));
      osc(ctx, 'sine', f * 3.93, t, t + decay * 0.3 + 0.05).connect(strike(ctx, out, t, 0.07 * vel, 0.002, decay * 0.3));
      if (f * 9.2 < 12000) osc(ctx, 'sine', f * 9.2, t, t + 0.08).connect(strike(ctx, out, t, 0.025 * vel, 0.001, 0.05));
      return end;
    }
    case 'musicBox': {
      // Steel tine: long sine ring with two short inharmonic partials.
      const decay = clamp(2.2 - (v.midi - 60) * 0.04, 0.8, 2.2), end = t + decay + 0.05;
      osc(ctx, 'sine', f, t, end).connect(strike(ctx, out, t, 0.2 * vel, 0.002, decay));
      osc(ctx, 'sine', f * 2.756, t, t + 0.6).connect(strike(ctx, out, t, 0.05 * vel, 0.001, 0.55));
      if (f * 5.404 < 12000) osc(ctx, 'sine', f * 5.404, t, t + 0.25).connect(strike(ctx, out, t, 0.025 * vel, 0.001, 0.2));
      return end;
    }
    case 'bell': case 'celesta': {
      // Two-operator FM: the modulation index decays, so the attack is bright and the tail pure.
      const bell = id === 'bell', decay = bell ? 2.4 : 1.3, end = t + decay + 0.05;
      const carrier = osc(ctx, 'sine', f, t, end), modulator = osc(ctx, 'sine', f * (bell ? 3.5 : 4), t, end), index = ctx.createGain();
      index.gain.setValueAtTime(f * (bell ? 2.2 : 1.2) * vel, t);
      index.gain.setTargetAtTime(f * 0.12, t, bell ? 0.35 : 0.12);
      modulator.connect(index).connect(carrier.frequency);
      carrier.connect(strike(ctx, out, t, (bell ? 0.13 : 0.15) * vel, 0.002, decay));
      return end;
    }
    case 'kalimba': {
      const decay = clamp(1.4 - (v.midi - 60) * 0.02, 0.6, 1.4), end = t + decay + 0.05;
      const tine = osc(ctx, 'sine', f * 1.012, t, end);
      tine.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      tine.connect(strike(ctx, out, t, 0.24 * vel, 0.003, decay));
      osc(ctx, 'sine', f * 5.95, t, t + 0.12).connect(strike(ctx, out, t, 0.03 * vel, 0.001, 0.1));
      return end;
    }
    case 'pluck': case 'banjo': case 'harp': case 'pizz': {
      // Plucked string: a filter that closes after the pick, over a body that rings out.
      const banjo = id === 'banjo', harp = id === 'harp', pizz = id === 'pizz';
      const decay = pizz ? 0.32 : banjo ? 0.55 : harp ? clamp(2.4 - (v.midi - 48) * 0.03, 1, 2.4) : clamp(1.4 - (v.midi - 48) * 0.02, 0.6, 1.4);
      const end = t + decay + 0.05, lp = filter(ctx, 'lowpass', Math.min(f * (banjo ? 14 : harp ? 6 : 8), 9000), banjo ? 1.6 : 0.8);
      lp.frequency.setTargetAtTime(f * (harp ? 2.2 : pizz ? 1.8 : banjo ? 3.5 : 1.6), t, banjo ? 0.07 : pizz ? 0.03 : 0.08);
      const body = strike(ctx, out, t, (harp ? 0.18 : pizz ? 0.2 : 0.16) * vel, pizz ? 0.004 : 0.002, decay);
      lp.connect(body);
      osc(ctx, harp ? 'triangle' : 'sawtooth', f, t, end).connect(lp);
      osc(ctx, harp ? 'sine' : 'triangle', harp ? f * 2 : f, t, end, harp ? 0 : 5).connect(lp);
      return end;
    }
    case 'ocarina': case 'flute': case 'whistle': {
      // Breathy wind: a nearly pure tone with a little breath noise and a late, gentle vibrato.
      const flute = id === 'flute', whistle = id === 'whistle';
      const attack = flute ? 0.07 : 0.045, release = flute ? 0.16 : 0.12, end = t + dur + release * 2;
      const amp = hold(ctx, out, t, (whistle ? 0.11 : 0.13) * vel, attack, dur, release, 0.85, 0.25);
      const tone = osc(ctx, whistle ? 'sine' : shape(ctx, 'hollow'), f, t, end);
      if (whistle) { tone.frequency.setValueAtTime(f * 0.97, t); tone.frequency.exponentialRampToValueAtTime(f, t + 0.05); }
      vibrato(ctx, tone, t, end, flute ? 4.8 : 5.4, flute ? 9 : 12);
      tone.connect(amp);
      const breath = noise(v, t, dur + release * 2), band = filter(ctx, 'bandpass', Math.min(f * 2, 6000), 1.4), air = ctx.createGain();
      air.gain.value = 0;
      air.gain.setValueAtTime(0, t);
      air.gain.linearRampToValueAtTime((flute ? 0.05 : whistle ? 0.015 : 0.03) * vel, t + attack);
      air.gain.setTargetAtTime(0, t + dur, release / 4);
      breath.connect(band).connect(air).connect(out);
      return end;
    }
    case 'softLead': {
      const release = 0.14, end = t + dur + release * 2, lp = filter(ctx, 'lowpass', Math.min(f * 5, 3200), 0.5);
      const tone = osc(ctx, shape(ctx, 'warm'), f, t, end);
      vibrato(ctx, tone, t, end, 5, 10);
      tone.connect(lp).connect(hold(ctx, out, t, 0.1 * vel, 0.03, dur, release, 0.8, 0.3));
      return end;
    }
    case 'brass': {
      // Soft brass swell: the filter opens on the attack and settles.
      const release = 0.18, end = t + dur + release * 2, lp = filter(ctx, 'lowpass', f * 1.5, 1.2);
      lp.frequency.setValueAtTime(f * 1.5, t);
      lp.frequency.linearRampToValueAtTime(Math.min(f * 6, 4200), t + 0.06);
      lp.frequency.setTargetAtTime(Math.min(f * 3, 2600), t + 0.06, 0.12);
      const amp = hold(ctx, out, t, 0.08 * vel, 0.035, dur, release, 0.75, 0.25);
      lp.connect(amp);
      osc(ctx, 'sawtooth', f, t, end, -6).connect(lp);
      osc(ctx, 'sawtooth', f, t, end, 6).connect(lp);
      return end;
    }
    case 'arpSynth': {
      const decay = 0.38, end = t + decay + 0.05, lp = filter(ctx, 'lowpass', Math.min(f * 10, 8000), 2);
      lp.frequency.setTargetAtTime(f * 2, t, 0.05);
      osc(ctx, 'square', f, t, end).connect(lp).connect(strike(ctx, out, t, 0.07 * vel, 0.003, decay));
      return end;
    }
    case 'pad': case 'glass': case 'choir': {
      const attack = id === 'glass' ? 1.4 : id === 'choir' ? 0.9 : 1.1, release = id === 'glass' ? 2 : 1.6, end = t + dur + release * 2;
      if (id === 'glass') {
        // Glassy: two detuned sines an octave apart with a slow shimmer.
        const amp = hold(ctx, out, t, 0.05 * vel, attack, dur, release);
        osc(ctx, 'sine', f, t, end, -6).connect(amp);
        osc(ctx, 'sine', f, t, end, 6).connect(amp);
        const upper = ctx.createGain(); upper.gain.value = 0.35;
        osc(ctx, 'triangle', f * 2, t, end, 3).connect(upper).connect(amp);
        return end;
      }
      if (id === 'choir') {
        // "Ah" vowel: a buzzy source through two formant peaks, with a slow vibrato.
        const amp = hold(ctx, out, t, 0.075 * vel, attack, dur, release), mix = ctx.createGain();
        mix.gain.value = 1;
        for (const [freq, q, gain] of [[730, 7, 1], [1090, 9, 0.6], [2440, 10, 0.18]] as const) {
          const band = filter(ctx, 'bandpass', freq, q), level = ctx.createGain();
          level.gain.value = gain;
          mix.connect(band).connect(level).connect(amp);
        }
        const a = osc(ctx, 'sawtooth', f, t, end, -5), b = osc(ctx, 'sawtooth', f, t, end, 5);
        vibrato(ctx, a, t, end, 4.6, 8, 0.4);
        a.connect(mix); b.connect(mix);
        return end;
      }
      // Warm pad: rolled-off saws, a sub an octave down, through a soft low-pass.
      const lp = filter(ctx, 'lowpass', Math.min(700 + f * 1.6, 2400), 0.5);
      lp.connect(hold(ctx, out, t, 0.045 * vel, attack, dur, release));
      osc(ctx, shape(ctx, 'warm'), f, t, end, -8).connect(lp);
      osc(ctx, shape(ctx, 'warm'), f, t, end, 8).connect(lp);
      const sub = ctx.createGain(); sub.gain.value = 0.15;
      osc(ctx, 'triangle', f / 2, t, end).connect(sub).connect(lp);
      return end;
    }
    case 'drone': {
      // Low buzzing drone whose formant slowly wanders (didgeridoo-like).
      const release = 1.5, end = t + dur + release * 2, band = filter(ctx, 'bandpass', 520, 3), lp = filter(ctx, 'lowpass', 1400, 0.5);
      const wander = ctx.createOscillator(), depth = ctx.createGain();
      wander.frequency.value = 0.31; depth.gain.value = 260;
      wander.connect(depth).connect(band.frequency);
      wander.start(t); wander.stop(end);
      const amp = hold(ctx, out, t, 0.11 * vel, 0.8, dur, release), dry = ctx.createGain();
      dry.gain.value = 0.35;
      const source = osc(ctx, 'sawtooth', f, t, end);
      source.connect(band).connect(amp); source.connect(lp).connect(dry).connect(amp);
      return end;
    }
    case 'bass': {
      // Round bass: a sine for the body and a triangle whose odd harmonics carry on a phone speaker.
      const release = 0.09, end = t + dur + release * 2, lp = filter(ctx, 'lowpass', 1100, 0.6);
      lp.connect(hold(ctx, out, t, 0.2 * vel, 0.012, dur * 0.95, release, 0.7, 0.3));
      const body = ctx.createGain(); body.gain.value = 0.55;
      osc(ctx, 'sine', f, t, end).connect(body).connect(lp);
      osc(ctx, 'triangle', f, t, end).connect(lp);
      return end;
    }
    case 'pluckBass': {
      const decay = 0.75, end = t + Math.min(decay, dur + 0.25) + 0.05, lp = filter(ctx, 'lowpass', f * 7, 1);
      lp.frequency.setTargetAtTime(f * 2.2, t, 0.06);
      const amp = strike(ctx, out, t, 0.28 * vel, 0.005, decay);
      amp.gain.setTargetAtTime(0, t + dur + 0.05, 0.05);
      lp.connect(amp);
      osc(ctx, 'triangle', f, t, end).connect(lp);
      osc(ctx, 'sawtooth', f, t, end).connect(filter(ctx, 'lowpass', 600, 0.5)).connect(amp);
      return end;
    }
    case 'synthBass': {
      const release = 0.08, end = t + dur + release * 2, lp = filter(ctx, 'lowpass', f * 8, 3);
      lp.frequency.setTargetAtTime(f * 2.5, t, 0.07);
      lp.connect(hold(ctx, out, t, 0.12 * vel, 0.006, dur * 0.9, release, 0.6, 0.2));
      osc(ctx, 'sawtooth', f, t, end).connect(lp);
      osc(ctx, 'square', f / 2, t, end).connect(filter(ctx, 'lowpass', 300, 0.5)).connect(lp);
      return end;
    }
  }
}

export type DrumVoice = Omit<NoteVoice, 'midi' | 'seconds'>;

/** Plays one drum hit; returns when it has gone silent. */
export function playDrum(id: DrumId, v: DrumVoice): number {
  const { ctx, out, t, velocity: vel } = v;
  const hit = (peak: number, attack: number, decay: number) => strike(ctx, out, t, peak * vel, attack, decay);
  const noisy = (type: BiquadFilterType, frequency: number, q: number, peak: number, decay: number, start = 0, attack = 0.001) => {
    noise(v, t + start, decay + attack + 0.02).connect(filter(ctx, type, frequency, q)).connect(strike(ctx, out, t + start, peak * vel, attack, decay));
  };
  switch (id) {
    case 'kick': {
      // Soft kick: a pitch-dropping sine plus a midrange knock phones can play.
      const body = osc(ctx, 'sine', 150, t, t + 0.35);
      body.frequency.exponentialRampToValueAtTime(52, t + 0.09);
      body.connect(hit(0.3, 0.002, 0.26));
      const knock = osc(ctx, 'triangle', 240, t, t + 0.07);
      knock.frequency.exponentialRampToValueAtTime(120, t + 0.05);
      knock.connect(hit(0.12, 0.001, 0.05));
      return t + 0.35;
    }
    case 'snare':
      noisy('bandpass', 2000, 0.7, 0.13, 0.16);
      noisy('highpass', 5000, 0.7, 0.04, 0.08);
      osc(ctx, 'triangle', 190, t, t + 0.1).connect(hit(0.08, 0.001, 0.07));
      return t + 0.2;
    case 'clap':
      for (const start of [0, 0.011, 0.022]) noisy('bandpass', 1500, 1, 0.1, 0.012, start);
      noisy('bandpass', 1300, 0.8, 0.08, 0.13, 0.03);
      return t + 0.2;
    case 'hat': noisy('highpass', 7500, 0.7, 0.06, 0.04); return t + 0.07;
    case 'shaker': noisy('bandpass', 5500, 1.2, 0.05, 0.06, 0, 0.014); return t + 0.1;
    case 'woodblock': {
      const block = osc(ctx, 'sine', 1050, t, t + 0.1);
      block.frequency.exponentialRampToValueAtTime(960, t + 0.04);
      block.connect(hit(0.12, 0.001, 0.07));
      osc(ctx, 'triangle', 2480, t, t + 0.03).connect(hit(0.025, 0.001, 0.02));
      return t + 0.1;
    }
    case 'rim':
      osc(ctx, 'triangle', 1700, t, t + 0.05).connect(hit(0.06, 0.001, 0.03));
      noisy('bandpass', 3000, 1.5, 0.05, 0.015);
      return t + 0.06;
    case 'tomLow': case 'tomHigh': {
      const low = id === 'tomLow', drum = osc(ctx, 'sine', low ? 140 : 210, t, t + 0.4);
      drum.frequency.exponentialRampToValueAtTime(low ? 92 : 150, t + 0.12);
      drum.connect(hit(0.26, 0.002, low ? 0.35 : 0.28));
      osc(ctx, 'triangle', low ? 280 : 420, t, t + 0.06).connect(hit(0.06, 0.001, 0.04));
      noisy('lowpass', 900, 0.7, 0.05, 0.05);
      return t + 0.4;
    }
    case 'frameDum': {
      const drum = osc(ctx, 'sine', 98, t, t + 0.45);
      drum.frequency.exponentialRampToValueAtTime(70, t + 0.15);
      drum.connect(hit(0.3, 0.003, 0.4));
      osc(ctx, 'triangle', 200, t, t + 0.06).connect(hit(0.07, 0.002, 0.05));
      noisy('lowpass', 500, 0.7, 0.06, 0.08);
      return t + 0.45;
    }
    case 'frameTek':
      noisy('bandpass', 2400, 1.5, 0.11, 0.05);
      osc(ctx, 'triangle', 620, t, t + 0.04).connect(hit(0.05, 0.001, 0.03));
      return t + 0.07;
    case 'tick':
      // Clockwork tick: a tight metallic click.
      noisy('bandpass', 6200, 6, 0.09, 0.012);
      osc(ctx, 'sine', 3300, t, t + 0.03).connect(hit(0.025, 0.001, 0.02));
      return t + 0.04;
    case 'triangle':
      osc(ctx, 'sine', 4200, t, t + 1.3).connect(hit(0.025, 0.002, 1.2));
      osc(ctx, 'sine', 5830, t, t + 0.9).connect(hit(0.012, 0.002, 0.8));
      return t + 1.3;
    case 'timpani': {
      const drum = osc(ctx, 'sine', 92, t, t + 1.3);
      drum.frequency.exponentialRampToValueAtTime(87, t + 0.3);
      drum.connect(hit(0.22, 0.004, 1.2));
      osc(ctx, 'triangle', 184, t, t + 0.4).connect(hit(0.05, 0.003, 0.35));
      noisy('lowpass', 320, 0.7, 0.06, 0.3);
      return t + 1.3;
    }
    case 'bubble': {
      const blip = osc(ctx, 'sine', 380, t, t + 0.12);
      blip.frequency.exponentialRampToValueAtTime(920, t + 0.06);
      blip.connect(hit(0.07, 0.003, 0.08));
      return t + 0.12;
    }
  }
}

/** Playable range per instrument (MIDI); scores are checked against it. */
export const RANGE: Readonly<Record<InstrumentId, readonly [number, number]>> = {
  marimba: [45, 96], musicBox: [60, 100], bell: [55, 96], celesta: [60, 100], kalimba: [55, 91], pluck: [40, 84], banjo: [48, 86],
  harp: [36, 96], pizz: [40, 88], ocarina: [60, 91], flute: [59, 96], whistle: [62, 96], softLead: [52, 91], brass: [40, 79],
  arpSynth: [36, 96], pad: [40, 84], choir: [45, 79], glass: [55, 96], drone: [28, 55], bass: [26, 55], pluckBass: [26, 55], synthBass: [24, 60],
};
