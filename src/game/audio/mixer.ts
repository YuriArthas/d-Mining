/** The game's audio graph, shared by the live game and offline renders:
 *
 *    sfx -------+---------------------------------------------+
 *               +-- cave send --+                             |
 *    ambience ---------- wet ---+                             +-- compressor -- master -- out
 *    music -- duck -- distance -- muffle -- low cut ----------+
 *    music wet -- muffle -------+-- reverb ------------------+
 *
 *  Sound effects and ambience share the 音效 switch, music has its own. `muffle` (with `distance`)
 *  makes the surface music sound as if heard from down a shaft; the cave send gives effects an echo
 *  underground. */
export type Mixer = Readonly<{
  sfx: GainNode; ambience: GainNode; ambienceWet: GainNode; music: GainNode; musicWet: GainNode;
  caveSend: GainNode; duck: GainNode; distance: GainNode; muffle: readonly BiquadFilterNode[]; reverb: ConvolverNode; master: GainNode;
  /** Switch gates for the two settings. */
  soundGates: readonly GainNode[]; musicGates: readonly GainNode[];
}>;

/** Overall music level against the sound effects: the music's average sits about 10 dB under a pick
 *  hit and level with a footstep (measured with tools/music-preview). */
export const MUSIC_LEVEL = 0.26;

/** A synthetic room: decorrelated stereo noise with an exponential tail that darkens as it decays. */
export function makeReverb(ctx: BaseAudioContext, seconds = 2.2) {
  const length = Math.round(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let seed = 0x6d2b79f5 + c * 977, low = 0;
    for (let i = 0; i < length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = ((seed >>> 0) / 4294967295) * 2 - 1, t = i / length;
      // One-pole low-pass whose cutoff falls along the tail, like air absorbing the highs.
      const k = 0.85 - 0.75 * t;
      low += k * (white - low);
      const onset = i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1;
      data[i] = low * Math.exp(-5.2 * t) * onset * 0.6;
    }
  }
  return buffer;
}

export function createMixer(ctx: BaseAudioContext, out: AudioNode = ctx.destination): Mixer {
  const gain = (value = 1) => { const g = ctx.createGain(); g.gain.value = value; return g; };
  const compressor = ctx.createDynamicsCompressor(), master = gain(0.8);
  compressor.threshold.value = -14; compressor.knee.value = 10; compressor.ratio.value = 3;
  compressor.attack.value = 0.003; compressor.release.value = 0.2;
  compressor.connect(master).connect(out);
  const reverb = ctx.createConvolver();
  reverb.buffer = makeReverb(ctx);
  reverb.connect(gain(0.8)).connect(compressor);
  const muffle = [0, 1].map(() => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 20000; f.Q.value = 0.5; return f; });

  const sfx = gain(), sfxGate = gain(), caveSend = gain(0);
  sfx.connect(sfxGate).connect(compressor);
  sfxGate.connect(caveSend).connect(reverb);
  const ambience = gain(), ambienceGate = gain(), ambienceWet = gain(), ambienceWetGate = gain();
  ambience.connect(ambienceGate).connect(compressor);
  ambienceWet.connect(ambienceWetGate).connect(reverb);
  // Music: a gentle low cut keeps sub-bass rumble (inaudible on phones, muddy on headphones) out.
  const lowCut = ctx.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.frequency.value = 55; lowCut.Q.value = 0.5;
  const music = gain(), musicGate = gain(MUSIC_LEVEL), duck = gain(), distance = gain(), musicWet = gain(), musicWetGate = gain(MUSIC_LEVEL);
  music.connect(musicGate).connect(duck).connect(distance).connect(muffle[0]).connect(lowCut).connect(compressor);
  musicWet.connect(musicWetGate).connect(muffle[1]).connect(reverb);
  return {
    sfx, ambience, ambienceWet, music, musicWet, caveSend, duck, distance, muffle, reverb, master,
    soundGates: [sfxGate, ambienceGate, ambienceWetGate], musicGates: [musicGate, musicWetGate],
  };
}

/** Smoothly moves a set of gates to a level (0 closes them). */
export function setGates(ctx: BaseAudioContext, gates: readonly GainNode[], level: number) {
  for (const gate of gates) gate.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
}
