const localTools = require('./local-tools.cjs');
// Public phone-landscape comparison (2026-11-01): the sell and shop pads. The user found the circles under SELL and
// the shops hard to see (a thin glowing line on the plaza's sand). The same views on an entry before and after:
// the plaza toward the two shops, the sell pad and the pickaxe shop's pad from a few steps away, standing in the
// sell pad, and the first hall's sell pad.
//   node tools/check-service-pads-mobile.cjs [before|after]   (before: the formal entry, which still has the rings)
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const which = process.argv[2] || 'after';
const base = which === 'before' ? new URL('games/mining/index.html', localTools.publicRoot()).href : localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/service-pads');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
/** Camera yaw that looks along (dx, dz). */
const yaw = (dx, dz) => Math.atan2(-dx, -dz);
const VIEWS = [
  { name: 'plaza-shops', label: 'from the plaza toward the pickaxe and backpack shops', at: [2, .1, 21], look: [yaw(-1, -.05), .32] },
  // A little off the pad's bearing, so the miner in the middle of the view does not stand in front of it.
  { name: 'sell', label: 'the sell pad a few steps away', at: [8.44, .1, 20.29], look: [yaw(5.98, -6.19) + .3, .3] },
  { name: 'pickaxe', label: 'the pickaxe shop pad a few steps away', at: [-6.5, .1, 17], look: [yaw(-6.3, -3.3) + .3, .3] },
  { name: 'in-sell', label: 'standing in the sell pad, facing the house', at: [12.96, .1, 15.62], look: [yaw(5.98, -6.19), .35] },
  { name: 'old-mine', label: 'the old mine hall: its sell pad', at: [-3, -59.9, 13], look: [yaw(-9, -1.6), .3] },
];
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, which, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, `report-${which}.json`), JSON.stringify(report, null, 2));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  try {
    await page.goto(`${base}?lang=zh&debug=1&saveTest=service-pads-${which}-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    const only = process.env.ONLY?.split(',');
    for (const view of VIEWS.filter(v => !only || only.includes(v.name))) {
      await page.evaluate(([at, look]) => { window.__miningValidation.teleport(at); window.__miningValidation.look(...look); }, [view.at, view.look]);
      await page.waitForFunction(() => window.__miningValidation.snapshot().ready, null, { timeout: 120000 });
      await page.waitForTimeout(view.name === 'old-mine' ? 15000 : 4000);
      const name = `${which}-${view.name}`;
      await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 });
      report.screenshots.push({ name, label: view.label }); console.log('SHOT', name, view.label); await save();
    }
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.errors.push(String(error?.stack || error)); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
