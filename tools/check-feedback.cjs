// Public desktop acceptance. Controlled save fixtures and debug mining/travel
// exercise real UI/runtime paths; this is not a timed natural progression run.
// Full run: FEEDBACK_HEADFUL=1 xvfb-run -a node tools/check-feedback.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { SparseWorld } = require('../src/game/terrain/SparseWorld.ts');
const { ORE_ITEMS } = require('../src/game/application/items.ts');

(async () => {
  const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html';
  const id = 'feedback-' + Date.now(), only = process.env.FEEDBACK_ONLY;
  const dir = path.resolve(__dirname, '../artifacts/mining-feedback');
  await fs.mkdir(dir, { recursive: true });
  const headful = process.env.FEEDBACK_HEADFUL === '1';
  if ((!only || only === 'rewards' || only === 'auto') && !headful) throw Error('Reward focus acceptance requires real tabs: run FEEDBACK_HEADFUL=1 xvfb-run -a node tools/check-feedback.cjs');
  const report = { url: base, startedAt: new Date().toISOString(), mode: `desktop ${headful ? 'headed' : 'headless'} Chromium / SwiftShader; isolated constructed fixtures`, checks: [], errors: [], networkFailures: [] };
  const browser = await chromium.launch({ headless: !headful, args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  // Install before game timers exist. The environment module briefly pauses
  // this clock to capture transition frames on the software GPU.
  if (!only || only === 'environment') await page.clock.install({ time: new Date() });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('requestfailed', r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') report.networkFailures.push({ url: r.url(), error: r.failure()?.errorText }); });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const ready = async () => {
    await page.waitForFunction(() => { const s = window.__miningValidation?.snapshot(); return document.querySelector('.loading-error:not([hidden])') || s?.ready && !s.travelling && s.grounded && !document.querySelector('.loading-screen'); }, null, { timeout: 180000, polling: 500 });
    if (await page.locator('.loading-error:visible').count()) throw Error('Public loading error: ' + await page.locator('.loading-error').innerText());
  };
  const frames = async () => { const n = (await snap()).renderer.submission.submitted; await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 2, n, { polling: 300 }); };
  const go = async url => {
    console.log('Opening', url); await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.bringToFront();
    await page.evaluate(() => setInterval(() => document.querySelector('canvas')?.getContext('webgl2')?.flush(), 100));
    await ready(); await page.evaluate(() => window.__miningValidation.performance({ submission: 'fenced', framesInFlight: 1 }));
    await page.locator('.game-shell').focus(); console.log('Ready');
  };
  const travel = async location => { await page.evaluate(p => window.__miningValidation.teleport(p), location); await ready(); await frames(); };
  const screenshot = async (name, waitFrames = true) => { if (waitFrames) await frames(); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 60000 }); };
  const check = message => { report.checks.push(message); console.log('PASS', message); };
  const step = async name => page.waitForFunction(name => document.querySelector('.guide-card')?.dataset.step === name, name, { polling: 300 });
  const seed = async (name, edit, regions = []) => {
    const progress = await page.evaluate(() => structuredClone(window.__miningSave.progress())); edit(progress);
    await page.evaluate(async ({ name, progress, regions }) => {
      const store = await window.__miningSave.openTestStore(name);
      const changes = regions.map(r => ({ ...r, removed: r.removed === null ? null : new Uint16Array(r.removed) }));
      await store.commit({ expectedRevision: null, head: { formatVersion: 1, revision: 1, savedAt: Date.now(), regionCount: changes.length, world: { generationVersion: 9, seed: 0, regionEncoding: 1 } }, progress, regions: changes }); store.close();
    }, { name, progress, regions });
  };
  const openSeed = name => go(`${base}?debug=1&submission=fenced&saveTest=store-${name}`);
  const helpers = { page, snap, travel, frames, screenshot, check, seed, go, base, id };
  try {
    await go(`${base}?debug=1&submission=fenced&saveTest=${id}`);
    report.publicAssets = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
    if (!only || only === 'onboarding') {
      await step('mine'); assert.equal((await snap()).economy.coins, 0);
      assert.equal(await page.locator('.inventory-ore-slots > li').count(), 0);
      await screenshot('01-fresh'); check('Fresh save: mine tutorial, empty backpack, equipment levels and reward entry');
      // Observe the actual transient receipt; do not make screenshots race its 2.2s lifetime.
      await page.evaluate(() => { window.__pickupObserved = []; new MutationObserver(() => { for (const e of document.querySelectorAll('.ore-pickup')) window.__pickupObserved.push(e.textContent); }).observe(document.querySelector('.ore-pickup-feed'), { childList: true, subtree: true }); });
      const cells = await page.evaluate(() => { const a = []; for (let y = -5; y > -15; y--) for (let x = -3; x < 4; x++) for (let z = -3; z < 4; z++) if (window.__miningValidation.cell([x, y, z]) === 8) a.push([x, y, z]); return a.slice(0, 3); });
      assert.equal(cells.length, 3);
      for (const cell of cells) { await frames(); const hit = await page.evaluate(c => window.__miningValidation.hit(c), cell); assert.equal(hit.status, 'breaking'); await page.waitForFunction(c => window.__miningValidation.cell(c) === 0, cell, { polling: 300 }); }
      await step('sell'); assert.equal((await snap()).economy.inventory.totalCount, 3);
      assert.equal(await page.locator('.inventory-ore-slots > li').count(), 1);
      assert.ok((await page.evaluate(() => window.__pickupObserved)).some(text => text.includes('泥土')));
      await page.waitForFunction(() => document.querySelectorAll('.ore-pickup').length === 0);
      const sale = (await snap()).sellZone; await travel([sale.x, sale.y, sale.z]); await step('earn');
      assert.equal((await snap()).economy.coins, 3); assert.equal((await snap()).economy.inventory.totalCount, 0);
      check('Three real mining receipts stack one mineral slot, emit fading text, and sell once on entering the circle');
      const world = new SparseWorld(), removed = [];
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = -1; y >= -10; y--) if (world.cell([x, y, z])) removed.push([x, y, z]);
      world.remove(removed);
      await seed(id + '-loop', p => { p.wallet.coins = 10000; }, world.captureChanges().regions.map(r => ({ ...r, removed: r.removed === null ? null : Array.from(r.removed) })));
      await openSeed(id + '-loop'); await step('upgrade');
      await page.getByRole('button', { name: '升级', exact: true }).click(); await page.locator('.upgrade-buy').click();
      assert.equal((await snap()).economy.pickaxe.level, 2); await page.getByRole('button', { name: '关闭升级界面', exact: true }).click(); await step('deepen');
      await travel([1, -19.9, 1]); await step('backpack'); assert.ok((await snap()).economy.maxDepth >= 20);
      await screenshot('02-deep-backpack-goal');
      await page.getByRole('button', { name: '返回地表', exact: true }).click(); await ready();
      await page.getByRole('button', { name: '升级', exact: true }).click(); await page.getByRole('button', { name: '背包', exact: true }).click(); await page.locator('.upgrade-buy').click(); await page.getByRole('button', { name: '关闭升级界面', exact: true }).click();
      await step('long-task'); assert.equal((await snap()).economy.backpackLevel, 2); await screenshot('03-long-task');
      await page.getByRole('button', { name: '继续：认识宠物', exact: true }).click(); await step('egg');
      assert.ok((await snap()).economy.onboarding.minedCount < 100);
      check('Constructed funds/shaft: real axe purchase applies immediately, actual 20m descent leads to backpack purchase, long task does not block pets');
      const egg = (await snap()).eggLabels.labels.find(l => l.eggId === 'meadow-egg'); await travel([egg.x - 2, egg.y, egg.z]);
      await page.waitForFunction(() => document.querySelector('.egg-world-prompt')?.style.visibility === 'visible'); await page.keyboard.press('e'); await page.locator('.egg-buy').waitFor();
      assert.equal(await page.locator('.egg-probability').count(), 5); await screenshot('04-egg-probabilities');
      await page.locator('.egg-buy').click(); assert.equal((await snap()).economy.onboarding.equippedOnce, false);
      await page.getByRole('button', { name: '去装备', exact: true }).click(); await page.getByRole('button', { name: '一键最佳', exact: true }).click();
      assert.equal((await snap()).economy.onboarding.status, 'completed'); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '关闭引导完成提示', exact: true }).click(); await page.locator('.journey-goals').waitFor(); await screenshot('05-next-layer');
      assert.match(await page.locator('.journey-goals').innerText(), /400/);
      await page.getByRole('button', { name: '打开我的宠物', exact: true }).click(); await page.getByRole('button', { name: '获取宠物 · 寻找蛋台', exact: true }).click();
      assert.equal(await page.locator('.pet-egg-destinations > div').count(), 1);
      await page.locator('.pet-egg-destinations button').click(); assert.equal((await snap()).economy.requestedEgg, 'meadow-egg');
      await page.getByRole('button', { name: '取消指引', exact: true }).click(); assert.equal((await snap()).economy.requestedEgg, null);
      await page.evaluate(() => window.__miningSave.flush()); await go(page.url());
      assert.equal((await snap()).economy.onboarding.status, 'completed'); assert.equal(await page.locator('.ore-pickup').count(), 0);
      check('Physical egg UI shows five probabilities; hatch then equip completes tutorial; next-layer goal and cancellable pet route survive correctly');
      await seed(id + '-bag', p => { p.inventory.capacity = 500; p.inventory.items = Object.fromEntries(ORE_ITEMS.slice(0, 12).map((item, i) => [item.itemId, i === 0 ? 7 : 1])); });
      await openSeed(id + '-bag'); assert.equal(await page.locator('.inventory-ore-slots > li').count(), 10);
      assert.equal(Object.keys((await snap()).economy.inventory.items).length, 12);
      assert.equal(await page.getByRole('button', { name: /查看背包|打开完整背包/ }).count(), 0);
      await page.setViewportSize({ width: 1280, height: 800 }); await screenshot('06-ten-slots-1280');
      await page.getByRole('button', { name: '传送', exact: true }).click();
      assert.equal(await page.locator('.travel-list button:not(:disabled)').count(), 0); await screenshot('08-depth-gates'); await page.keyboard.press('Escape');
      await travel([sale.x, sale.y, sale.z]); assert.equal((await snap()).economy.inventory.totalCount, 0); assert.equal(await page.locator('.inventory-ore-slots > li').count(), 0);
      await page.setViewportSize({ width: 1440, height: 900 });
      check('Twelve mineral types remain stored with ten HUD slots and no separate bag entry; all deep destinations locked below threshold; selling clears slots');
    }
    if (!only || ['rewards', 'claims', 'auto'].includes(only)) await require('./check-feedback-rewards.cjs')({ ...helpers, autoOnly: only === 'auto', claimsOnly: only === 'claims' });
    if (!only || only === 'environment') report.environment = await require('./check-feedback-environment.cjs')(helpers);
    if (!only || only === 'normal') {
      await travel([12, 0, 31.8]);
      const standingStep = (await snap()).physicsSteps;
      await page.waitForFunction(n => window.__miningValidation.snapshot().physicsSteps >= n + 30, standingStep, { polling: 300 });
      const standing = await snap();
      assert.equal(standing.grounded, true); assert.equal(standing.verticalSpeed, 0); assert.equal(standing.economy.atMachine, true);
      check('Exact capsule/curb regression position remains genuinely grounded and interactive after 30 more physics steps');
      await page.locator('.scene').focus(); await page.keyboard.press('e');
      await page.locator('.capsule-panel').waitFor();
      assert.equal(await page.locator('.capsule-reward-symbol .equipment-icon').count(), 1);
      await screenshot('capsule-current-icons');
      await page.keyboard.press('Escape');
      check('Capsule mining reward uses the shared SVG pickaxe icon without a font dependency');
      // This browser context is disposable; the ordinary public entry has no
      // access to a human player's browser profile or save.
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => setInterval(() => document.querySelector('canvas')?.getContext('webgl2')?.flush(), 100));
      await page.waitForFunction(() => document.querySelector('.loading-error:not([hidden])') || document.querySelector('.inventory-hud') && !document.querySelector('.loading-screen'), null, { timeout: 180000, polling: 500 });
      assert.equal(await page.locator('.loading-error:visible').count(), 0);
      assert.equal(await page.getByRole('button', { name: /切换到白天|切换到夜晚|恢复自动昼夜/ }).count(), 0);
      assert.equal(await page.evaluate(() => typeof window.__miningValidation), 'undefined');
      await page.screenshot({ path: path.join(dir, 'normal-public-entry.png'), timeout: 60000 });
      report.normalPublicAssets = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
      check('Ordinary public URL loads without debug controls or manual day/night selection');
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.networkFailures, []);
    report.completedAt = new Date().toISOString();
  } catch (error) {
    report.failure = String(error); report.snapshot = await snap().catch(() => null);
    await page.screenshot({ path: path.join(dir, 'failure' + (only ? '-' + only : '') + '.png'), timeout: 30000 }).catch(() => {});
    throw error;
  } finally {
    await fs.writeFile(path.join(dir, 'public-report' + (only ? '-' + only : '') + '.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
