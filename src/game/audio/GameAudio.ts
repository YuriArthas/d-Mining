import { Ambience, type AmbienceId } from './ambience.ts';
import { MUSIC_LEVEL, createMixer, setGates, type Mixer } from './mixer.ts';
import { MusicPlayer } from './music/MusicPlayer.ts';
import type { SongId } from './music/songs.ts';
import { playCue, type CueType, type SfxCue } from './sfx.ts';
import { makeLoopNoise, makeNoise } from './synth.ts';

const SOUND_KEY = 'mining:sound';
const MUSIC_KEY = 'mining:music';
/** Shortest gap between two cues of one kind, in seconds: rapid repeats merge instead of stacking. */
const MIN_GAP: Partial<Record<CueType, number>> = { ui: 0.04, hit: 0.05, break: 0.04, pickup: 0.07, jump: 0.15, land: 0.15, denied: 0.3, sell: 0.25, travel: 0.3, step: 0.08 };
/** Big moments briefly lower the music (seconds held down). */
const DUCK: Partial<Record<CueType, number>> = { unlock: 1.6, hatch: 1.3, reward: 1, purchase: 0.6 };
/** How often the music and ambience schedulers look ahead. */
const TICK_MS = 100;

/** What the place should sound like: the piece and its arrangement, the ambience, and how much the
 *  surface music is muffled (heard down the shaft) and effects echo (underground). */
export type AudioScene = Readonly<{
  song: SongId | null; rhythm: number; lead: number; muffle: number;
  ambience: AmbienceId | null; cave: number;
}>;
export const QUIET_SCENE: AudioScene = { song: null, rhythm: 1, lead: 1, muffle: 0, ambience: null, cave: 0 };
const sameScene = (a: AudioScene, b: AudioScene) =>
  a.song === b.song && a.ambience === b.ambience && Math.abs(a.rhythm - b.rhythm) < 0.02 && Math.abs(a.lead - b.lead) < 0.02 &&
  Math.abs(a.muffle - b.muffle) < 0.02 && Math.abs(a.cave - b.cave) < 0.02;

type SettingStore = Pick<Storage, 'getItem' | 'setItem'>;
function settingStore(): SettingStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
type AudioContextClass = new (options?: AudioContextOptions) => AudioContext;
function audioContextClass(): AudioContextClass | null {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextClass };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** Game sound: browsers only allow audio after a user gesture, so the context is created and resumed
 *  inside one. Sound effects (with ambience) and music are switched separately; both are on by
 *  default and the choices are kept on the device. */
export class GameAudio {
  private context: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private music: MusicPlayer | null = null;
  private ambience: Ambience | null = null;
  private noise: AudioBuffer | null = null;
  private sound: boolean;
  private musicOn: boolean;
  private scene: AudioScene = QUIET_SCENE;
  private readonly store: SettingStore | null;
  private readonly last = new Map<CueType, number>();
  private readonly listeners = new Set<() => void>();
  private readonly played: Partial<Record<CueType, number>> = {};
  private readonly requested: Partial<Record<CueType, number>> = {};
  private readonly lastCue: Partial<Record<CueType, SfxCue>> = {};
  private probeNodes: { analyser: AnalyserNode; stream: MediaStreamAudioDestinationNode | null; samples: Float32Array<ArrayBuffer> } | null = null;
  random = Math.random;

