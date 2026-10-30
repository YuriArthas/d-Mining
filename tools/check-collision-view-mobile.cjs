// Public phone-landscape check (2026-10-30): with ?debug=1 the unlock page's 显示碰撞 draws the scenery's colliders,
// which now come with the models: the plaza's ore cart, signpost and lamps (which had none), the sale house's porch
// posts, crates, barrel and bench, a hall's props.
// node tools/check-collision-view-mobile.cjs
const localTools = require('./local-tools.cjs');
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/collision-view');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=colliders-${Date.now()}`;
  const view = () => page.evaluate(() => window.__miningValidation.snapshot().facilities.colliderView);
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(3000); };
  const shot = async (name, at, yaw, pitch) => {
    await page.evaluate(([at, yaw, pitch]) => { const d = window.__miningValidation; d.teleport(at); d.look(yaw, pitch); }, [at, yaw, pitch]);
    await settle();
    await page.evaluate(([yaw, pitch]) => window.__miningValidation.look(yaw, pitch), [yaw, pitch]);
    // Two frames drawn at the new place (SwiftShader draws about one a second) before the picture.
    for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(1500);
    const v = await view();
    assert.ok(v.shown && v.lines > 20, `${name}: collider lines drawn (${JSON.stringify(v)})`);
    await page.screenshot({ path: path.join(dir, name), timeout: 180000 });
    return v.lines;
  };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    assert.equal((await view()).shown, false, 'off at the start');
    // The unlock page's button, by touch.
    await page.locator('.dev-unlock-button').tap();
    await page.getByRole('button', { name: '显示碰撞' }).tap();
    await page.waitForTimeout(1000);
    await check('?debug=1 → 解锁 → 显示碰撞 turns the collider view on and closes the page.');
    // The plaza: the ore cart and the crates by the headframe, from the south-east; then the signpost and lamps.
    const plaza = await shot('01-plaza-cart.png', [14, .1, 4], Math.PI * .1, .35);
    // From the plaza toward the bridge (yaw π looks to +Z): the signpost and the two lamps before it.
    const lamps = await shot('02-plaza-signpost-lamps.png', [0, .1, 20], Math.PI, .3);
    // Out in front of the sale house's ring, facing the house (yaw 0 looks to -Z; the house faces -44°).
    const sale = await shot('03-sale-house-porch.png', [10.7, .1, 18], -44 * Math.PI / 180, .3);
    await check(`Plaza (cart, crates), signpost and lamps, the sale house's porch posts, crates, barrel and bench drawn: ${plaza} / ${lamps} / ${sale} lines.`);
    // A hall (world 1's crystal cave: spires crystal by crystal, the geode) and world 2's base.
    await page.evaluate(() => { const d = window.__miningValidation; d.unlockAll?.(); });
    const rooms = await page.evaluate(() => window.__miningValidation.snapshot().content.rooms);
    const crystal = rooms.find(r => r.id === 'crystal');
    const hall = await shot('04-crystal-hall.png', [crystal.spawn[0], crystal.spawn[1], crystal.spawn[2]], Math.PI, .3);
    await check(`Crystal hall props drawn from the spawn: ${hall} lines.`);
    await page.getByRole('button', { name: '解锁' }).tap();
    await page.getByRole('button', { name: '隐藏碰撞' }).tap();
    await page.waitForTimeout(800);
    assert.equal((await view()).shown, false, 'off again');
    await check('隐藏碰撞 turns it off.');
    assert.deepEqual(report.errors, []);
    report.finishedAt = new Date().toISOString(); await save();
  } catch (error) {
    report.failure = String(error?.stack || error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
