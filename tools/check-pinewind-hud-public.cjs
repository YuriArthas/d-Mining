const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const url = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/pinewind-hud-public');

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [], tier: 'Public desktop Chromium / SwiftShader; isolated test save' };
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9338', '--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const check = text => { report.checks.push(text); console.log('PASS', text); };
  const ready = () => page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 240000 });
  const shot = async name => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2').finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 2; }, n, { timeout: 120000, polling: 300 });
    await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 60000 });
    report.screenshots.push(name); console.log('SHOT', name);
  };
  const layout = async () => {
    const result = await page.evaluate(() => {
      const selectors = ['.hud-status', '.hud-navigation', '.hud-equipment', '.guide-card'];
      return selectors.map(selector => {
        const el = document.querySelector(selector), r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { selector, x: r.x, y: r.y, width: r.width, height: r.height, background: s.backgroundColor, border: s.borderWidth, shadow: s.boxShadow, visible: s.visibility };
      });
    });
    const { width, height } = page.viewportSize();
    for (const r of result) {
      assert.equal(r.background, 'rgba(0, 0, 0, 0)', r.selector);
      assert.equal(r.border, '0px', r.selector);
      assert.equal(r.shadow, 'none', r.selector);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, r.selector + ' must fit');
    }
    assert.ok(result[0].y + result[0].height < result[1].y, 'resource stack must not overlap navigation');
    assert.ok(result[3].x > width * .65, 'quest stays away from center');
    assert.equal(await page.evaluate(() => document.elementFromPoint(innerWidth * .5, innerHeight * .4)?.tagName), 'CANVAS');
    return result;
  };
  const openAndClose = async (name, panel) => {
    await page.getByRole('button', { name, exact: typeof name === 'string' }).click();
    await page.waitForFunction(panel => document.querySelector('.session-ui').dataset.panel === panel, panel);
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: /关闭/ }).first().click();
    await page.waitForFunction(() => document.querySelector('.session-ui').dataset.panel === 'none');
  };
  try {
    await page.goto(url + '?debug=1&submission=fenced&framesInFlight=1&saveTest=hud-' + Date.now(), { waitUntil: 'domcontentloaded' });
    await ready();
    report.layout1440 = await layout(); await shot('01-hud-1440');
    check('Resource, navigation, equipment and quest groups have no backing, border or shadow; world center accepts pointer input');
    assert.equal(await page.locator('.hud-navigation button').count(), 6);
    for (const b of await page.locator('.hud-navigation button, .hud-help, .hud-exit').all()) {
      const r = await b.boundingBox(); assert.ok(r.width >= 44 && r.height >= 44);
    }
    await page.setViewportSize({ width: 1280, height: 720 }); report.layout1280 = await layout(); await shot('02-hud-1280');
    check('Both 1440x900 and 1280x720 desktop layouts fit, with six distinct navigation controls and >=44px hit areas');
    await page.setViewportSize({ width: 1440, height: 900 });
    const economy = (await snap()).economy;
    await openAndClose('升级', 'upgrade');
    await openAndClose('打开我的宠物', 'pets');
    await openAndClose('世界', 'worlds');
    await openAndClose('矿物背包', 'minerals');
    await openAndClose(/^奖励/, 'rewards');
    await openAndClose('传送', 'travel');
    await openAndClose('操作帮助', 'help');
    assert.equal((await snap()).economy.coins, economy.coins);
    assert.equal((await snap()).economy.minedVolume, economy.minedVolume);
    check('All six game entries and help open and close their original panels without changing currency or progress');
    await page.locator('.hud-settings > summary').click();
    await page.getByRole('button', { name: '关闭烘焙阴影', exact: true }).click();
    await page.waitForFunction(() => !window.__miningValidation.snapshot().facilities.surfaceDetails.shadowEnabled);
    await page.getByRole('button', { name: '开启烘焙阴影', exact: true }).click();
    await page.waitForFunction(() => window.__miningValidation.snapshot().facilities.surfaceDetails.shadowEnabled);
    await page.locator('.hud-settings > summary').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hud-settings').evaluate(el => el.open), false);
    check('Compact settings retain the working shadow toggle and close with Escape');
    await page.mouse.move(720, 360); const yaw = (await snap()).view.yaw;
    await page.mouse.down({ button: 'right' }); await page.mouse.move(780, 390, { steps: 4 }); await page.mouse.up({ button: 'right' });
    await page.waitForFunction(yaw => Math.abs(window.__miningValidation.snapshot().view.yaw - yaw) > .01, yaw);
    check('Transparent center still receives a real right-mouse camera drag');
    await page.evaluate(() => window.__miningValidation.look(0, .22));
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('.journey-goals'));
    assert.equal(await page.locator('.journey-goals').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.evaluate(() => window.__miningValidation.teleport([26.2, .5, 20])); await ready();
    await page.locator('.egg-world-prompt').waitFor({ state: 'visible' }); await page.keyboard.press('e');
    await page.getByRole('dialog').waitFor(); assert.equal(await page.locator('.egg-probability').count(), 5);
    await shot('04-egg-probabilities');
    await page.getByRole('dialog').getByRole('button', { name: /关闭/ }).first().click();
    assert.equal((await snap()).eggLabels.labelCount, 16);
    check('Skipping the guide preserves a transparent depth goal; nearby E still opens all pet probabilities and sixteen world labels remain');
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 4])); await ready();
    const cell = await page.evaluate(() => { for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (window.__miningValidation.canMine([x, -1, z])) return [x, -1, z]; });
    assert.ok(cell);
    for (let i = 0; i < 30 && await page.evaluate(c => window.__miningValidation.cell(c) !== 0, cell); i++) {
      await page.evaluate(c => window.__miningValidation.hit(c), cell); await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.inventory.totalCount > 0);
    assert.ok(await page.locator('.inventory-ore-slots > li').count() > 0);
    const collected = (await snap()).economy.inventory;
    assert.ok((await page.getByTestId('bag-count').innerText()).includes(String(collected.used)));
    assert.ok((await page.getByTestId('sale-quote').innerText()).includes('预计'));
    await page.getByRole('button', { name: '返回地表', exact: true }).click(); await ready();
    assert.ok((await snap()).position[2] > 40);
    await shot('05-collected-ore');
    check('Real mining settlement updates capacity, ore icons and sale estimate; the moved Return button uses the original surface travel');
    assert.deepEqual(report.errors, []);
    // Normal player entry, without debug instrumentation or debug controls.
    await page.goto(url + '?saveTest=hud-normal-' + Date.now(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.hud-navigation') && !document.querySelector('.loading-screen'), null, { timeout: 240000 });
    assert.equal(await page.locator('.hud-debug-tools, .performance-hud, .validation-panel').count(), 0);
    for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { document.querySelector('canvas').getContext('webgl2').finish(); resolve(); })));
    await page.screenshot({ path: path.join(dir, '06-normal-player.png'), timeout: 60000 }); report.screenshots.push('06-normal-player');
    check('Default public player entry contains no FPS, input or validation panels');
    assert.deepEqual(report.errors, []);
  } catch (e) {
    report.failure = String(e); report.snapshot = await snap().catch(() => null);
    await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 30000 }).catch(() => {}); throw e;
  } finally {
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
