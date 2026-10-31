const localTools = require('../local-tools.cjs');
// Authoring aid for the music, ambience and footsteps (src/game/audio): renders everything offline
// through the game's mixer and writes spectrogram sheets, level metrics and WAV excerpts.
//   npx vite --port 5199 --strictPort --host 127.0.0.1      (from the repository root)
//   node tools/music-preview/render.cjs artifacts/music [songs|ambience|steps|all]
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path');
const SONGS = ['meadow', 'timber', 'mushroom', 'crystal', 'ruins', 'ice', 'lava', 'fossil', 'machine', 'core'];
const ZONES = ['meadow', 'shallow', 'timber', 'mushroom', 'crystal', 'ruins', 'ice', 'lava', 'fossil', 'machine', 'core'];
const SURFACES = ['grass', 'sand', 'dirt', 'stone', 'wood', 'metal', 'ice', 'crystal'];
(async () => {
  const dir = path.resolve(process.argv[2] || 'artifacts/music'), what = process.argv[3] || 'all', excerpt = Number(process.env.EXCERPT || 30);
  await fs.mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5199/tools/music-preview/index.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const report = {};
  // Vite may reload the page once after source edits; render again if that happens.
  const evaluate = async (fn, arg) => {
    for (let attempt = 0; ; attempt++) {
      try { return await page.evaluate(fn, arg); } catch (error) {
        if (attempt > 1 || !/context was destroyed|navigation/.test(String(error))) throw error;
        await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
      }
    }
  };
  const run = async (name, items, excerptSeconds) => {
    const started = Date.now();
    const result = await evaluate(async ([items, excerptSeconds]) => {
      const p = window.preview, rows = [], out = [];
      for (const item of items) {
        const buffer = await p[item.kind](...item.args);
        rows.push({ label: item.label, buffer });
        out.push({ label: item.label, ...p.metrics(buffer), wav: excerptSeconds ? p.wav(buffer, excerptSeconds) : null });
      }
      p.sheet(rows);
      return out;
    }, [items, excerptSeconds]);
    await page.locator('#c').screenshot({ path: path.join(dir, `${name}.png`) });
    for (const r of result) if (r.wav) await fs.writeFile(path.join(dir, `${name}-${r.label.replace(/[^\w-]+/g, '_')}.wav`), Buffer.from(r.wav, 'base64'));
    report[name] = result.map(({ wav, ...m }) => m);
    console.log(`${name}: ${((Date.now() - started) / 1000).toFixed(1)}s`); console.table(report[name]);
  };
  if (what === 'levels') await run('levels', SONGS.map(id => ({ kind: 'song', args: [id, 0, 1, 1, 0, 45], label: id })), 0);
  if (what === 'clips') {
    // Listening excerpts (mono Opus, low bitrate) for summaries; encoded in real time. Each kind is
    // raised by a fixed gain so it is comfortable to hear on its own (relative levels within a kind kept).
    const jobs = [
      ...SONGS.map(id => ({ name: `song-${id}`, kind: 'song', args: [id, 0], from: 'theme', seconds: Number(process.env.SONG_SECONDS || 6), gain: 4 })),
      { name: 'ambience-meadow', kind: 'ambience', args: ['meadow', 9], from: 1, seconds: 6, gain: 5.6 },
      { name: 'ambience-timber', kind: 'ambience', args: ['timber', 9], from: 1, seconds: 5, gain: 5.6 },
      { name: 'ambience-lava', kind: 'ambience', args: ['lava', 9], from: 1, seconds: 5, gain: 5.6 },
      { name: 'ambience-machine', kind: 'ambience', args: ['machine', 9], from: 1, seconds: 5, gain: 5.6 },
      { name: 'steps', kind: 'stepTour', args: [['grass', 'sand', 'stone', 'wood', 'metal', 'ice']], from: 0, seconds: 10, gain: 3 },
    ];
    // CLIP_QUALITY=high: stereo at 64 kbps (songs) / 48 kbps, for hosting; default mono 20 kbps for embedding.
    const high = process.env.CLIP_QUALITY === 'high', clips = {};
    for (const job of jobs) {
      if (high && job.kind === 'song') job.seconds = Number(process.env.SONG_SECONDS || 10);
      if (high && job.kind === 'ambience') { job.seconds = 8; job.args = [job.args[0], 10]; }
      Object.assign(job, { bitrate: high ? (job.kind === 'song' ? 64000 : 48000) : 20000, channels: high ? 2 : 1 });
      clips[job.name] = await evaluate(async job => {
        const p = window.preview, args = job.kind === 'song' ? [...job.args, 1, 1, 0, p.firstTheme(job.args[0]) + job.seconds + 1] : job.args;
        const buffer = await p[job.kind](...args), from = job.from === 'theme' ? p.firstTheme(job.args[0]) : job.from;
        return p.opus(buffer, from, job.seconds, job.bitrate, job.gain, job.channels);
      }, job);
      console.log(job.name, Math.round(clips[job.name].length / 1024), 'KiB base64');
    }
    await fs.writeFile(path.join(dir, high ? 'clips-high.json' : 'clips.json'), JSON.stringify(clips));
  }
  if (what === 'zoom') await run('zoom', (process.env.SONGS || 'meadow,timber').split(',').map(id => ({ kind: 'song', args: [id, 0, 1, 1, 0, 20], label: `${id} 0-20s` })), 0);
  if (what === 'songs' || what === 'all') {
    await run('songs', SONGS.map(id => ({ kind: 'song', args: [id, 0], label: id })), excerpt);
    await run('songs-b', SONGS.map(id => ({ kind: 'song', args: [id, 1], label: `${id}-b` })), 0);
    await run('mixes', [
      { kind: 'song', args: ['meadow', 0, 0, 0.85, 1], label: 'meadow-shaft' },
    ], 0);
  }
  if (what === 'ambience' || what === 'all') await run('ambience', ZONES.map(id => ({ kind: 'ambience', args: [id, 30], label: id })), 20);
  if (what === 'steps' || what === 'all') {
    await run('steps', SURFACES.map(s => ({ kind: 'steps', args: [s], label: s })), 3);
    await run('cues', [
      { kind: 'cue', args: [{ type: 'hit', material: 'rock' }], label: 'hit-rock' },
      { kind: 'cue', args: [{ type: 'pickup', tier: 1 }], label: 'pickup' }, { kind: 'cue', args: [{ type: 'ui' }], label: 'ui' },
      { kind: 'cue', args: [{ type: 'land', strength: 0.6 }], label: 'land' },
    ], 0);
  }
  await fs.writeFile(path.join(dir, `metrics-${what}.json`), JSON.stringify(report, null, 2));
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})();
