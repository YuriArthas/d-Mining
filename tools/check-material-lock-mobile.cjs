const localTools = require('./local-tools.cjs');
// Public phone-landscape check (2026-10-31): the player locks and unlocks ore by hand. The material store took every
// ticket mineral as it was dug, so early on they could not be sold; then only ticket minerals could be locked, and the
// user asked for every kind, rock too. In the bag's 矿物 page every ore cell is a lock toggle, and so is each mineral
// of the next world's ticket in the store. A save with amethyst, copper and rock in the bag: none locked at first;
// amethyst locked from the store moves into it, copper locked from its cell stays in the bag, and the sale sells only
// the rock; with only locked ore left the HUD has no 出售; unlocked, both sell. Every action by touch.
// node tools/check-material-lock-mobile.cjs
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/material-lock');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const AMETHYST = 'journey.amethyst';
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
  const economy = () => page.evaluate(() => window.__miningValidation.snapshot().economy);
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name, label) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push({ name, label }); console.log('SHOT', name, label); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(500); return r; };
  const row = () => page.locator('.bag-ticket-item', { hasText: '紫水晶' });
  const openBag = async () => { await tap(page.getByRole('button', { name: '查看背包里的矿物' })); await page.locator('.bag-ticket').waitFor(); };
  const closeBag = async () => { await tap(page.getByRole('button', { name: '关闭' }).first()); await page.locator('.bag-ticket').waitFor({ state: 'detached' }); };
  const sell = async () => {
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 46])); await page.waitForTimeout(2500);
    const before = (await economy()).coins;
    await tap(page.getByRole('button', { name: '传送到售卖圈出售' }));
    await page.waitForFunction(before => window.__miningValidation.snapshot().economy.coins > before, before, { timeout: 60000, polling: 200 });
    return (await economy()).coins - before;
  };
  try {
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=material-lock-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    const again = url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`);
    // A bag with amethyst (the world 2 ticket asks for 20) and copper.
    await page.evaluate(() => window.__miningSave.flush());
    await page.goto(localTools.publicRoot(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ([name, ore]) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; v.data.inventory.items = { [ore]: 5, 'journey.copper': 8, 'journey.rock.0': 6 }; s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, [namespace, AMETHYST]);
    await page.goto(again, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .3); });
    await page.waitForTimeout(2000);
    const price = await page.evaluate(ore => window.__miningValidation.snapshot().economy.sale.payouts.find(p=>p.currency==='gold')?.coins, AMETHYST);

    // 1. Nothing locked at first: the three store toggles and every ore cell open.
    await openBag();
    const rows = page.locator('.bag-ticket-item'), cells = page.locator('.bag-ores .ui-cell');
    const copper = cells.filter({ hasText: '铜' });
    assert.equal(await rows.count(), 3, 'the three minerals of the world 2 ticket');
    assert.equal(await cells.count(), 3, 'amethyst, copper and rock in the grid');
    assert.deepEqual([...await rows.evaluateAll(r => r.map(b => b.getAttribute('aria-pressed'))), ...await cells.evaluateAll(r => r.map(b => b.getAttribute('aria-pressed')))], Array(6).fill('false'));
    const box = await row().boundingBox(), cell = await copper.boundingBox();
    assert.ok(box.height >= 36 && cell.height >= 70, `thumb-sized toggles (row ${box.height}px, cell ${cell.height}px)`);
    await shot('01-none-locked', 'the bag: amethyst, copper and rock in the grid, every lock open');
    await check(`Nothing is locked at first: the store's three ticket minerals (${Math.round(box.width)}×${Math.round(box.height)} px) and every ore cell (${Math.round(cell.width)}×${Math.round(cell.height)} px) show an open lock.`);

    // 2. Amethyst locked from the store moves into it; copper locked from its cell stays in the bag; the sale sells rock.
    await tap(row());
    await tap(copper);
    assert.equal(await row().getAttribute('aria-pressed'), 'true');
    assert.equal(await copper.getAttribute('aria-pressed'), 'true');
    let e = await economy();
    assert.equal(e.inventory.items[AMETHYST], undefined, 'amethyst out of the bag');
    assert.deepEqual(e.materials.find(m => m.itemId === AMETHYST), { itemId: AMETHYST, name: '紫水晶', stored: 5, needed: 20, locked: true });
    assert.deepEqual([...e.inventory.locked].sort(), [AMETHYST, 'journey.copper'].sort());
    assert.match(await page.locator('.bag-sell-value').innerText(), /6\b/, 'only the rock is for sale');
    await shot('02-locked', 'amethyst locked into the store (5/20), copper locked in the bag (gold lock), 可卖 counts only the rock');
    await closeBag();
    const rockOnly = await sell();
    e = await economy();
    assert.deepEqual(e.inventory.items, { 'journey.copper': 8 }, 'the locked copper stays in the bag');
    assert.equal(e.materials.find(m => m.itemId === AMETHYST).stored, 5, 'the store kept its amethyst');
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 46])); await page.waitForTimeout(2500);
    assert.equal(await page.getByRole('button', { name: '传送到售卖圈出售' }).count(), 0, 'only locked ore left: no 出售 on the HUD');
    await check(`Amethyst locked from the store moves into it (5/20); copper locked from its cell stays in the bag; the sale sells only the rock (${rockOnly}). With only locked ore left the HUD shows no 出售.`);

    // 3. Unlocking puts amethyst back in the bag and frees the copper; the next sale sells both.
    await openBag();
    await tap(row());
    await tap(page.locator('.bag-ores .ui-cell').filter({ hasText: '铜' }));
    e = await economy();
    assert.deepEqual(e.inventory.locked, []);
    assert.deepEqual(e.inventory.items, { [AMETHYST]: 5, 'journey.copper': 8 });
    await shot('03-unlocked', 'both unlocked: amethyst back in the grid, the store 0/20, every lock open');
    await closeBag();
    const both = await sell();
    assert.equal(both, price - rockOnly, 'amethyst and copper sold for their price');
    await check(`Unlocking puts the 5 amethyst back in the bag and frees the copper; the next sale sells both (${both}).`);

    // 4. After a reload, a lock stays (one on a kind the bag does not hold: the store's amethyst row).
    await page.waitForTimeout(2000);
    await openBag(); await tap(row()); await closeBag();
    await page.evaluate(() => window.__miningSave.flush());
    await page.goto(again, { waitUntil: 'domcontentloaded' }); await ready();
    assert.equal((await economy()).materials.find(m => m.itemId === AMETHYST).locked, true);
    await check('A lock is saved: amethyst locked before a reload is still locked after it.');
    assert.deepEqual(report.errors, []);
    report.finishedAt = new Date().toISOString(); await save();
    console.log('PASS Ore of every kind locks and unlocks by hand.');
  } catch (error) {
    report.failure = String(error?.stack || error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
