// Authoring aid (see render.cjs): renders the music, the ambience and the footsteps offline through
// the game's own mixer, with the live schedulers driven tick by tick (OfflineAudioContext.suspend),
// and measures loudness, phone-speaker loudness, peaks and spectra.
import { Ambience, type AmbienceId } from '../../src/game/audio/ambience.ts';
import { createMixer } from '../../src/game/audio/mixer.ts';
import { MusicPlayer } from '../../src/game/audio/music/MusicPlayer.ts';
import { compileCycle } from '../../src/game/audio/music/score.ts';
import { songById, type SongId } from '../../src/game/audio/music/songs.ts';
import { playCue, type FootSurface, type SfxCue } from '../../src/game/audio/sfx.ts';
import { makeLoopNoise, makeNoise } from '../../src/game/audio/synth.ts';

const RATE = 44100, TICK = 0.1;
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

type Driver = { tick(): void };
async function render(seconds: number, setup: (ctx: OfflineAudioContext, mixer: ReturnType<typeof createMixer>, noise: AudioBuffer) => Driver) {
  const ctx = new OfflineAudioContext(2, Math.ceil(RATE * seconds), RATE), mixer = createMixer(ctx), noise = makeNoise(ctx);
  const driver = setup(ctx, mixer, noise);
  for (let t = TICK; t < seconds - TICK; t += TICK) void ctx.suspend(Math.round(t * RATE / 128) * 128 / RATE).then(() => { driver.tick(); void ctx.resume(); });
  driver.tick();
  return ctx.startRendering();
}

export async function song(id: SongId, cycle = 0, rhythm = 1, lead = 1, muffle = 0, limit = Infinity) {
  const spec = songById(id), compiled = compileCycle(spec, cycle), seconds = Math.min(limit, compiled.beats * 60 / spec.bpm + 4);
  return render(seconds, (ctx, mixer, noise) => {
    const player = new MusicPlayer(ctx, mixer.music, mixer.musicWet, noise, seeded(11 + cycle));
    player.setScene({ song: id, rhythm, lead });
    // Start straight on the requested pass (preview only).
    Object.assign(player as unknown as { cycle: number; resumeAt: number }, { cycle, resumeAt: 0.2 });
    if (muffle) { for (const f of mixer.muffle) f.frequency.value = 20000 * (900 / 20000) ** muffle; mixer.distance.gain.value = 1 - 0.4 * muffle; }
    return player;
  });
}

export async function ambience(id: AmbienceId, daylight: number, seconds: number) {
  return render(seconds, (ctx, mixer, noise) => {
    const a = new Ambience(ctx, mixer.ambience, mixer.ambienceWet, noise, makeLoopNoise(ctx), seeded(5));
    a.setScene({ id, daylight });
    return a;
  });
}

/** Eight running steps (0.17 s apart, strength 1) then four walking steps. */
export async function steps(surface: FootSurface, cave = 0) {
  return render(3, (ctx, mixer, noise) => {
    mixer.caveSend.gain.value = cave * 0.6;
    const random = seeded(3);
    const times = [...Array.from({ length: 8 }, (_, i) => 0.1 + i * 0.17), ...Array.from({ length: 4 }, (_, i) => 1.7 + i * 0.34)];
    times.forEach((t, i) => playCue({ ctx, out: mixer.sfx, t, noise, random }, { type: 'step', surface, strength: i < 8 ? 1 : 0.5 } as SfxCue));
    return { tick() {} };
  });
}

/** Four steps on each surface in turn (a tour for listening). */
export async function stepTour(surfaces: FootSurface[]) {
  return render(surfaces.length * 1.6 + 0.4, (ctx, mixer, noise) => {
    const random = seeded(8);
    surfaces.forEach((surface, s) => { for (let i = 0; i < 4; i++) playCue({ ctx, out: mixer.sfx, t: 0.15 + s * 1.6 + i * 0.3, noise, random }, { type: 'step', surface, strength: 0.9 }); });
    return { tick() {} };
  });
}

/** Encodes part of a buffer as mono Opus in WebM by playing it into a MediaRecorder (real time). */
export async function opus(buffer: AudioBuffer, from = 0, seconds = buffer.duration, bitrate = 20000) {
  const ctx = new AudioContext({ sampleRate: buffer.sampleRate }), source = ctx.createBufferSource(), fade = ctx.createGain();
  const out = ctx.createMediaStreamDestination();
  out.channelCount = 1;
  source.buffer = buffer;
  // Short fades so an excerpt never starts or ends with a click.
  fade.gain.setValueAtTime(0, ctx.currentTime + 0.05);
  fade.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
  fade.gain.setValueAtTime(1, ctx.currentTime + 0.05 + seconds - 0.6);
  fade.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05 + seconds);
  source.connect(fade).connect(out);
  const recorder = new MediaRecorder(out.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: bitrate }), chunks: Blob[] = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
  recorder.start();
  source.start(ctx.currentTime + 0.05, from, seconds);
  await new Promise(resolve => setTimeout(resolve, (seconds + 0.25) * 1000));
  recorder.stop(); await done; await ctx.close();
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Seconds from the start of a pass to its A section. */
export const firstTheme = (id: SongId) => { const spec = songById(id); return compileCycle(spec, 0).sections.find(s => s.id === 'A')!.beat * 60 / spec.bpm; };

/** One cue (for level comparisons against the music). */
export async function cue(c: SfxCue) {
  return render(1.2, (ctx, mixer, noise) => { playCue({ ctx, out: mixer.sfx, t: 0.05, noise, random: seeded(9) }, c); return { tick() {} }; });
}

