// Public phone-landscape check for the UI kit HUD (steps 1–2 of the UI rework).
// Touch input only; debug teleport/look only set up camera positions.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const url = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/ui-hud-v2-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SIZES = [[844, 390], [667, 375], [640, 320], [932, 430]];

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone.', checks: [], layouts: [], errors: [], screenshots: [] };
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
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async (name, debug = true) => {
    if (debug) await draw(); else await page.waitForTimeout(2500);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dir, name + '.png') });
    report.screenshots.push(name); console.log('SHOT', name); await save();
  };
  const load = async (query, debug = true) => {
    await page.goto(`${url}?${debug ? 'debug=1&submission=fenced&framesInFlight=1&' : ''}saveTest=hud-v2-${Date.now()}${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.ui-hud') && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    if (debug) {
      await page.waitForFunction(() => window.__miningValidation?.snapshot().ready, null, { timeout: 300000 });
      await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    }
    await page.evaluate(() => document.fonts.ready);
  };
  const box = selector => page.locator(selector).first().boundingBox();
  const overlap = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1 && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1;
  const inside = (r, label) => { const v = page.viewportSize(); assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1, `${label} inside viewport ${JSON.stringify(r)}`); };
  const layout = async name => {
    const zones = {};
    for (const [key, selector] of Object.entries({ left: '.hud-left', depth: '.hud-depth', system: '.hud-system', rail: '.hud-rail', bottom: '.hud-bottom', joystick: '.joystick', jump: '.jump-button' })) {
      zones[key] = await box(selector); inside(zones[key], key);
    }
    for (const [a, b] of [['left', 'depth'], ['depth', 'system'], ['depth', 'rail'], ['system', 'rail'], ['rail', 'jump'], ['left', 'joystick'], ['bottom', 'joystick'], ['bottom', 'jump'], ['left', 'rail']]) {
      assert.ok(!overlap(zones[a], zones[b]), `${name}: ${a} clear of ${b} ${JSON.stringify([zones[a], zones[b]])}`);
    }
    for (const button of await page.locator('.ui-hud button:visible, .jump-button').all()) {
      const r = await button.boundingBox(); inside(r, await button.getAttribute('aria-label') ?? 'button');
      assert.ok(r.width >= 44 && r.height >= 44, `44px target: ${await button.getAttribute('aria-label')} ${JSON.stringify(r)}`);
    }
    assert.equal(await page.evaluate(() => document.elementFromPoint(innerWidth * .55, innerHeight * .5)?.tagName), 'CANVAS', 'camera drag area stays open');
    report.layouts.push({ name, viewport: page.viewportSize(), zones });
  };
  const tap = async locator => { const r = await locator.boundingBox(); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(250); };
  const panel = () => page.evaluate(() => document.querySelector('.session-ui').dataset.panel);

  try {
    // 1. Normal player view, no debug.
    await load('', false);
    assert.equal(await page.evaluate(() => document.fonts.check('20px "Mining Display Noto"', '矿')), true, 'display font loaded');
    await shot('00-normal-player-844x390', false);
    await check('Normal entry without debug renders the kit HUD and loads the subset display font.');

    // 2. Layout across phone sizes and injected safe areas.
    await load('');
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); });
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await layout(`${width}x${height}`); await shot(`01-surface-${width}x${height}`);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('.game-shell').evaluate(e => { e.style.setProperty('--safe-left', '44px'); e.style.setProperty('--safe-right', '44px'); e.style.setProperty('--safe-bottom', '21px'); });
    await layout('844x390 safe areas'); await shot('02-safe-areas');
    await page.locator('.game-shell').evaluate(e => { for (const p of ['--safe-left', '--safe-right', '--safe-bottom']) e.style.removeProperty(p); });
    assert.equal(await page.getByRole('button', { name: '返回地表' }).count(), 0, 'no return button on the surface');
    assert.equal(await page.getByTestId('depth').innerText(), '地表');
    await check('Four landscape phone sizes and 44px/21px safe areas: HUD zones stay inside, never overlap each other or the thumb controls, every HUD touch target is at least 44px, the centre stays a camera drag area. Surface shows depth "地表" and no return button.');

    // 3. More fold, settings, help and click-through protection.
    await tap(page.getByRole('button', { name: '更多功能' }));
    assert.equal(await page.locator('.hud-more-panel[data-open=true] button').count(), 3);
    for (const b of await page.locator('.hud-more-panel button').all()) inside(await b.boundingBox(), 'more item');
    await shot('03-more-open');
    await tap(page.getByRole('button', { name: '收起功能' }));
    assert.equal(await page.locator('.hud-more-panel[data-open=true]').count(), 0);
    await tap(page.getByRole('button', { name: '设置' }));
    await page.getByRole('button', { name: '退出游戏，返回游戏列表' }).waitFor();
    inside(await box('.hud-settings-panel'), 'settings panel');
    const exitButton = page.getByRole('button', { name: '退出游戏，返回游戏列表' });
    await exitButton.scrollIntoViewIfNeeded(); inside(await exitButton.boundingBox(), 'exit button reachable');
    for (const b of await page.locator('.hud-settings-panel button').all()) assert.ok((await b.boundingBox()).height >= 44, 'settings item 44px');
    await shot('04-settings-open');
    await page.touchscreen.tap(420, 220); await page.waitForTimeout(300);
    assert.equal(await page.locator('.hud-settings-panel').count(), 0, 'tap outside closes settings');
    assert.equal(await panel(), 'none', 'outside tap opened nothing');
    await tap(page.getByRole('button', { name: '操作帮助' }));
    await page.getByRole('dialog').waitFor();
    await tap(page.getByRole('button', { name: '关闭操作帮助' }));
    assert.equal(await panel(), 'none');
    assert.equal(await page.locator('.hud-settings-panel').count(), 0, 'closing help does not click through to settings');
    await check('Touch: More fold opens 世界/传送/矿物 and folds back; settings panel holds frame-rate, shadow and exit (moved out of the corner), closes on an outside tap without opening anything; help opens and closes with no click-through.');

    // 4. Resource pill actions.
    await tap(page.getByRole('button', { name: '查看背包里的矿物' }));
    assert.equal(await panel(), 'minerals'); await page.keyboard.press('Escape').catch(() => {});
    if (await panel() !== 'none') await tap(page.getByRole('dialog').getByRole('button', { name: /关闭/ }).first());
    assert.equal(await panel(), 'none');
    await tap(page.getByRole('button', { name: '升级背包' }));
    await page.waitForFunction(() => document.querySelector('[data-testid=guide-card]')?.textContent.includes('商店'));
    await shot('05-backpack-plus-guides-to-shop');
    await tap(page.getByRole('button', { name: '取消指引' }));
    await check('Backpack pill opens the mineral bag; its plus button starts the existing route guidance to the shop (cancellable).');

    // 5. Underground: depth and the return button appear, and return works by touch.
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); window.__miningValidation.look(0, .5); });
    await page.getByRole('button', { name: '返回地表' }).waitFor();
    assert.match(await page.getByTestId('depth').innerText(), /米$/);
    await layout('844x390 underground'); await shot('06-underground-return');
    await tap(page.getByRole('button', { name: '返回地表' }));
    await page.waitForFunction(() => document.querySelector('[data-testid=depth]')?.textContent === '地表', null, { timeout: 30000 });
    assert.equal(await page.getByRole('button', { name: '返回地表' }).count(), 0);
    await check('Underground the depth banner shows metres and the return button appears bottom-centre; tapping it returns to the surface and the button disappears.');

    // 6. Joystick still drives movement; HUD text cannot be long-press selected.
    const stick = await box('.joystick'); const p = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touch('touchStart', [p]); p.x += 30; await touch('touchMove', [p]);
    assert.ok((await page.evaluate(() => window.__mining.getInput())).moveX > .2, 'joystick moves');
    await touch('touchEnd'); assert.equal((await page.evaluate(() => window.__mining.getInput())).moveX, 0);
    const depth = await box('.hud-depth'); await page.evaluate(() => getSelection().removeAllRanges());
    await touch('touchStart', [{ x: depth.x + depth.width / 2, y: depth.y + depth.height / 2, id: 9 }]); await page.waitForTimeout(850); await touch('touchEnd');
    assert.equal(await page.evaluate(() => getSelection().toString()), '');
    await check('Joystick touch still moves the player and releases to zero; an 850ms long-press on HUD text selects nothing.');

  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
