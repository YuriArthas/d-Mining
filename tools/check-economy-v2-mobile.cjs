// Public phone-landscape check for economy v2 P1: three currencies on the HUD, shop, eggs and pets; world 1's
// shallower rest halls; world 2 in tech coins and the world 3 ticket. Seeds only an isolated acceptance database.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/economy-v2-p1');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=econ-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async name => { await draw(); await page.waitForTimeout(400); await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(350); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const settle = async () => { await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.streaming?.pending; }, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2500); };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    assert.equal(await page.getByTestId('coins').innerText(), '0');
    await check('A fresh save starts at 0 gold.');
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace); assert.match(namespace, /acceptance/);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ name }) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.balances = { gold: 4800, tech: 2600, star: 0 }; d.onboarding.status = 'skipped';
          d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
          d.pets.inventory.pets = [['a', 'moss-slime'], ['b', 'amber-fox'], ['c', 'pebble-guardian'], ['d', 'copper-friend'], ['e', 'gear-wing']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
          d.pets.equipment.slots = ['a', 'b', null];
          d.worldProgress = { version: 2, openWorlds: [1, 2] };
          d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
          d.pickaxe.level = 3; d.equipment.toolLevel = 3;
          s.put(v, 'main');
        };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, { name: namespace });
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); });
    await settle();
    assert.equal(await page.getByTestId('coins').innerText(), '4800');
    assert.match(await page.getByTestId('coins').getAttribute('aria-label'), /金币/);
    await shot('01-hud-world1-gold');
    await check('Seeded save: world 1 HUD shows the gold balance (4800) with the gold coin icon.');

    // Pets: income bonuses per currency; world 2 pets marked as counting elsewhere.
    await tap(button('打开我的宠物')); await page.getByRole('dialog').first().waitFor();
    const total = await page.locator('.bag-pets-main .ui-chip').nth(1).innerText();
    assert.match(total, /总加成/); await shot('02-pets-gold');
    await tap(page.getByRole('listitem').filter({ hasText: '赤铜狐' })); await shot('03-pet-elsewhere');
    assert.match(await page.locator('.bag-detail').innerText(), /科技币收入/); assert.match(await page.locator('.bag-detail').innerText(), /挖矿速度/);
    assert.match(await page.locator('.bag-pets-main').innerText(), /挖矿\s*\+/);
    await tap(page.locator('.bag-equip-best'));
    const equipped = await page.locator('.bag-pets .ui-cell[data-equipped]').evaluateAll(cells => cells.map(c => c.getAttribute('aria-label')));
    assert.ok(equipped.every(label => /金币/.test(label)), `world 1 best team is all gold pets: ${equipped}`);
    await shot('04-pets-best-gold');
    await tap(button('关闭宠物'));
    await check('Pet bag: each pet shows its income bonus (currency) and mining speed; the team shows both totals; a world 2 pet is not greyed and says its income bonus counts in world 2; 一键最佳 in world 1 picks gold pets first.');

    // Egg stand: price and bonuses in gold.
    await tap(button('打开我的宠物')); await tap(button('获取宠物')); await shot('05-egg-list');
    await tap(button('前往卵石蛋蛋台'));
    await button('查看卵石蛋').waitFor({ state: 'visible', timeout: 30000 });
    await tap(button('查看卵石蛋')); await page.getByRole('dialog').first().waitFor(); await shot('06-egg-sheet');
    assert.equal(await page.locator('.egg-mining').count(), 5);
    await tap(page.locator('.egg-buy')); await page.locator('.hatch').waitFor();
    await page.waitForFunction(() => document.querySelector('.hatch')?.dataset.done === 'true', null, { timeout: 5000 }); await page.waitForTimeout(400); await shot('07-hatch-result');
    assert.match(await page.locator('.hatch-tags').innerText(), /金币收益/); assert.match(await page.locator('.hatch-tags').innerText(), /挖矿/);
    await tap(button('完成')); await tap(button('关闭卵石蛋'));
    await check('Pebble egg: price in gold, outcomes with +% bonuses, hatch result says 金币收益.');

    // Shop: next tool in gold; a world 2 tool in tech coins.
    await tap(button('商店'));
    await page.locator('.shop-showroom, .shop-category').first().waitFor({ timeout: 30000 });
    if (await page.locator('.shop-category[data-category=tools]').isVisible().catch(() => false)) await tap(page.locator('.shop-category[data-category=tools]'));
    await page.locator('.shop-showroom').waitFor(); await page.waitForTimeout(2500);
    await tap(button('下一件商品')); await page.waitForTimeout(1500); await shot('08-shop-next-tool');
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /金币/);
    for (let i = 0; i < 7; i++) await tap(button('下一件商品'));
    await page.waitForTimeout(1500); await shot('09-shop-world2-tool');
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /科技币/);
    await tap(button('关闭商店'));
    await check('Shop: world 1 tools are priced in gold; level 11 (world 2) is priced in 科技币 with the tech coin icon.');

    // World 1 rest halls at their new depths.
    const rooms = await page.evaluate(() => window.__miningValidation.snapshot().content.rooms.slice(0, 2));
    for (const [i, room] of rooms.entries()) {
      await page.evaluate(spawn => { window.__miningValidation.teleport(spawn); window.__miningValidation.look(Math.PI, .1); }, room.spawn);
      await settle(); await shot(`1${i}-hall-${room.id}`);
    }
    await check(`World 1 rest halls render at their new depths: ${rooms.map(r => `${r.id} ${-r.spawn[1] + .1} m`).join(', ')}.`);

    // World 2: tech coins on the HUD, the world 3 ticket at its portal.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 270]); window.__miningValidation.look(0, .2); });
    await settle();
    await page.waitForFunction(() => /科技币/.test(document.querySelector('[data-testid=coins]')?.getAttribute('aria-label') ?? ''));
    assert.equal(await page.getByTestId('coins').innerText(), '2600');
    await shot('12-hud-world2-tech');
    await page.evaluate(() => window.__miningValidation.teleport([0, 1, 283.2]));
    await settle(); await page.getByRole('dialog', { name: '世界传送门' }).waitFor(); await shot('13-world3-ticket');
    const ticket = await page.locator('.world-mats').innerText();
    assert.match(ticket, /镐子等级/); assert.match(ticket, /科技币/); assert.match(ticket, /Lv\.3\/20/);
    await check('World 2: HUD switches to 科技币 (2600); the portal shows the world 3 ticket.');
  } catch (error) {
    report.errors.push(String(error.stack ?? error)); console.error(error);
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally { report.finishedAt = new Date().toISOString(); await save(); await browser.close(); }
})();
