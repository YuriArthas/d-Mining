const localTools = require('./local-tools.cjs');
// Public phone-landscape check (2026-10-29): a layer's cap under its recommended pickaxe still breaks, at half the
// damage, and its plate says which pickaxe it is meant for. World 1's first cap (24-40 m) with the first pickaxe:
// a small pocket dug into it away from the hall, then a tap on its floor.
// node tools/check-layer-cap-mobile.cjs
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/layer-cap');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const AIM = { x: 560, y: 230 };
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=cap-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => window.__miningValidation.overlayTimeScale(6));
  };
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2500); };
  const plate = () => page.evaluate(() => { const p = document.querySelector('.mine-plate'); return { on: p.classList.contains('mine-plate-on'), state: p.dataset.state, text: p.innerText.replace(/\s+/g, ' ').trim() }; });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    // The first pickaxe (a fresh save); away from the hall, a pocket dug into the cap at 30-34 m, standing on its floor.
    const [cx, cz] = [-30, -30];
    await page.evaluate(([cx, cz]) => window.__miningValidation.teleport([(cx + .5) * 2, -1.9, (cz + .5) * 2]), [cx, cz]);
    await settle();
    const pocket = [];
    // 3 × 3 × 2 cells: the dug blocks go into the bag (25), which must not fill (the plate would say so first)
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (let y = -17; y <= -16; y++) pocket.push([x, y, z]);
    for (let i = 0; i < pocket.length; i += 20) await page.waitForFunction(cells => window.__miningValidation.excavate(cells), pocket.slice(i, i + 20), { timeout: 30000, polling: 250 });
    // Every edit committed (its colliders in place) before stepping in; then make sure the miner stands on the floor.
    await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.pendingEdit && !s.inFlight && !s.queue; }, null, { timeout: 120000, polling: 250 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(([cx, cz]) => { const d = window.__miningValidation; d.teleport([(cx + .5) * 2, -33.9, (cz + .5) * 2]); d.look(0, .8); }, [cx, cz]);
      await settle();
      const y = await page.evaluate(() => window.__miningValidation.snapshot().position[1]);
      if (Math.abs(y + 34) < .3) break;
    }
    assert.ok(Math.abs(await page.evaluate(() => window.__miningValidation.snapshot().position[1]) + 34) < .3, 'standing on the pocket\'s floor');
    const floor = await page.evaluate(([cx, cz]) => window.__miningValidation.cell([cx, -18, cz]), [cx, cz]);
    assert.equal(floor, 65, 'the pocket\'s floor is the surface layer\'s cap');
    let seen = null;
    for (const [x, y] of [[AIM.x, AIM.y], [422, 300], [422, 340], [300, 300]]) {
      await page.touchscreen.tap(x, y); await page.waitForTimeout(500);
      const p = await plate(); if (p.on && /建议/.test(p.text)) { seen = p; break; }
    }
    assert.ok(seen, 'the plate over a cap block');
    assert.notEqual(seen.state, 'locked', 'the cap is not locked');
    assert.match(seen.text, /建议 Lv\.2 镐子/);
    const hp = await page.evaluate(() => document.querySelector('.mine-dmg')?.textContent ?? '');
    await page.screenshot({ path: path.join(dir, '01-cap-plate.png'), timeout: 180000 });
    await check(`With the first pickaxe the cap still breaks (plate state ${seen.state}, not locked) and the plate says 建议 Lv.2 镐子: "${seen.text}"; damage shown ${hp}.`);
    assert.deepEqual(report.errors, []);
    report.finishedAt = new Date().toISOString(); await save(); console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 180000 }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
