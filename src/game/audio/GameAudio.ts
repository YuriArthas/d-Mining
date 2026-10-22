import { makeNoise, playCue, type CueType, type SfxCue } from './sfx.ts';

const STORAGE_KEY = 'mining:sound';
/** Shortest gap between two cues of one kind, in seconds: rapid repeats merge instead of stacking. */
const MIN_GAP: Partial<Record<CueType, number>> = { ui: 0.04, hit: 0.05, break: 0.04, pickup: 0.07, jump: 0.15, land: 0.15, denied: 0.3, sell: 0.25, travel: 0.3 };

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
 *  inside one. Sound is on by default; the choice is kept on the device. */
export class GameAudio {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled: boolean;
  private readonly store: SettingStore | null;
  private readonly last = new Map<CueType, number>();
  private readonly listeners = new Set<() => void>();
  private readonly played: Partial<Record<CueType, number>> = {};
  private readonly requested: Partial<Record<CueType, number>> = {};
  random = Math.random;

  constructor(store: SettingStore | null = settingStore()) {
    this.store = store;
    this.enabled = store?.getItem(STORAGE_KEY) !== 'off';
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isEnabled = () => this.enabled;
  toggle = () => this.setEnabled(!this.enabled);
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try { this.store?.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* private mode: keep the session choice */ }
    if (enabled) this.unlock(); else void this.context?.suspend();
    for (const listener of this.listeners) listener();
  }

  /** Must run inside a user gesture the first time. */
  unlock = () => {
    if (!this.enabled) return;
    if (!this.context) {
      const Context = audioContextClass();
      if (!Context) return;
      const context = new Context({ latencyHint: 'interactive' });
      const bus = context.createGain(), compressor = context.createDynamicsCompressor(), master = context.createGain();
      compressor.threshold.value = -14; compressor.knee.value = 10; compressor.ratio.value = 3;
      compressor.attack.value = 0.003; compressor.release.value = 0.2;
      master.gain.value = 0.8;
      bus.connect(compressor).connect(master).connect(context.destination);
      this.context = context; this.bus = bus; this.noise = makeNoise(context);
    }
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  };

  play = (cue: SfxCue) => {
    this.requested[cue.type] = (this.requested[cue.type] ?? 0) + 1;
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running' || !this.bus || !this.noise) return false;
    const now = context.currentTime;
    if (now - (this.last.get(cue.type) ?? -Infinity) < (MIN_GAP[cue.type] ?? 0)) return false;
    this.last.set(cue.type, now);
    playCue({ ctx: context, out: this.bus, t: now + 0.005, noise: this.noise, random: this.random }, cue);
    this.played[cue.type] = (this.played[cue.type] ?? 0) + 1;
    return true;
  };

  /** Unlock on the first gesture and pause while the page is hidden. */
  attach(target: Window = window) {
    const events = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
    for (const type of events) target.addEventListener(type, this.unlock, { capture: true, passive: true });
    const visibility = () => {
      if (!this.context) return;
      if (target.document.hidden) void this.context.suspend();
      else if (this.enabled) void this.context.resume().catch(() => {});
    };
    target.document.addEventListener('visibilitychange', visibility);
    return () => {
      for (const type of events) target.removeEventListener(type, this.unlock, { capture: true });
      target.document.removeEventListener('visibilitychange', visibility);
    };
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null; this.bus = null; this.noise = null; this.last.clear();
  }

  diagnostics() {
    return { state: this.context?.state ?? 'locked', enabled: this.enabled, played: { ...this.played }, requested: { ...this.requested } };
  }
}

export const gameAudio = new GameAudio();
