// Public phone-landscape check for the one-time tips that replaced the forced tutorial.
// Uses isolated acceptance saves only; every action uses touch.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/tips-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const tip = async () => (await snap()).economy.tip;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3, n, { timeout: 120000, polling: 300 });
  };
  const shot = async (name, label = '') => { await draw(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push({ name, label }); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(350); };
  const waitTip = (id, timeout = 30000) => page.waitForFunction(id => (window.__miningValidation.snapshot().economy.tip?.id ?? null) === id, id, { timeout, polling: 100 });
  const noForcedTutorial = async () => {
    assert.equal(await page.locator('.guide-card').count(), 0, 'no objective card');
    assert.equal(await page.getByRole('button', { name: '跳过引导' }).count(), 0, 'nothing to skip');
    assert.equal(await page.locator('.journey-mining').count(), 0, 'no 100-block chore');
  };
  const edit = async (namespace, change) => {
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ([name, change]) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; new Function('d', change)(v.data); s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, [namespace, change]);
  };

  try {
    // 1. Brand-new player: one tip, pointing at the mine.
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=tips-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .3); });
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.tip?.anchor === 'mine', null, { timeout: 30000 });
    await noForcedTutorial();
    await page.waitForFunction(() => document.querySelector('.guide-marker')?.style.visibility === 'visible', null, { timeout: 30000 });
    assert.match(await page.locator('.guide-marker').innerText(), /去矿坑挖矿/);
    assert.equal(await page.locator('.ui-tip').count(), 0, 'no HUD tip line yet');
    await shot('01-new-player', 'new player: only an arrow toward the mine');
    await check('A new player sees a single tip: an arrow toward the mine. No objective card, no skip button, no task list.');

    // 2. At the mine the tip becomes a glowing block; mining it ends the tip for good.
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); window.__miningValidation.look(0, .5); });
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.tip?.anchor === 'dig', null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.guide-dig-marker')?.dataset.hasTarget === 'true', null, { timeout: 30000 });
    await shot('02-dig-ring', 'at the mine: one glowing block to hold');
    const ring = await page.locator('.guide-dig-ring').boundingBox();
    await touch('touchStart', [{ x: ring.x + ring.width / 2, y: ring.y + ring.height / 2, id: 3 }]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.onboarding.minedOnce, null, { timeout: 60000, polling: 100 });
    await touch('touchEnd');
    await waitTip(null);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.guide-dig-marker').count(), 0, 'ring gone');
    await shot('03-after-first-block', 'after the first block: no tips at all');
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    const again = url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`);
    await page.goto(again, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); });
    await page.waitForTimeout(2500);
    assert.equal(await tip(), null, 'the first-dig tip never returns');
    assert.deepEqual((await snap()).economy.onboarding.seen, ['dig']);
    await check('Holding the glowing block mines it; the tip disappears and stays gone after a reload.');

    // 3. First full bag: one line under the depth, 出售 pulses; using it ends the tip.
    await page.evaluate(() => window.__miningSave.flush());
    await edit(namespace, "d.wallet.coins = 2500; d.inventory.items = { 'journey.rock.0': 49 };");
    await page.goto(again, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); window.__miningValidation.look(0, .5); });
    await page.waitForTimeout(1500); await draw();
    for (const [x, y] of [[422, 200], [422, 250], [480, 220], [360, 220], [422, 300]]) {
      await touch('touchStart', [{ x, y, id: 4 }]);
      try { await waitTip('sell', 8000); break; } catch { await touch('touchEnd'); }
    }
    await touch('touchEnd');
    assert.equal((await tip())?.id, 'sell');
    await page.locator('.ui-tip').waitFor();
    assert.match(await page.locator('.ui-tip').innerText(), /背包满了/);
    assert.equal(await page.locator('.ui-hud').getAttribute('data-tip'), 'sell', '出售 pulses');
    await shot('04-sell-tip', 'first full bag: one line, 出售 pulses');
    await tap(page.getByRole('button', { name: '传送到售卖圈出售' }));
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.onboarding.soldOnce, null, { timeout: 30000 });
    assert.notEqual((await tip())?.id, 'sell');
    await check('The first full bag shows one short line under the depth and pulses 出售; selling ends it.');

    // 4. Affordable pickaxe: one line, 商店 pulses; tapping 商店 ends it. (Economy v2: one bag of dirt does not pay for
    // the next pickaxe any more, so top the wallet up to its price.)
    await page.evaluate(() => window.__miningValidation.grantCoins(1000));
    await waitTip('shop', 30000);
    assert.match(await page.locator('.ui-tip').innerText(), /商店/);
    await shot('05-shop-tip', 'first affordable pickaxe');
    await tap(page.getByRole('button', { name: '商店', exact: true }));
    await page.locator('.shop-showroom').waitFor({ timeout: 30000 });
    await tap(page.getByRole('button', { name: /^关闭商店/ })); await page.waitForTimeout(500);
    assert.notEqual((await tip())?.id, 'shop');
    await check('With enough coins for a pickaxe the 商店 tip appears once; opening the shop ends it.');

    // 5. Affordable egg, after a quiet pause: one line, 宠物 pulses; tapping 宠物 ends it.
    const quiet = Date.now();
    await waitTip('pets', 30000);
    assert.ok(Date.now() - quiet >= 4000, 'tips never chain back to back');
    await shot('06-pets-tip', 'first affordable egg');
    await tap(page.getByRole('button', { name: '打开我的宠物' }));
    await page.getByRole('dialog').first().waitFor();
    await tap(page.getByRole('dialog').getByRole('button', { name: /关闭/ }).first()); await page.waitForTimeout(500);
    assert.equal(await tip(), null);
    await check('After a quiet pause the 宠物 tip appears once; opening pets ends it.');

    // 6. Nothing comes back.
    await page.evaluate(() => window.__miningSave.flush());
    await page.goto(again, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); });
    await page.waitForTimeout(3000);
    const final = (await snap()).economy;
    assert.equal(final.tip, null);
    assert.deepEqual(final.onboarding.seen, ['dig', 'sell', 'shop', 'pets']);
    await noForcedTutorial();
    await shot('07-after-reload', 'after reload: no tips');
    await check('After a reload no tip comes back; every tip was shown once.');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
