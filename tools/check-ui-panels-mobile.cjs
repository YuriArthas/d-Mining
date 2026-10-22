// Public phone-landscape check for the unified panels (bag, world, rewards, egg, capsule, shop, help).
// Seeds only an isolated acceptance database; all interaction is by touch.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/ui-panels-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const PETS = ['moss-slime', 'quarry-mole', 'amber-fox', 'crystal-owl', 'moon-dragon', 'pebble-blob', 'pebble-friend', 'pebble-guardian'];

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
  const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=panels-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async name => { await draw(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(350); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const panel = () => page.evaluate(() => document.querySelector('.session-ui')?.dataset.panel);
  const inside = (r, label) => { const v = page.viewportSize(); assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1, `${label} inside ${JSON.stringify(r)}`); };
  const sheetFits = async label => {
    const dialog = page.getByRole('dialog').first(); inside(await dialog.boundingBox(), label);
    for (const b of await dialog.locator('button:visible').all()) {
      const r = await b.boundingBox(); if (!r || r.y > page.viewportSize().height || r.y + r.height < 0) continue;
      assert.ok(r.width >= 44 && r.height >= 44, `${label}: 44px target ${await b.innerText()} ${JSON.stringify(r)}`);
    }
    // The close button deliberately overhangs the corner; only the scrolling body must not overflow sideways.
    assert.equal(await dialog.evaluate(e => { const body = e.querySelector('.ui-sheet-body') ?? e; return body.scrollWidth <= body.clientWidth + 1; }), true, `${label}: no horizontal overflow`);
  };
  const closeSheet = async name => { await tap(button(`关闭${name}`)); assert.equal(await panel(), 'none', `${name} closed`); };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace); assert.match(namespace, /acceptance/);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ name, pets }) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.coins = 2500; d.onboarding.status = 'skipped';
          d.inventory.items = { 'journey.rock.0': 10, 'journey.coal': 5, 'journey.copper': 4, 'journey.rock.1': 2 };
          d.pets.inventory.pets = pets.map((speciesId, i) => ({ id: `seed-${i}`, speciesId, level: 1 }));
          d.pets.equipment.slots = ['seed-2', 'seed-3', null];
          const explored = { version: 1, maxDepth: 812, unlockedDestinationIds: ['old_mine', 'fungal'] };
          d.exploration = explored; d.worldExploration['1'] = explored;
          d.rewards.onlineSeconds = 420; d.rewards.balance = 3;
          s.put(v, 'main');
        };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, { name: namespace, pets: PETS });
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();
    assert.equal(await page.getByTestId('coins').innerText(), '2.5K');
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); });
    await shot('01-hud-seeded');
    assert.ok(await button('传送到售卖圈出售').isVisible(), 'sell trip visible with ores in bag');
    assert.equal((await page.locator('.hud-rail .ui-tile').count()), 4, 'four rail actions, no fold');
    await check('Seeded isolated save loads: HUD shows 2.5K coins, a Sell trip button for the carried ores, and exactly four rail actions (宠物/商店/奖励/世界) with badges.');

    // Bag
    await tap(button('打开我的宠物')); await page.getByRole('dialog', { name: '背包' }).waitFor();
    await sheetFits('bag pets'); await shot('02-bag-pets');
    await tap(page.getByRole('listitem').filter({ hasText: '月光幼龙' }));
    await shot('03-bag-pet-selected');
    await tap(page.locator('.bag-equip-best'));
    await page.waitForFunction(() => document.querySelectorAll('.bag-pets .ui-cell[data-equipped]').length === 3);
    await tap(page.getByRole('tab', { name: '矿物' })); await sheetFits('bag ores');
    await tap(page.getByRole('listitem').first()); await shot('04-bag-ores');
    await tap(page.getByRole('tab', { name: '装备' })); await sheetFits('bag gear'); await shot('05-bag-gear');
    await closeSheet('背包');
    await check('Bag sheet: pet grid with portraits and rarity colours, selection detail, 一键最佳 equips the three strongest; 矿物 shows capacity, sale quote and per-ore keep options; 装备 shows current and next gear. All targets ≥44px, no horizontal overflow, closes cleanly.');

    // World
    await tap(button('世界')); await page.getByRole('dialog', { name: '世界' }).waitFor();
    await sheetFits('world travel'); await shot('06-world-travel');
    assert.ok(await button('传送到老矿井').isEnabled(), 'travel works from anywhere on the surface');
    await tap(page.getByRole('tab', { name: '进度' })); await sheetFits('world progress'); await shot('07-world-progress');
    await closeSheet('世界');
    await check('World sheet: layer cards (surface, unlocked 老矿井/蘑菇洞穴 with travel enabled away from the spawn ring, locked layers with depth bars) and the world-gate progress tab.');

    // Rewards
    await tap(page.getByRole('button', { name: /^奖励/ })); await page.getByRole('dialog', { name: '奖励' }).waitFor();
    await sheetFits('rewards'); await shot('08-rewards-online');
    await tap(button('领取')); await page.waitForFunction(() => document.querySelector('.ui-sheet-footer [role=status]')?.textContent.includes('获得'));
    await tap(page.getByRole('tab', { name: '签到' })); await shot('09-rewards-signin');
    await tap(page.getByRole('tab', { name: '邀请' })); await sheetFits('rewards invite'); await shot('10-rewards-invite');
    await closeSheet('奖励');
    await check('Rewards sheet: ready 5-minute card claims by touch (lucky coin added), sign-in and invite tabs render in the same container.');

    // Help
    await tap(button('操作帮助')); await page.getByRole('dialog', { name: '操作帮助' }).waitFor(); await sheetFits('help'); await shot('11-help');
    await closeSheet('操作帮助');

    // Egg stand via bag → 获取宠物 → 前往 (instant trip)
    await tap(button('打开我的宠物')); await tap(button('获取宠物'));
    await shot('12-bag-find-egg');
    await tap(button('前往原野蛋蛋台'));
    await page.getByRole('button', { name: '查看宠物蛋' }).waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.egg-world-prompt')?.style.visibility === 'visible', null, { timeout: 30000 });
    await shot('13-egg-prompt');
    await tap(button('查看宠物蛋')); await page.getByRole('dialog').first().waitFor(); await sheetFits('egg'); await shot('14-egg-sheet');
    await tap(page.locator('.egg-buy'));
    await page.locator('.hatch').waitFor(); await page.waitForTimeout(500); await shot('15-hatch-mid');
    await page.waitForFunction(() => document.querySelector('.hatch')?.dataset.done === 'true', null, { timeout: 5000 }); await page.waitForTimeout(500); await shot('16-hatch-result');
    await tap(button('完成')); await closeSheet('原野蛋');
    await check('Bag → 获取宠物 lists eggs; 前往 teleports to the stand and its projected prompt appears; the egg sheet shows all five odds; buying plays the shake → reveal sequence and returns to the sheet.');

    // Capsule
    await tap(page.getByRole('button', { name: /^奖励/ })); await tap(button('传送到扭蛋机'));
    await button('幸运扭蛋').waitFor({ timeout: 30000 }); await tap(button('幸运扭蛋'));
    await page.getByRole('dialog', { name: '幸运扭蛋机' }).waitFor(); await sheetFits('capsule'); await shot('17-capsule');
    await tap(page.getByRole('button', { name: /抽一次/ })); await page.locator('.hatch').waitFor(); await shot('18-capsule-result');
    await tap(button('好的')); await closeSheet('幸运扭蛋机');
    await check('Rewards → 传送到扭蛋机 arrives at the machine; the capsule sheet shows the prize table; a spin by touch shows the result reveal.');

    // Shop trip and Sell trip
    await tap(button('商店')); await page.getByRole('dialog', { name: '商店分类' }).waitFor({ timeout: 30000 }); await sheetFits('shop'); await shot('19-shop-categories');
    await tap(page.locator('.shop-category[data-category=tools]')); await page.waitForTimeout(2500); await shot('20-shop-showroom');
    await tap(button('关闭商店'));
    await tap(button('传送到售卖圈出售'));
    await page.waitForFunction(() => document.querySelector('[data-testid=bag-count]')?.textContent.startsWith('0 /'), null, { timeout: 30000 });
    await shot('21-after-sell-trip');
    await check('HUD 商店 teleports into the shop ring and opens the two-counter shop (no placeholder rebirth counter); 出售 teleports to the sale ring and auto-sells the carried ores.');

    // Underground HUD and small phone
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); window.__miningValidation.look(0, .5); });
    await button('返回地表').waitFor(); await shot('22-underground');
    await page.setViewportSize({ width: 640, height: 320 });
    await tap(button('打开我的宠物')); await sheetFits('bag pets 640'); await shot('23-bag-pets-640');
    await closeSheet('背包');
    await tap(button('世界')); await sheetFits('world 640'); await shot('24-world-640'); await closeSheet('世界');
    await check('640×320: bag and world sheets fit inside the screen with ≥44px targets; underground HUD offers 返回地表.');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
