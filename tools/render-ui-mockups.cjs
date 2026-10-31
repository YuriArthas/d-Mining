const localTools = require('./local-tools.cjs');
// Render docs/ui-mockups/mockups.html frames to PNG (phone landscape, DPR 2).
const { chromium } = localTools.playwright();
const path = require('node:path'), fs = require('node:fs/promises');
const source = path.resolve(__dirname, '../docs/ui-mockups/mockups.html');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../artifacts/ui-mockups'));
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + source, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const fontOk = await page.evaluate(() => document.fonts.check('20px "Mining Display Noto"', '矿'));
  for (const frame of await page.locator('.frame').all()) {
    const name = await frame.getAttribute('data-name');
    await frame.screenshot({ path: path.join(out, name + '.png') });
    console.log('SHOT', name);
  }
  console.log(JSON.stringify({ fontOk, errors }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