function mono(buffer: AudioBuffer) {
  const l = buffer.getChannelData(0), r = buffer.getChannelData(1), out = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) out[i] = (l[i] + r[i]) / 2;
  return out;
}
function highpass(data: Float32Array, cutoff = 300) {
  // Two cascaded one-pole high-passes, roughly a phone speaker's low end.
  const out = new Float32Array(data.length), k = Math.exp(-2 * Math.PI * cutoff / RATE);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? out.slice() : data; let x1 = 0, y1 = 0;
    for (let i = 0; i < src.length; i++) { const y = k * (y1 + src[i] - x1); x1 = src[i]; y1 = y; out[i] = y; }
  }
  return out;
}
const db = (x: number) => 10 * Math.log10(x || 1e-12);
export function metrics(buffer: AudioBuffer) {
  const data = mono(buffer), phone = highpass(data);
  let peak = 0, sum = 0, sumPhone = 0;
  for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(buffer.getChannelData(0)[i]), Math.abs(buffer.getChannelData(1)[i])); sum += data[i] ** 2; sumPhone += phone[i] ** 2; }
  // Loudest 3 s and loudest 100 ms windows.
  const windows = (seconds: number, src: Float32Array) => { const w = Math.round(RATE * seconds); let acc = 0, best = 0; for (let i = 0; i < src.length; i++) { acc += src[i] ** 2; if (i >= w) acc -= src[i - w] ** 2; best = Math.max(best, acc / w); } return db(best); };
  return {
    seconds: +(data.length / RATE).toFixed(1), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1),
    rmsDb: +db(sum / data.length).toFixed(1), phoneRmsDb: +db(sumPhone / data.length).toFixed(1),
    loud3sDb: +windows(3, data).toFixed(1), loud100msDb: +windows(0.1, data).toFixed(1), phoneLoud100msDb: +windows(0.1, phone).toFixed(1),
  };
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k), wi = Math.sin(ang * k), ar = re[i + k + len / 2], ai = im[i + k + len / 2];
      const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
      re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti; re[i + k] += tr; im[i + k] += ti;
    }
  }
}

/** Draws a row: label, metrics, waveform over a 0-8 kHz spectrogram. */
export function sheet(rows: { label: string; buffer: AudioBuffer }[], width = 1400, height = 120) {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  canvas.width = width; canvas.height = height * rows.length;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#101418'; g.fillRect(0, 0, width, canvas.height);
  const x0 = 260, span = width - x0 - 10, longest = Math.max(...rows.map(r => r.buffer.duration));
  rows.forEach(({ label, buffer }, row) => {
    const y = row * height, data = mono(buffer), m = metrics(buffer), px = span / longest;
    g.fillStyle = '#dfe7ee'; g.font = 'bold 13px sans-serif'; g.fillText(label, 8, y + 18);
    g.font = '12px sans-serif'; g.fillStyle = '#9fb3c4';
    g.fillText(`rms ${m.rmsDb} / phone ${m.phoneRmsDb} dB`, 8, y + 38); g.fillText(`loud 3s ${m.loud3sDb} · 100ms ${m.loud100msDb} dB`, 8, y + 56);
    g.fillText(`peak ${m.peakDb} dB · ${m.seconds}s`, 8, y + 74);
    const N = 1024, hop = Math.max(512, Math.round(data.length / (span / 2))), bins = Math.floor(N / 2 * 8000 / (RATE / 2));
    for (let start = 0; start + N < data.length; start += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = data[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      fft(re, im);
      const x = x0 + start / RATE * px;
      for (let b = 0; b < bins; b++) {
        const mag = 20 * Math.log10(Math.hypot(re[b], im[b]) + 1e-9), v = Math.max(0, Math.min(1, (mag + 30) / 60));
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(180 * v * v)},${Math.round((90 + 120 * (1 - v)) * v)})`;
        g.fillRect(x, y + height - 4 - (b + 1) * (height - 8) / bins, Math.max(1, hop / RATE * px), (height - 8) / bins + 0.5);
      }
    }
    g.strokeStyle = '#7fd1ff'; g.globalAlpha = 0.8; g.beginPath();
    for (let x = 0; x < buffer.duration * px; x++) {
      const i0 = Math.floor(x / px * RATE), i1 = Math.floor((x + 1) / px * RATE); let lo = 0, hi = 0;
      for (let i = i0; i < Math.min(i1, data.length); i++) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
      g.moveTo(x0 + x, y + height / 2 - hi * height * 0.45); g.lineTo(x0 + x, y + height / 2 - lo * height * 0.45);
    }
    g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = '#2a3440'; g.beginPath(); g.moveTo(0, y + height - 0.5); g.lineTo(width, y + height - 0.5); g.stroke();
  });
}

/** 16-bit stereo WAV as base64. */
export function wav(buffer: AudioBuffer, maxSeconds = Infinity) {
  const frames = Math.min(buffer.length, Math.round(maxSeconds * RATE)), channels = 2;
  const out = new ArrayBuffer(44 + frames * 2 * channels), view = new DataView(out);
  const text = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2 * channels, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2 * channels, true); view.setUint16(32, 2 * channels, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2 * channels, true);
  const l = buffer.getChannelData(0), r = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) { view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true); }
  const bytes = new Uint8Array(out); let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

Object.assign(window, { preview: { song, ambience, steps, stepTour, cue, metrics, sheet, wav, opus, firstTheme } });
(window as unknown as { ready: boolean }).ready = true;
