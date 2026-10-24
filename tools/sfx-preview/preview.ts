// Authoring aid (see render.cjs): renders every sound cue offline through the game's bus
// (compressor + master gain) and draws waveform + spectrogram rows with level metrics.
import { CUE_LENGTH, makeNoise, playCue, type SfxCue } from '../../src/game/audio/sfx.ts';

const RATE = 44100;
const CUES: { name: string; cue: SfxCue }[] = [
  ...(['rock', 'ore', 'gem'] as const).flatMap(material => [
    { name: `hit ${material}`, cue: { type: 'hit', material } as SfxCue },
    { name: `break ${material}`, cue: { type: 'break', material } as SfxCue },
  ]),
  ...[0, 1, 2].map(tier => ({ name: `pickup ${tier}`, cue: { type: 'pickup', tier } as SfxCue })),
  { name: 'sell', cue: { type: 'sell' } }, { name: 'jump', cue: { type: 'jump' } }, { name: 'land 1', cue: { type: 'land', strength: 1 } },
  { name: 'ui', cue: { type: 'ui' } }, { name: 'purchase', cue: { type: 'purchase' } }, { name: 'reward', cue: { type: 'reward' } },
  { name: 'hatch 0', cue: { type: 'hatch', tier: 0 } }, { name: 'hatch 3', cue: { type: 'hatch', tier: 3 } }, { name: 'hatch auto', cue: { type: 'hatch', tier: 1, auto: true } },
  { name: 'unlock', cue: { type: 'unlock' } }, { name: 'travel', cue: { type: 'travel' } }, { name: 'denied', cue: { type: 'denied' } },
];

/** `phone` adds a 300 Hz high-pass, roughly what a phone speaker can reproduce. */
async function render(cue: SfxCue, phone = false) {
  const seconds = CUE_LENGTH[cue.type] + 0.25, ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE);
  const bus = ctx.createGain(), compressor = ctx.createDynamicsCompressor(), master = ctx.createGain();
  compressor.threshold.value = -14; compressor.knee.value = 10; compressor.ratio.value = 3; compressor.attack.value = 0.003; compressor.release.value = 0.2;
  master.gain.value = 0.8;
  const tail: AudioNode = phone ? Object.assign(ctx.createBiquadFilter(), { type: 'highpass' }) : ctx.createGain();
  if (phone) { (tail as BiquadFilterNode).frequency.value = 300; (tail as BiquadFilterNode).Q.value = 0.7; }
  bus.connect(compressor).connect(master).connect(tail).connect(ctx.destination);
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  playCue({ ctx, out: bus, t: 0.01, noise: makeNoise(ctx), random }, cue);
  return (await ctx.startRendering()).getChannelData(0);
}

function metrics(data: Float32Array) {
  let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); peak = Math.max(peak, a); sum += data[i] * data[i]; if (a > 0.003) last = i; }
  // Loudest 100 ms window, a rough stand-in for perceived loudness.
  const w = Math.round(RATE * 0.1); let best = 0, acc = 0;
  for (let i = 0; i < data.length; i++) { acc += data[i] * data[i]; if (i >= w) acc -= data[i - w] * data[i - w]; best = Math.max(best, acc / w); }
  return { peakDb: 20 * Math.log10(peak || 1e-9), loudestDb: 10 * Math.log10(best || 1e-12), audibleMs: Math.round(last / RATE * 1000) };
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

function wav(data: Float32Array) {
  const buffer = new ArrayBuffer(44 + data.length * 2), view = new DataView(buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, data.length * 2, true);
  data.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  let binary = ''; new Uint8Array(buffer).forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

(window as unknown as { renderAll: () => Promise<unknown> }).renderAll = async () => {
  const W = 1100, ROW = 92, canvas = document.getElementById('c') as HTMLCanvasElement;
  canvas.width = W; canvas.height = ROW * CUES.length;
  const g = canvas.getContext('2d')!, out = [];
  g.fillStyle = '#101418'; g.fillRect(0, 0, W, canvas.height);
  for (const [row, { name, cue }] of CUES.entries()) {
    const data = await render(cue), m = metrics(data), phone = metrics(await render(cue, true)), y = row * ROW, seconds = 1.95, px = (W - 230) / seconds;
    g.fillStyle = '#dfe7ee'; g.font = 'bold 13px sans-serif'; g.fillText(name, 8, y + 18);
    g.font = '12px sans-serif'; g.fillStyle = '#9fb3c4';
    g.fillText(`peak ${m.peakDb.toFixed(1)} dB`, 8, y + 36); g.fillText(`loud ${m.loudestDb.toFixed(1)} / phone ${phone.loudestDb.toFixed(1)} dB`, 8, y + 52); g.fillText(`${m.audibleMs} ms`, 8, y + 68);
    // Spectrogram (0-8 kHz, log magnitude) under the waveform.
    const N = 512, hop = 256, x0 = 220;
    for (let start = 0; start + N < data.length; start += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = data[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      fft(re, im);
      const x = x0 + start / RATE * px, bins = Math.floor(N / 2 * 8000 / (RATE / 2));
      for (let b = 0; b < bins; b++) {
        const mag = 20 * Math.log10(Math.hypot(re[b], im[b]) + 1e-9), v = Math.max(0, Math.min(1, (mag + 40) / 60));
        g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(180 * v * v)},${Math.round(90 + 120 * (1 - v)) * v})`;
        g.fillRect(x, y + ROW - 4 - (b + 1) * (ROW - 8) / bins, Math.max(1, hop / RATE * px), (ROW - 8) / bins + 0.5);
      }
    }
    g.strokeStyle = '#7fd1ff'; g.globalAlpha = 0.85; g.beginPath();
    for (let x = 0; x < (data.length / RATE) * px; x++) {
      const i0 = Math.floor(x / px * RATE), i1 = Math.floor((x + 1) / px * RATE); let lo = 0, hi = 0;
      for (let i = i0; i < Math.min(i1, data.length); i++) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
      g.moveTo(x0 + x, y + ROW / 2 - hi * ROW * 0.45); g.lineTo(x0 + x, y + ROW / 2 - lo * ROW * 0.45);
    }
    g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = '#2a3440'; g.beginPath(); g.moveTo(0, y + ROW - 0.5); g.lineTo(W, y + ROW - 0.5); g.stroke();
    out.push({ name, ...m, phoneDb: phone.loudestDb, wav: wav(data) });
  }
  return out;
};
(window as unknown as { ready: boolean }).ready = true;
