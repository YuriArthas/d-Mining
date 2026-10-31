const localTools = require('../local-tools.cjs');
// P6 measurements on the public test build (docs/draft-economy-v2.md, P6): what the economy model's player knobs
// cost in the real game. With real input (mouse held, keys): digging straight down from the pit by the spawn, block
// by block, against the model's swing time; the sell button's trip (teleport to the ring, which sells on entry); the
// station's trip back to a layer's hall; the egg sheet. Times are wall clock. The transitions are an upper bound (a
// phone streams the destination faster); the digging needs a real frame rate: hits land on frames, so on this
// 3-core server's SwiftShader (under 1 fps, 2026-10-29) it says nothing, and the model takes the cadence from the
// code instead (docs/phase-economy-calibration-20261029.md).
// node tools/economy/measure-play.cjs [outdir]
const { chromium } = localTools.playwright();
const fs = require('node:fs'), path = require('node:path');
const base = localTools.gameUrl();
const out = path.resolve(process.argv[2] || 'artifacts/economy-measure'); fs.mkdirSync(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), base };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  try {
    await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=measure-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    const ready = (timeout = 300000) => page.waitForFunction(() => { const s = window.__miningValidation?.snapshot(); return s?.ready && !s.travelling && !document.querySelector('.loading-screen'); }, null, { timeout, polling: 50 });
    await ready();
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    const bag = () => page.$eval('[data-testid=bag-count]', e => +e.getAttribute('aria-label').match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/)[1].replace(/,/g, ''));
    const coins = () => page.$eval('[data-testid=coins]', e => +e.getAttribute('aria-label').replace(/[^\d]/g, ''));
    const fps = async ms => { const a = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted); await page.waitForTimeout(ms); const b = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted); return +((b - a) / (ms / 1000)).toFixed(1); };
    // Skip the one-time tips: they would sit over the HUD.
    await page.keyboard.press('Escape').catch(() => {});
    report.fps = await fps(3000); save(); console.log('fps', report.fps);

    // 1. Dig down from the pit by the spawn: look straight down, hold the mouse at the screen centre.
    await page.evaluate(() => { const v = window.__miningValidation; v.teleport([1, -1.9, 7]); v.cameraDistance(5); });
    await ready(); await page.waitForTimeout(1500);
    await page.evaluate(() => window.__miningValidation.look(0, -1.45));
    await page.waitForTimeout(800);
    await page.mouse.move(480, 300);
    const dig = { blocks: [], start: null };
    const b0 = await bag(); let last = b0; const t0 = Date.now();
    await page.mouse.down();
    while (Date.now() - t0 < 60000) {
      await page.waitForTimeout(50);
      const n = await bag();
      if (n !== last) { dig.blocks.push({ t: (Date.now() - t0) / 1000, bag: n }); last = n; }
      if (n >= 20) break;
    }
    await page.mouse.up();
    dig.fps = await fps(2000);
    dig.depth = await page.evaluate(() => { const s = window.__miningValidation.snapshot(); return s.position?.[1] ?? null; });
    const times = dig.blocks.map(b => b.t), gaps = times.slice(1).map((t, i) => t - times[i]);
    dig.perBlock = gaps.length ? +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(3) : null;
    report.digDown = dig; save(); console.log('dig down', dig.blocks.length, 'blocks, per block', dig.perBlock, 's at', dig.fps, 'fps');

    // 2. The sell button: teleport to the ring, sold on entry.
    const c0 = await coins(), s0 = Date.now();
    await page.click('.hud-sell');
    await page.waitForFunction(c => +document.querySelector('[data-testid=coins]').getAttribute('aria-label').replace(/[^\d]/g, '') > c, c0, { timeout: 120000, polling: 50 });
    report.sellTrip = { seconds: (Date.now() - s0) / 1000, coins: (await coins()) - c0 };
    await ready(); report.sellTrip.readySeconds = (Date.now() - s0) / 1000; save();
    console.log('sell trip', JSON.stringify(report.sellTrip));

    // 3. Back down by the station: unlock the first hall (testing page), stand on the station pad, pick the hall.
    await page.click('.dev-unlock-button'); await page.locator('.dev-unlock li button').first().click(); await page.getByRole('button', { name: '关闭' }).click();
    const station = await page.evaluate(() => window.__miningValidation.snapshot().content.stations.find(s => s.worldId === 1).zone);
    await page.evaluate(z => window.__miningValidation.teleport([z.x, z.y + .1, z.z]), station);
    await ready(); await page.locator('.station-sheet').waitFor({ timeout: 60000 });
    const go = page.locator('.station-sheet .station-go').nth(1);
    const h0 = Date.now(); await go.click();
    await page.waitForFunction(() => window.__miningValidation.snapshot().travelling, null, { timeout: 20000, polling: 20 }).catch(() => {});
    await ready(); report.stationTrip = { seconds: (Date.now() - h0) / 1000 }; save();
    console.log('station trip', JSON.stringify(report.stationTrip));

    // 4. One hatch at the first egg (coins granted): from the press to the egg sheet being ready again.
    await page.evaluate(() => window.__miningValidation.grantCoins(100000));
    const egg = await page.evaluate(() => window.__miningValidation.snapshot().content.eggStations[0]);
    await page.evaluate(z => window.__miningValidation.teleport([z.x, z.y + .1, z.z]), egg.zone);
    await ready(); await page.waitForTimeout(1500);
    await page.keyboard.press('e'); await page.locator('.egg-sheet, [class*=egg-sheet]').first().waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(out, 'egg-sheet.png'), timeout: 180000 });
    report.eggButtons = await page.$$eval('.egg-sheet button, [class*=egg-sheet] button', b => b.map(x => x.textContent.trim()).filter(Boolean));
    save(); console.log('egg buttons', JSON.stringify(report.eggButtons));
    report.finishedAt = new Date().toISOString(); save();
  } catch (error) {
    report.failure = String(error?.stack ?? error); save();
    await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 180000 }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
