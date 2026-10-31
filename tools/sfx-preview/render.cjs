const localTools = require('../local-tools.cjs');
// Authoring aid for the procedural sound cues (src/game/audio/sfx.ts): renders each cue offline,
// writes a waveform/spectrogram sheet, level metrics and WAV files.
//   npx vite --port 5199 --strictPort --host 127.0.0.1      (from the repository root)
//   node tools/sfx-preview/render.cjs artifacts/sfx
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path');
(async () => {
  const dir = path.resolve(process.argv[2] || 'artifacts/sfx');
  await fs.mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5199/tools/sfx-preview/index.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const cues = await page.evaluate(() => window.renderAll());
  await page.locator('#c').screenshot({ path: path.join(dir, 'sheet.png') });
  for (const cue of cues) await fs.writeFile(path.join(dir, cue.name.replace(/\s+/g, '-') + '.wav'), Buffer.from(cue.wav, 'base64'));
  const table = cues.map(({ wav, ...rest }) => rest);
  await fs.writeFile(path.join(dir, 'metrics.json'), JSON.stringify(table, null, 2));
  console.table(table);
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})();
