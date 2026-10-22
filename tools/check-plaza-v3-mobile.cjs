// Public phone-landscape check for the Pinewind plaza layout (v3).
// Seeds only an isolated acceptance database; movement and actions use touch.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/plaza-v3-mobile');
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
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async name => { await draw(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(350); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const panel = () => page.evaluate(() => document.querySelector('.session-ui')?.dataset.panel);
  const near = (a, b, r) => Math.hypot(a[0] - b[0], a[2] - b[2]) < r;

  try {
    // 1. Brand-new player, no debug.
    await page.goto(`${base}?saveTest=plaza-new-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.ui-hud') && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.waitForTimeout(5000); await page.screenshot({ path: path.join(dir, '00-new-player.png') }); report.screenshots.push('00-new-player');
    await check('Normal entry renders the plaza layout from the spawn.');

    // 2. Seed an isolated save with ores, coins, pets and the first two layers.
    const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=plaza-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace); assert.match(namespace, /acceptance/);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async name => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.coins = 2500; d.onboarding.status = 'skipped';
          d.inventory.items = { 'journey.rock.0': 10, 'journey.coal': 5 };
          const explored = { version: 1, maxDepth: 812, unlockedDestinationIds: ['old_mine', 'fungal'] };
          d.exploration = explored; d.worldExploration['1'] = explored;
          s.put(v, 'main');
        };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, namespace);
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();

    // 3. Sell trip: lands in the new sale ring west of the plaza, faces the building and sells.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); });
    await page.waitForTimeout(800);
    await tap(button('传送到售卖圈出售'));
    await page.waitForFunction(() => document.querySelector('[data-testid=bag-count]')?.textContent.startsWith('0 /'), null, { timeout: 30000 });
    let s = await snap();
    assert.ok(s.position[0] < -10 && s.position[2] > 12 && s.position[2] < 20, `sale ring on the west plaza edge: ${s.position}`);
    await shot('01-sell-trip');
    await check(`出售 teleports into the west sale ring (${s.position.map(v => v.toFixed(1)).join(', ')}), turns the camera to the building and auto-sells.`);

    // 4. Shop trip: the shop beside it opens.
    await tap(button('商店'));
    await page.getByRole('dialog', { name: '商店分类' }).waitFor({ timeout: 30000 });
    s = await snap();
    assert.ok(s.position[0] < -10 && s.position[2] > 22 && s.position[2] < 30, `shop ring next to sale: ${s.position}`);
    await tap(button(/^关闭商店/)); await page.waitForTimeout(800);
    await shot('02-shop-ring');
    await check(`商店 teleports into the shop ring beside the sale (${s.position.map(v => v.toFixed(1)).join(', ')}) and the shop opens.`);

    // 5. Egg trip to the first stand on the front terrace.
    await tap(button('打开我的宠物')); await tap(button('获取宠物')); await tap(button('前往原野蛋蛋台'));
    await page.waitForFunction(() => document.querySelector('.egg-world-prompt')?.style.visibility === 'visible', null, { timeout: 30000 });
    s = await snap();
    assert.ok(s.position[0] > 24 && s.position[0] < 28 && s.position[1] > .3, `front terrace: ${s.position}`);
    await shot('03-first-egg');
    await tap(button('查看宠物蛋')); await page.getByRole('dialog').first().waitFor(); await tap(button('关闭原野蛋'));
    await check('获取宠物 → 前往 lands on the front terrace at the 原野蛋 stand; the prompt shows and opens the egg sheet.');

    // 6. Portals ring the spawn: walk into 老矿井 with the joystick and travel down.
    await page.evaluate(() => { window.__miningValidation.teleport([-4, .1, 46]); window.__miningValidation.look(Math.PI / 2, .3); });
    await page.waitForTimeout(1500); await shot('04-portal-ring');
    const stick = await page.locator('.joystick').boundingBox();
    const p = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touch('touchStart', [p]); p.y -= 40; await touch('touchMove', [p]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().position[1] < -100, null, { timeout: 30000 });
    await touch('touchEnd');
    s = await snap(); await page.waitForTimeout(1500);
    await shot('05-arrived-old-mine');
    await check(`Walking west from the spawn with the joystick enters the 老矿井 portal and travels down (feet y ${s.position[1].toFixed(0)}).`);

    // 7. Return to the surface lands at the spawn among the portals.
    await tap(button('返回地表'));
    await page.waitForFunction(() => window.__miningValidation.snapshot().position[1] > -1, null, { timeout: 30000 });
    s = await snap();
    assert.ok(near(s.position, [0, 0, 46], 3), `back at spawn: ${s.position}`);
    await check('返回地表 lands at the spawn in the middle of the portal ring.');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
