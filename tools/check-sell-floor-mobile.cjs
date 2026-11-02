const localTools = require('./local-tools.cjs');
// Public phone-landscape check (2026-11-02): Sell from inside a hall goes to that hall's counter. The user stood in
// the mushroom cave (the third layer, the second hall), pressed 出售 and was sent up to the old mine's: only feet on
// the hall's bare floor counted as being on it, not a step, a crate, a jump or a teleport not yet landed. A bag of
// ore, the miner six metres over the mushroom cave's floor and still falling, 出售 on the HUD at once. Then the view on
// arriving at world 1's other halls' sell rings: facing the counter, the camera clear of the stall (the arrival faced
// away from it, and the camera stood behind the mushroom cave's counter, in its mushrooms' caps).
//   node tools/check-sell-floor-mobile.cjs
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/sell-floor');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// The mushroom cave (depth 140): its spawn and its sell ring; the old mine's ring is at depth 60.
const MUSHROOM = { air: [0, -134, 12], sell: [-12, -140, 11.4] };
const HALLS = [['old-mine', 60], ['crystal', 260], ['ruins', 420], ['frozen', 620], ['volcanic', 860]];
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('crash', () => report.errors.push('the page crashed'));
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name, label) => { await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push({ name, label }); console.log('SHOT', name, label); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  try {
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=sell-floor-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    // A bag of ore in the saved game, then the game again.
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    await page.evaluate(() => window.__miningSave.flush());
    await page.goto(localTools.publicRoot(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(async name => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; v.data.inventory.items = { 'journey.rock.0': 12 }; s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, namespace);
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' }); await ready();
    assert.equal((await snap()).economy.inventory.used, 12, 'twelve rocks in the bag');

    await page.evaluate(at => { window.__miningValidation.teleport(at); window.__miningValidation.look(0, .3); }, MUSHROOM.air);
    await page.waitForFunction(at => { const p = window.__miningValidation.snapshot().position; return Math.abs(p[1] - at[1]) < 1.5; }, MUSHROOM.air, { timeout: 120000 });
    const before = (await snap()).position;
    assert.ok(before[1] > MUSHROOM.sell[1] + 3, `still in the air over the floor (${before[1].toFixed(2)})`);
    await shot('01-in-the-air', `in the mushroom cave, ${(before[1] - MUSHROOM.sell[1]).toFixed(1)} m over its floor, falling`);
    await tap(page.locator('.hud-sell'));
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.inventory.used === 0, null, { timeout: 120000 });
    const after = (await snap()).position;
    const off = Math.hypot(after[0] - MUSHROOM.sell[0], after[2] - MUSHROOM.sell[2]);
    assert.ok(Math.abs(after[1] - MUSHROOM.sell[1]) < 1 && off < 2.5, `at the mushroom cave's sell ring, not the old mine's (${after.map(v => v.toFixed(1))})`);
    await check(`出售 in the air in the mushroom cave: sold at its own ring (${after.map(v => v.toFixed(1)).join(', ')}), not the old mine's at -60`);
    await page.waitForTimeout(2500);
    await shot('02-sold-here', 'sold at the mushroom cave\'s own counter, facing it');
    // The other halls: the same arrival (facing +Z, the side the SELL sign stands on), by teleport.
    for (const [name, depth] of HALLS) {
      await page.evaluate(([at, yaw]) => { window.__miningValidation.teleport(at); window.__miningValidation.look(yaw, .34); }, [[-12, -depth + .1, 11.4], Math.PI]);
      await page.waitForFunction(() => window.__miningValidation.snapshot().ready, null, { timeout: 120000 });
      await page.waitForTimeout(6000);
      await shot(`03-${name}`, `arriving at the ${name} hall's sell ring`);
    }
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.errors.push(String(error?.stack || error)); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
