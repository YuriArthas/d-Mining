// Scene-only shots of Pinewind from fixed angles (no UI), for before/after colour comparisons.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const VIEWS = [
  ['portal', [0, .1, 46], Math.PI, .18],        // spawn looking south: world portal and teleport station
  ['user', [0, .1, 52], 0, .14],                // the user's original angle: spawn looking north to the mine
  ['bridge', [-6, .1, 38], 2.6, .12],
  ['plaza-west', [0, .1, 40], -Math.PI / 2, .15],
  ['plaza-east', [0, .1, 40], Math.PI / 2, .15],
  ['station', [-2.7, .1, 48.5], 2.29, .12],      // the teleport station from the path, its pad in front
  ['gate', [0, .1, 57], Math.PI, .06],            // the world gate in the south pass
  ['station-west', [-14.5, .1, 47], -2.63, .15],  // the station from its far side: ice spikes and lava rock
];
// ONLY=station,gate limits the run to those views.
const only = process.env.ONLY?.split(',');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=look-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  for (const [name, feet, yaw, pitch] of VIEWS.filter(v => !only || only.includes(v[0]))) {
    await page.evaluate(([f, y, p]) => { window.__miningValidation.teleport(f); window.__miningValidation.look(y, p); }, [feet, yaw, pitch]);
    await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3, n, { timeout: 120000 });
    await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
    console.log('SHOT', name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