  constructor(store: SettingStore | null = settingStore()) {
    this.store = store;
    this.sound = store?.getItem(SOUND_KEY) !== 'off';
    this.musicOn = store?.getItem(MUSIC_KEY) !== 'off';
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isEnabled = () => this.sound;
  isMusicEnabled = () => this.musicOn;
  toggle = () => this.setEnabled(!this.sound);
  toggleMusic = () => this.setMusicEnabled(!this.musicOn);

  /** Sound effects and ambience. */
  setEnabled(enabled: boolean) {
    this.sound = enabled;
    this.remember(SOUND_KEY, enabled);
    if (this.context && this.mixer) {
      setGates(this.context, this.mixer.soundGates, enabled ? 1 : 0);
      this.ambience?.setScene(enabled ? this.scene.ambience : null);
    }
    this.settle();
  }

  setMusicEnabled(enabled: boolean) {
    this.musicOn = enabled;
    this.remember(MUSIC_KEY, enabled);
    if (this.context && this.mixer) {
      setGates(this.context, this.mixer.musicGates, enabled ? MUSIC_LEVEL : 0);
      if (!enabled) this.music?.stop();
    }
    this.settle();
  }

  /** Must run inside a user gesture the first time. */
  unlock = () => {
    if (!this.sound && !this.musicOn) return;
    if (!this.context) {
      const Context = audioContextClass();
      if (!Context) return;
      const context = new Context({ latencyHint: 'interactive' }), mixer = createMixer(context), noise = makeNoise(context);
      setGates(context, mixer.soundGates, this.sound ? 1 : 0);
      setGates(context, mixer.musicGates, this.musicOn ? MUSIC_LEVEL : 0);
      this.context = context; this.mixer = mixer; this.noise = noise;
      this.music = new MusicPlayer(context, mixer.music, mixer.musicWet, noise, this.random);
      this.ambience = new Ambience(context, mixer.ambience, mixer.ambienceWet, noise, makeLoopNoise(context), this.random);
      this.apply(true);
    }
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  };

  /** Called by the game every frame; only real changes reach the players. */
  setScene(scene: AudioScene) {
    if (sameScene(scene, this.scene)) return;
    this.scene = scene;
    this.apply(false);
  }

  play = (cue: SfxCue) => {
    this.requested[cue.type] = (this.requested[cue.type] ?? 0) + 1;
    const context = this.context;
    if (!this.sound || !context || context.state !== 'running' || !this.mixer || !this.noise) return false;
    const now = context.currentTime;
    if (now - (this.last.get(cue.type) ?? -Infinity) < (MIN_GAP[cue.type] ?? 0)) return false;
    this.last.set(cue.type, now);
    playCue({ ctx: context, out: this.mixer.sfx, t: now + 0.005, noise: this.noise, random: this.random }, cue);
    this.played[cue.type] = (this.played[cue.type] ?? 0) + 1;
    this.lastCue[cue.type] = cue;
    const duck = DUCK[cue.type];
    if (duck && !(cue.type === 'hatch' && cue.auto)) this.duck(duck);
    return true;
  };

  /** Schedules the music and ambience a little ahead; runs from a timer so a long frame or an open
   *  dialog never stalls the music. */
  tick = () => {
    if (!this.context || this.context.state !== 'running') return;
    if (this.musicOn) this.music?.tick();
    if (this.sound) this.ambience?.tick();
  };

  /** Unlock on the first gesture, pause while the page is hidden, and drive the schedulers. */
  attach(target: Window = window) {
    const events = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
    for (const type of events) target.addEventListener(type, this.unlock, { capture: true, passive: true });
    const visibility = () => {
      if (!this.context) return;
      if (target.document.hidden) void this.context.suspend();
      else if (this.sound || this.musicOn) void this.context.resume().catch(() => {});
    };
    target.document.addEventListener('visibilitychange', visibility);
    const timer = target.setInterval(this.tick, TICK_MS);
    return () => {
      for (const type of events) target.removeEventListener(type, this.unlock, { capture: true });
      target.document.removeEventListener('visibilitychange', visibility);
      target.clearInterval(timer);
    };
  }

  dispose() {
    this.music?.dispose(); this.ambience?.dispose();
    void this.context?.close().catch(() => {});
    this.context = null; this.mixer = null; this.noise = null; this.music = null; this.ambience = null; this.probeNodes = null; this.last.clear();
  }

  diagnostics() {
    return {
      state: this.context?.state ?? 'locked', enabled: this.sound, music: this.musicOn,
      played: { ...this.played }, requested: { ...this.requested }, last: { ...this.lastCue }, scene: this.scene,
      player: this.music?.diagnostics() ?? null, ambience: this.ambience?.diagnostics() ?? null,
    };
  }

  /** Verification only: the level of the final output right now (dBFS RMS over ~46 ms), created on
   *  first use so normal play carries no analyser. */
  outputLevel() {
    const probe = this.probe();
    if (!probe) return null;
    probe.analyser.getFloatTimeDomainData(probe.samples);
    let sum = 0;
    for (const v of probe.samples) sum += v * v;
    return 10 * Math.log10(sum / probe.samples.length || 1e-12);
  }

  /** Verification only: a recordable stream of the final output. */
  outputStream() { return this.probe()?.stream?.stream ?? null; }

  private probe() {
    if (!this.context || !this.mixer) return null;
    if (!this.probeNodes) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      this.mixer.master.connect(analyser);
      let stream: MediaStreamAudioDestinationNode | null = null;
      if (typeof this.context.createMediaStreamDestination === 'function') { stream = this.context.createMediaStreamDestination(); this.mixer.master.connect(stream); }
      this.probeNodes = { analyser, stream, samples: new Float32Array(analyser.fftSize) };
    }
    return this.probeNodes;
  }

  private apply(immediate: boolean) {
    const context = this.context, mixer = this.mixer, scene = this.scene;
    if (!context || !mixer) return;
    this.music?.setScene({ song: scene.song, rhythm: scene.rhythm, lead: scene.lead });
    this.ambience?.setScene(this.sound ? scene.ambience : null);
    const now = context.currentTime, smooth = immediate ? 0.01 : 0.6;
    // Muffled: heard from up the shaft, darker (log-interpolated cut-off down to ~900 Hz) and quieter.
    const muffle = Math.max(0, Math.min(1, scene.muffle)), cutoff = 20000 * (900 / 20000) ** muffle;
    for (const filter of mixer.muffle) filter.frequency.setTargetAtTime(cutoff, now, smooth);
    mixer.distance.gain.setTargetAtTime(1 - 0.4 * muffle, now, smooth);
    mixer.caveSend.gain.setTargetAtTime(scene.cave * 0.6, now, smooth);
  }

  private duck(seconds: number) {
    if (!this.context || !this.mixer) return;
    const gain = this.mixer.duck.gain, now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(0.45, now, 0.03);
    gain.setTargetAtTime(1, now + seconds, 0.4);
  }

  private remember(key: string, on: boolean) {
    try { this.store?.setItem(key, on ? 'on' : 'off'); } catch { /* private mode: keep the session choice */ }
  }

  /** Resume inside the tap that switched something on; suspend when everything is off. */
  private settle() {
    if (this.sound || this.musicOn) this.unlock(); else void this.context?.suspend();
    for (const listener of this.listeners) listener();
  }
}

export const gameAudio = new GameAudio();
