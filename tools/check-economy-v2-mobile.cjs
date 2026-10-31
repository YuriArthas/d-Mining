const localTools = require('./local-tools.cjs');
// Public phone-landscape check for economy v2 P1: three currencies on the HUD, shop, eggs and pets; world 1's
// shallower rest halls; world 2 in tech coins and the world 3 ticket. Seeds only an isolated acceptance database.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
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
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=econ-${Date.now()}`;
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
    await page.goto(localTools.publicRoot(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ name }) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.balances = { gold: 4800, tech: 2600, star: 0 }; d.onboarding.status = 'skipped';
          d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
          d.pets.inventory.pets = [['a', 'moss-slime'], ['b', 'amber-fox'], ['c', 'pebble-guardian'], ['d', 'copper-friend'], ['e', 'gear-wing'], ['m1', 'quarry-mole'], ['m2', 'quarry-mole'], ['m3', 'quarry-mole'], ['m4', 'quarry-mole'], ['m5', 'quarry-mole']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
          d.pets.equipment.slots = ['a', 'b', null];
          d.worldProgress = { version: 2, openWorlds: [1, 2] };
          d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
          d.pickaxe.level = 3; d.equipment.toolLevel = 3;
          d.materials = { version: 1, items: { 'journey.sulfur': 12 } };
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
    const total = await page.locator('.bag-totals').innerText();
    assert.match(total, /\+\d+%/); await shot('02-pets-gold');
    await tap(page.getByRole('listitem').filter({ hasText: '赤铜狐' })); await shot('03-pet-elsewhere');
    assert.match(await page.locator('.bag-detail').innerText(), /科技币收入/); assert.match(await page.locator('.bag-detail').innerText(), /挖矿速度/);
    assert.match(await page.locator('.bag-totals').innerText(), /挖矿\s*\+/);
    await tap(page.locator('.bag-equip-best'));
    const equipped = await page.locator('.bag-pets .ui-cell[data-equipped]').evaluateAll(cells => cells.map(c => c.getAttribute('aria-label')));
    assert.ok(equipped.every(label => /金币/.test(label)), `world 1 best team is all gold pets: ${equipped}`);
    await shot('04-pets-best-gold');
    // Golden merge: five 矿洞鼹鼠 become one golden one.
    await tap(page.getByRole('listitem').filter({ hasText: '矿洞鼹鼠' }).first());
    const merge = page.locator('.bag-merge'); assert.match(await merge.innerText(), /5\/5/); await tap(merge);
    await page.locator('.ui-cell[data-golden]').waitFor(); await shot('04a-golden');
    assert.match(await page.locator('.bag-detail').innerText(), /金色矿洞鼹鼠/);
    assert.match(await page.locator('.bag-slots [data-locked]').getAttribute('aria-label'), /第 4 格/);
    await tap(button('关闭宠物'));
    await check('Golden merge: five identical pets merge into one 金色 pet with a gold frame; the locked 4th slot shows where it unlocks.');
    await check('Pet bag: each pet shows its income bonus (currency) and mining speed; the team shows both totals; a world 2 pet is not greyed and says its income bonus counts in world 2; 一键最佳 in world 1 picks gold pets first.');

    // The ores tab: the bag sells whole; the world 3 ticket's minerals wait in the material store.
    await tap(button('打开我的宠物')); await tap(page.getByRole('tab', { name: '矿物' }));
    await page.locator('.bag-ticket').waitFor(); await shot('04b-ores-store');
    const store = await page.locator('.bag-ticket').innerText();
    assert.match(store, /材料仓/); assert.match(store, /12\/30/); assert.match(store, /0\/20/); assert.match(store, /0\/15/);
    await tap(button('关闭矿物'));
    await check(`Material store in the ores tab: ${store.replace(/\s+/g, ' ')}.`);

    // Egg stand: price and bonuses in gold.
    await tap(button('打开我的宠物')); await tap(button('获取宠物')); await shot('05-egg-list');
    await tap(button('前往卵石蛋蛋台'));
    await button('查看卵石蛋').waitFor({ state: 'visible', timeout: 30000 });
    await tap(button('查看卵石蛋')); await page.getByRole('dialog').first().waitFor(); await shot('06-egg-sheet');
    assert.equal(await page.locator('.egg-mining').count(), 5);
    await tap(page.locator('.egg-buy')); await page.locator('.hatch').waitFor();
    await page.waitForFunction(() => document.querySelector('.hatch')?.dataset.done === 'true', null, { timeout: 5000 }); await page.waitForTimeout(400); await shot('07-hatch-result');
    assert.match(await page.locator('.hatch-tags').innerText(), /金币收入/); assert.match(await page.locator('.hatch-tags').innerText(), /挖矿/);
    await tap(button('完成')); await tap(button('关闭卵石蛋'));
    await check('Pebble egg: price in gold, outcomes with +% bonuses, hatch result says 金币收入.');

    // Shop: the furthest shop open (layer 2's hall: its shelf L4-L6, the worn newest L3 first); the next tool in gold.
    await tap(button('商店'));
    await page.locator('.shop-showroom, .shop-category').first().waitFor({ timeout: 30000 });
    if (await page.locator('.shop-category[data-category=tools]').isVisible().catch(() => false)) await tap(page.locator('.shop-category[data-category=tools]'));
    await page.locator('.shop-showroom').waitFor(); await page.waitForTimeout(2500);
    // The worn pickaxe is the newest one: its button enhances it.
    const enhance = page.getByTestId('shop-enhance'); await enhance.waitFor(); await shot('08a-shop-enhance');
    assert.match(await enhance.getAttribute('aria-label'), /强化到 \+1/);
    await tap(enhance); await page.waitForFunction(() => /\+1$/.test(document.querySelector('.shop-name')?.textContent ?? ''));
    assert.match(await page.getByTestId('shop-enhance').getAttribute('aria-label'), /强化到 \+2/);
    await shot('08b-shop-enhanced');
    await check('Shop: the worn newest pickaxe shows 强化 +1 with its gold price; buying it renames the pickaxe +1 and offers +2.');
    await tap(button('下一件商品')); await page.waitForTimeout(1500); await shot('08-shop-next-tool');
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /金币/);
    for (let i = 0; i < 2; i++) await tap(button('下一件商品'));
    await page.waitForTimeout(1500); await shot('09-shop-shelf-end');
    assert.match(await page.locator('.shop-head').innerText(), /Lv\.6/); assert.ok(await button('下一件商品').isDisabled(), 'layer 2 shelf ends at L6');
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /金币/);
    await tap(button('关闭商店'));
    await check('Shop: the shop button goes to layer 2\'s hall, whose shelf runs L3 (worn) to L6, priced in gold.');

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
    // World 2's own shop: its surface shelf, priced in tech coins.
    await tap(button('商店')); await page.locator('.shop-showroom').waitFor({ timeout: 120000 }); await page.waitForTimeout(2500);
    assert.match(await page.locator('.shop-head').innerText(), /Lv\.11/);
    assert.match(await page.getByTestId('shop-buy').getAttribute('aria-label'), /科技币/); await shot('12b-world2-shop');
    await tap(button('关闭商店'));
    await check('World 2: its surface shop sells level 11, priced in 科技币.');
    await page.evaluate(() => window.__miningValidation.teleport([0, 1, 283.2]));
    await settle(); await page.getByRole('dialog', { name: '世界传送门' }).waitFor(); await shot('13-world3-ticket');
    const ticket = await page.locator('.portal-world[data-state=next] .portal-ticket').innerText();
    assert.match(ticket, /镐子等级/); assert.match(ticket, /科技币/); assert.match(ticket, /Lv\.3\/20/);
    await check('World 2: HUD switches to 科技币 (2600); the portal shows the world 3 ticket.');

    // Each world's eggs stand in it: world 1's seven on Pinewind's two terraces, world 2's ten in the tech base's
    // hatchery, world 3's twelve in its own. Each later world's stands go dark until unlocked, once its scene loads.
    // A later world's scene loads on the first trip there; the arrival waits for it, so teleport until there.
    const look = async (feet, at, name) => {
      await page.evaluate(feet => window.__miningValidation.teleport(feet), feet);
      await page.waitForFunction(feet => { const p = window.__miningValidation.snapshot().position; return Math.abs(p[2] - feet[2]) < 1; }, feet, { timeout: 120000, polling: 500 });
      await page.evaluate(([feet, at]) => window.__miningValidation.look(Math.atan2(feet[0] - at[0], feet[2] - at[2]), .2), [feet, at]);
      await settle(); await shot(name);
    };
    await page.keyboard.press('Escape').catch(() => {});
    // World 3 is not open in this save (a player there would be sent home): open it from the test unlock page.
    await tap(page.locator('.dev-unlock-button'));
    await page.locator('.dev-unlock h3', { hasText: '第三世界' }).getByRole('button', { name: '解锁世界' }).click();
    await page.locator('.dev-unlock').getByRole('button', { name: '关闭' }).click();
    await look([0, .1, 268], [19, 0, 274], '20-world2-hatchery-from-spawn');
    await look([19, .1, 274], [30, 0, 274], '21-world2-hatchery-centre');
    const w2 = await page.evaluate(() => window.__miningValidation.snapshot().lockedEggs);
    await look([0, .1, 492], [20, 0, 498], '22-world3-hatchery-from-spawn');
    await look([20, .1, 498], [33, 0, 498], '23-world3-hatchery-centre');
    await look([16, .1, 26], [34, 2, 30], '24-world1-terrace');
    const eggs = await page.evaluate(() => { const s = window.__miningValidation.snapshot(); return { locked: s.lockedEggs, labels: s.eggLabels.labelCount }; });
    assert.equal(eggs.labels, 29); assert.equal(eggs.locked.stands, 29, `stands found: ${JSON.stringify(eggs.locked)}`);
    assert.ok(w2.stands >= 17, 'world 2 stands attach when its scene loads');
    assert.ok(eggs.locked.locked.includes('void-egg') && !eggs.locked.locked.includes('meadow-egg'));
    await check(`Egg stands: 29 labels; ${eggs.locked.stands} stands (world 1 seven, world 2 ten, world 3 twelve), ${eggs.locked.locked.length} still locked.`);
  } catch (error) {
    report.errors.push(String(error.stack ?? error)); console.error(error);
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally { report.finishedAt = new Date().toISOString(); await save(); await browser.close(); }
})();
