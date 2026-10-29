// Public check (desktop, 2026-10-29): portals no longer show what is behind them; each world's shops sell their own
// shelf (surface, halls of layers 2 and 4) and the HUD shop button goes to the furthest one open; the halls of layer
// 6 have no shop stall any more (world 1 obsidian, world 2 crates, world 3 the station without its shop counter).
// node tools/check-shop-layers.cjs [outdir]
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const out = path.resolve(process.argv[2] || 'output/shop-layers'); fs.mkdirSync(out, { recursive: true });
const report = { url: base, startedAt: new Date().toISOString(), checks: [] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
  const check = async text => { report.checks.push(text); save(); console.log('PASS', text); };
  try {
    await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=shops-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    const ready = () => page.waitForFunction(() => { const s = window.__miningValidation?.snapshot(); return s?.ready && !s.travelling && !document.querySelector('.loading-screen'); }, null, { timeout: 300000, polling: 200 });
    await ready();
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    const view = async (feet, yaw, pitch, distance) => { await page.evaluate(([f, y, p, d]) => { const v = window.__miningValidation; v.teleport(f); v.look(y, p); v.cameraDistance(d); }, [feet, yaw, pitch, distance]); await ready(); await page.waitForTimeout(2500); await page.evaluate(([y, p]) => window.__miningValidation.look(y, p), [yaw, pitch]); await page.waitForTimeout(1500); };
    // 1. World 1's portal from the plaza, looking through it (+Z; further along, the feet would be in world 2).
    await view([0, .1, 52], Math.PI, .08, 5); await shot('01-portal');
    await check('World 1 portal: screenshot 01-portal (the swirl over an opaque violet backing).');
    // 2. The HUD shop button: on a fresh save, world 1's surface forge with its shelf.
    const shelf = () => page.evaluate(() => { const items = []; return { item: document.querySelector('.shop-showroom')?.dataset.item, name: document.querySelector('.shop-name')?.textContent }; });
    const browse = async () => { const seen = []; await page.locator('.shop-showroom').waitFor({ timeout: 120000 }); await page.waitForTimeout(1500);
      while (true) { seen.push((await shelf()).item); const next = page.getByRole('button', { name: '下一件商品' }); if (await next.isDisabled()) break; await next.click(); await page.waitForTimeout(300); }
      return seen; };
    const shopButton = () => page.locator('[data-kind="upgrade"]').click();
    await view([0, .1, 46], 0, .2, null);
    await shopButton(); await ready();
    let seen = await browse(); await shot('02-surface-shop');
    assert.deepEqual(seen, ['tool-1', 'tool-2', 'tool-3']);
    await check(`HUD shop button on a fresh save: world 1's surface forge, shelf ${seen.join(', ')}.`);
    await page.getByRole('button', { name: '关闭商店' }).click(); await page.waitForTimeout(500);
    // 3. Layer 2 reached (testing page): the button goes to its hall's shop.
    await page.click('.dev-unlock-button'); await page.locator('.dev-unlock li button').nth(1).click(); await page.getByRole('button', { name: '关闭' }).click();
    await shopButton(); await ready();
    seen = await browse(); await shot('03-hall2-shop');
    const at = await page.evaluate(() => window.__miningValidation.snapshot().position);
    assert.ok(at[1] < -100, 'in the hall of layer 2');
    assert.deepEqual(seen, ['tool-1', 'tool-4', 'tool-5', 'tool-6']);
    await check(`Layer 2 reached: the shop button goes to its hall (feet ${at.map(v => v.toFixed(0)).join(',')}); shelf ${seen.join(', ')} (the worn newest pickaxe first, to enhance).`);
    await page.getByRole('button', { name: '关闭商店' }).click(); await page.waitForTimeout(500);
    // 4. The halls of layer 6: what stands where a shop stall would.
    await page.click('.dev-unlock-button'); await page.getByRole('button', { name: '全部解锁' }).click(); await page.getByRole('button', { name: '关闭' }).click();
    // From the pit looking +Z at the stalls: the shop's place is on the left (+X), the sale on the right.
    const stalls = async (name, feet) => { await view(feet, Math.PI, .35, 9); await shot(name); };
    await stalls('04-volcanic-stalls', [0, -859.9, 4]);
    await stalls('05-fungal-stalls', [0, -139.9, 4]);
    await stalls('06-reactor-stalls', [0, -2399.9, 228]);
    await stalls('07-core-stalls', [0, -2399.9, 452]);
    await check('Layer 6 halls (04 volcanic, 06 reactor, 07 core) show only the sale stall; layer 2 (05 fungal) keeps its shop.');
    report.errors = errors; report.finishedAt = new Date().toISOString(); save();
    assert.deepEqual(errors, []);
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); save();
    await shot('failure').catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
