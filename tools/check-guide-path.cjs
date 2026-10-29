// Public check (desktop, 2026-10-29): the first-dig guide, white chevrons with a dark-blue rim along the way to the
// mine over the bridge (riding its arch), and the arrow bobbing over the mine. Fresh save, its first tip showing.
// node tools/check-guide-path.cjs [outdir]
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = path.resolve(process.argv[2] || 'output/guide-path'); fs.mkdirSync(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), shots: [] };
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(`https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=guidepath-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    const ready = () => page.waitForFunction(() => { const s = window.__miningValidation?.snapshot(); return s?.ready && !s.travelling && !document.querySelector('.loading-screen'); }, null, { timeout: 300000, polling: 200 });
    await ready();
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.waitForFunction(() => window.__miningValidation.snapshot().guideDirection?.visible, null, { timeout: 120000 });
    const shot = async (name, feet, yaw, pitch, d) => {
      if (feet) { await page.evaluate(f => window.__miningValidation.teleport(f), feet); await ready(); await page.waitForTimeout(2000); }
      for (let k = 0; k < 3; k++) { await page.evaluate(([y, p, d]) => { const v = window.__miningValidation; v.look(y, p); v.cameraDistance(d); }, [yaw, pitch, d]); await page.waitForTimeout(1200); }
      const guide = await page.evaluate(() => window.__miningValidation.snapshot().guideDirection);
      await page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
      report.shots.push({ name, guide }); console.log(name, JSON.stringify(guide));
      return guide;
    };
    await page.waitForTimeout(4000);
    const spawn = await shot('01-spawn', [0, .1, 46], 0, .26, null);
    assert.equal(spawn.style, 'chevrons-v1'); assert.ok(spawn.visible && spawn.chevrons >= 12); assert.equal(spawn.route.length, 4, 'over the bridge');
    await shot('02-side', [0, .1, 46], -Math.PI / 2 + .45, .25, 14);
    await shot('03-on-bridge', [0, 1.3, 40], 0, .3, 6);
    await shot('04-near-mine', [0, .1, 24], 0, .2, 6);
    report.errors = errors; assert.deepEqual(errors, []);
    console.log('DONE');
  } catch (error) { report.failure = String(error?.stack ?? error); console.error('FAIL', error); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();
