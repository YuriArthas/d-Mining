const localTools = require('./local-tools.cjs');
// Public phone-landscape check for UI v2 U6 (docs/draft-ui-v2.md): the shop, at the counter the shop button goes to
// (each world's surface and its halls of layers 2 and 4 have their own shelves). Over the cart the name with its level,
// world and how deep a pickaxe digs; under it the numbers with the gain (damage ×1.5); one button with verb and price:
// 购买, 强化 +N, 装备, 已装备; a price the player cannot pay greyed (never a missing amount); the backpack counter.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u6');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=shop-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async name => { await page.waitForTimeout(1800); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.first().boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(500); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  const noShortfall = async where => assert.doesNotMatch(await page.locator('.shop-showroom').innerText(), /还差|不足|不够/, `${where}: no missing-amount wording`);
  const seed = async mutate => {
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    await page.goto(localTools.publicRoot(), { waitUntil: 'commit', timeout: 120000 });
    await page.evaluate(async ({ name, mutate }) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; new Function('d', mutate)(v.data); s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, { name: namespace, mutate });
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); });
    await settle();
  };
  const openShop = async () => {
    await tap(button('商店'));
    await page.locator('.shop-showroom').waitFor();
    await page.waitForFunction(() => !document.querySelector('.shop-loading'), null, { timeout: 120000 });
  };
  const step = async (dirName, n = 1) => { for (let i = 0; i < n; i++) await tap(button(dirName === 'next' ? '下一件商品' : '上一件商品')); await page.waitForTimeout(1200); };
  const head = () => page.locator('.shop-head').innerText().then(t => t.replace(/\s+/g, ' '));
  const buy = () => page.locator('.shop-buy');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    // World 1's surface forge (layer 2 not reached): its shelf L1-L3.
    await seed(`d.wallet.balances = { gold: 4800, tech: 0, star: 0 }; d.onboarding.status = 'skipped';
      d.pickaxe.level = 3; d.equipment.toolLevel = 3; d.equipment.enhance = 0;`);
    await openShop();
    // The worn newest pickaxe: its button enhances it, the damage card says what +1 brings.
    let h = await head();
    assert.match(h, /Lv\.3/); assert.match(h, /第一世界/); assert.match(h, /能挖到/);
    assert.match(await page.getByTestId('shop-enhance').innerText(), /强化 \+1\s*\d+/);
    assert.match(await page.locator('.shop-gain').first().innerText(), /强化后 \d+/);
    await noShortfall('Enhance');
    await shot('01-enhance');
    await check(`Worn newest pickaxe: ${h}; button 强化 +1 · price; the damage card shows 强化后.`);

    assert.ok(await button('下一件商品').isDisabled(), 'the surface shelf ends at L3');
    await step('prev');
    assert.match(await page.getByTestId('shop-buy').innerText(), /装备/);
    assert.equal(await page.locator('.shop-gain').count(), 0, 'an older pickaxe shows no gain');
    await shot('04-owned');
    await check('The surface shelf ends at L3; an older pickaxe already bought: 装备, no gain tags.');
    await tap(button('关闭商店'));

    // Layer 2 reached: the shop button goes to its hall; its shelf L4-L6 after the worn newest L3.
    await seed(`d.wallet.balances = { gold: 4800, tech: 0, star: 0 }; d.pickaxe.level = 3; d.equipment.toolLevel = 3; d.equipment.enhance = 0;
      d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };`);
    await openShop();
    assert.match(await head(), /Lv\.3/);
    await step('next');
    h = await head();
    assert.match(h, /Lv\.4/);
    assert.match(await page.getByTestId('shop-buy').innerText(), /购买\s*[\d,]+/);
    assert.match(await page.locator('.shop-gain').first().innerText(), /^×\d/);
    assert.ok(!(await buy().isDisabled()));
    await shot('02-buy');
    await check(`Layer 2's hall, next pickaxe: ${h}; 购买 · price in green; damage gain shown as ${await page.locator('.shop-gain').first().innerText()}.`);

    await step('next');
    assert.ok(await buy().isDisabled());
    assert.match(await page.getByTestId('shop-buy').innerText(), /购买\s*[\d,.万]+/);
    assert.match(await page.locator('.shop-hint').innerText(), /先买上一件/);
    await shot('03-locked');
    await check('A pickaxe further up: the same 购买 · price, greyed, with 先买上一件 under it.');

    await tap(button('切换到背包商店'));
    await page.waitForFunction(() => document.querySelector('.shop-showroom')?.dataset.category === 'backpacks');
    await page.waitForTimeout(1500);
    await step('next');
    assert.match(await page.locator('.shop-stat').first().innerText(), /容量/);
    assert.match(await page.locator('.shop-gain').first().innerText(), /^\+\d+/);
    await shot('06-backpack');
    await check(`Backpack counter: capacity card with gain ${await page.locator('.shop-gain').first().innerText()}; the same buy button.`);
    await tap(button('关闭商店'));

    // World 2's surface shop: its shelf in tech coins.
    await seed(`d.wallet.balances = { gold: 0, tech: 500, star: 0 }; d.pickaxe.level = 10; d.equipment.toolLevel = 10; d.equipment.enhance = 0;
      d.worldProgress = { version: 2, openWorlds: [1, 2] };`);
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 270])); await settle();
    await page.waitForFunction(() => /科技币/.test(document.querySelector('[data-testid=coins]')?.getAttribute('aria-label') ?? ''), null, { timeout: 120000 });
    await openShop();
    h = await head();
    assert.match(h, /第二世界/); assert.match(h, /Lv\.11/);
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /科技币/);
    await shot('05-world2');
    await check(`World 2's surface shop: ${h}; priced in 科技币.`);
    await tap(button('关闭商店'));

    // Short of gold (layer 2's hall): the next pickaxe's button is grey with its price; no missing amount anywhere.
    await seed(`d.wallet.balances = { gold: 100, tech: 0, star: 0 }; d.pickaxe.level = 3; d.equipment.toolLevel = 3; d.equipment.enhance = 3;
      d.worldProgress = { version: 2, openWorlds: [1] };
      d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };`);
    await openShop();
    assert.match(await page.locator('.shop-hint').innerText(), /已经强化满了/);
    assert.match(await page.getByTestId('shop-buy').innerText(), /已装备/);
    await shot('07-max');
    await step('next');
    assert.ok(await buy().isDisabled());
    assert.match(await page.getByTestId('shop-buy').innerText(), /购买\s*[\d,]+/);
    await noShortfall('Short of gold');
    await shot('08-short');
    await check('Fully enhanced: ✓ 已装备 and 已经强化满了. Short of gold: 购买 · price greyed, no 还差/不足.');

    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
