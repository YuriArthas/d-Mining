// Fixed views of world 2's and world 3's surfaces on the public build, UI hidden (the world 2/3 look work, like
// capture-surface-views.cjs for world 1). Opens every world through the debug unlock page first.
// node tools/capture-world-views.cjs <outdir>   WORLDS=2 or 3 limits the run; ONLY=w2-spawn,w3-eggs picks views.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const path = require('node:path'), fs = require('node:fs');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const out = path.resolve(process.argv[2] || 'artifacts/world-look/now');
fs.mkdirSync(out, { recursive: true });
// Each world's local frame: origin at its mine shaft (world z 224 / 448), +Z toward the spawn (local z 46), the
// world portal behind the spawn (local z 62), the teleport station at local (-10, 55), the eggs east of the spawn.
const at = (world, x, y, z) => [x, y, (world === 2 ? 224 : 448) + z];
/** Yaw that looks from `feet` toward world-space x/z `to` (camera yaw 0 looks toward -Z). */
const toward = (feet, to) => Math.atan2(feet[0] - to[0], feet[2] - to[1]);
const views = [];
for (const w of [2, 3]) {
  const view = (name, feet, target, pitch, distance) => views.push([`w${w}-${name}`, feet, toward(feet, target), pitch, distance]);
  view('spawn', at(w, 0, .1, 46), [0, at(w, 0, 0, 0)[2]], .14);                 // the spawn looking at the shaft
  view('portal', at(w, 0, .1, 52), [0, at(w, 0, 0, 62)[2]], .1);               // back toward the world portal
  view('station', at(w, -1.5, .1, 49), [-10, at(w, 0, 0, 55)[2]], .1);         // the teleport station
  view('eggs', at(w, 4, .1, 44), [20, at(w, 0, 0, 50)[2]], .16);               // the hatchery east of the spawn
  view('shaft', at(w, 0, .1, 22), [0, at(w, 0, 0, 0)[2]], .3);                 // the shaft and what stands over it
  view('west', at(w, 0, .1, 30), [-25, at(w, 0, 0, 24)[2]], .12);              // the sell side
  view('east', at(w, 0, .1, 30), [25, at(w, 0, 0, 24)[2]], .12);               // the shop side
  view('over', at(w, 0, .1, 40), [0, at(w, 0, 0, 10)[2]], .55, 26);            // high over the spawn, the whole basin
}
const only = process.env.ONLY?.split(','), worlds = process.env.WORLDS?.split(',');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=worlds-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
  await page.click('.dev-unlock-button'); await page.getByRole('button', { name: '全部解锁' }).click(); await page.getByRole('button', { name: '关闭' }).click();
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  for (const [name, feet, yaw, pitch, distance] of views.filter(v => (!only || only.includes(v[0])) && (!worlds || worlds.includes(v[0][1])))) {
    // The first trip to a later world loads its base while the player is travelling: wait for the arrival, and
    // try once more if the player still is not there.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(([f, y, p, d]) => { const v = window.__miningValidation; v.teleport(f); v.look(y, p); v.cameraDistance(d ?? null); }, [feet, yaw, pitch, distance]);
      await page.waitForTimeout(500);
      await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.travelling && s.ready; }, null, { timeout: 180000 });
      await page.evaluate(([y, p]) => window.__miningValidation.look(y, p), [yaw, pitch]);
      const at = await page.evaluate(() => window.__miningValidation.snapshot().position);
      if (Math.hypot(at[0] - feet[0], at[2] - feet[2]) < 20) break;
      if (attempt === 2) throw Error(`${name}: could not reach ${feet} (at ${at})`);
    }
    await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3, n, { timeout: 120000 });
    await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
    console.log('SHOT', name, JSON.stringify(await page.evaluate(() => window.__miningValidation.snapshot().position)));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
