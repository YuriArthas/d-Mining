const localTools = require('./local-tools.cjs');
// Public phone-landscape check for UI v2 U4 (docs/draft-ui-v2.md): the bag. No pets; the team bar (slots with
// their pets, totals, 一键最佳 marked when it would help); another world's pet; a golden merge ready and done; the
// pet card's button never clipped; the egg list one world at a time on one screen; the ores tab with the material
// store as a ticket card; the gear tab; buying the 4th slot.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u4');
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
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=bag-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async name => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.first().boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(450); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  /** The element lies wholly inside the sheet and inside its own parent (nothing clipped). */
  const inside = (selector, within = '.ui-sheet') => page.evaluate(([s, w]) => {
    const e = document.querySelector(s), box = document.querySelector(w); if (!e || !box) return false;
    const a = e.getBoundingClientRect(), b = box.getBoundingClientRect();
    return a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  }, [selector, within]);
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

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await seed(`d.onboarding.status = 'skipped';`);
    await tap(button('打开我的宠物')); await page.getByRole('dialog').first().waitFor();
    assert.ok(await page.locator('.bag-detail-empty').count());
    await shot('01-no-pets');
    await check('No pets: the pet card says 还没有宠物 and offers 去开蛋; the grid ends with 获取宠物.');
    await tap(button('关闭宠物'));

    await seed(`d.wallet.balances = { gold: 4800, tech: 130000, star: 0 };
      d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
      d.pets.inventory.pets = [['a', 'moss-slime'], ['b', 'amber-fox'], ['c', 'pebble-guardian'], ['d', 'copper-friend'], ['e', 'gear-wing'], ['f', 'crystal-owl'],
        ['m1', 'quarry-mole'], ['m2', 'quarry-mole'], ['m3', 'quarry-mole'], ['m4', 'quarry-mole'], ['m5', 'quarry-mole']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
      d.pets.equipment.slots = ['a', 'b', null];
      d.worldProgress = { version: 2, openWorlds: [1, 2] };
      d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
      d.materials = { version: 1, items: { 'journey.sulfur': 12 } };`);
    await tap(button('打开我的宠物')); await page.getByRole('dialog').first().waitFor();
    const slots = page.locator('.bag-slots [role=listitem]');
    assert.equal(await slots.count(), 3);
    assert.match(await slots.nth(0).getAttribute('aria-label'), /第 1 格：苔团|第 1 格：琥珀狐/);
    assert.match(await slots.nth(2).getAttribute('aria-label'), /空/);
    assert.match(await page.locator('.bag-slots [data-locked]').getAttribute('aria-label'), /第 4 格.*解锁/);
    assert.match(await page.locator('.bag-totals').innerText(), /\+\d+%[\s\S]*挖矿 \+\d+%/);
    assert.ok(await page.locator('.bag-equip-best[data-better]').count(), '一键最佳 marked: the empty slot can take a gold pet');
    assert.ok(await page.locator('.bag-merge-ready').count() === 1, 'one merge-ready tag on the five moles');
    await shot('02-team');
    await check('Team bar: the slots show the two pets out and one empty slot, the 4th locked; totals in gold and mining; 一键最佳 marked; one 5/5 tag on the moles.');

    await tap(page.getByRole('listitem').filter({ hasText: '赤铜狐' }));
    assert.match(await page.locator('.bag-detail').innerText(), /科技币收入[\s\S]*挖矿速度[\s\S]*在第二世界加收入/);
    assert.ok(await inside('.bag-equip', '.bag-detail') && await inside('.bag-detail'), 'equip button inside the card');
    await shot('03-other-world');
    await check('Another world\'s pet: its card says 科技币收入 and 在第二世界加收入; the equip button sits whole inside the card.');

    await tap(page.getByRole('listitem').filter({ hasText: '矿洞鼹鼠' }).first());
    assert.match(await page.locator('.bag-merge').innerText(), /合成金色 5\/5/);
    assert.ok(await inside('.bag-equip', '.bag-detail'), 'equip button inside the card with the merge button');
    await shot('04-merge-ready');
    await tap(page.locator('.bag-merge'));
    await page.locator('.ui-cell[data-golden]').waitFor();
    assert.match(await page.locator('.bag-detail').innerText(), /金色矿洞鼹鼠/);
    assert.match(await page.locator('.bag-toast').innerText(), /合成了金色/);
    await shot('05-golden');
    await check('Golden merge: 合成金色 5/5 on the card, then a gold 金色矿洞鼹鼠 and a toast; the card\'s buttons are never clipped.');

    await tap(page.locator('.bag-equip-best'));
    assert.equal(await page.locator('.bag-equip-best[data-better]').count(), 0);
    const team = await page.locator('.bag-slots [role=listitem]').evaluateAll(s => s.map(e => e.getAttribute('aria-label')));
    assert.ok(team.every(t => !/空/.test(t)), `three pets out: ${team}`);
    await shot('06-best');
    await check(`一键最佳 fills the team (${team.join(' / ')}) and its mark goes.`);

    await tap(button('获取宠物'));
    await page.locator('.bag-eggs').waitFor();
    assert.equal(await page.locator('.bag-finder .ui-seg button').count(), 2);
    assert.equal(await page.locator('.bag-egg').count(), 7);
    assert.ok(await page.evaluate(() => { const e = document.querySelector('.bag-eggs'); return e.scrollHeight <= e.clientHeight + 2; }), 'world 1 eggs fit on one screen');
    await shot('07-eggs-world1');
    await tap(page.locator('.bag-finder .ui-seg button', { hasText: '第二世界' }));
    assert.equal(await page.locator('.bag-egg').count(), 10);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.bag-egg')].every(card => { const band = card.querySelector('.bag-egg-go').getBoundingClientRect(), box = card.getBoundingClientRect(); return band.bottom <= box.bottom + 1; })), 'every egg card shows its whole bottom band');
    assert.ok(await page.evaluate(() => { const e = document.querySelector('.bag-eggs'); return e.scrollHeight <= e.clientHeight + 2; }), 'world 2 eggs fit on one screen');
    await shot('08-eggs-world2');
    await check('Egg list: one world at a time (第一世界 7 eggs on one screen, 第二世界 10); locked eggs dark with where they unlock.');
    await tap(button('返回宠物'));

    await tap(page.getByRole('tab', { name: '矿物' }));
    const ticket = await page.locator('.bag-ticket').innerText();
    assert.match(ticket, /材料仓/); assert.match(ticket, /12\/30/);
    assert.match(await page.locator('.bag-ores .ui-cell').first().getAttribute('aria-label'), /单价/);
    await shot('09-ores');
    await check(`Ores: capacity, sale value and sell in one row; the material store as a ticket card (${ticket.replace(/\s+/g, ' ')}); each ore shows its unit price.`);

    await tap(page.getByRole('tab', { name: '装备' }));
    assert.equal(await page.locator('.bag-gear').count(), 2);
    await shot('10-gear');
    await check('Gear: the pickaxe and the bag, each with its next step and a 去商店 price button.');
    await tap(button('关闭装备'));

    // The 4th slot unlocks at world 2's third layer: open it from the testing page, then buy it in tech coins.
    await tap(page.locator('.dev-unlock-button'));
    const w2 = page.locator('.dev-unlock > div').filter({ has: page.locator('h3', { hasText: '第二世界' }) });
    for (let i = 0; i < 3; i++) await w2.getByRole('button', { name: '解锁' }).first().click();
    await page.locator('.dev-unlock').getByRole('button', { name: '关闭' }).click();
    await tap(button('打开我的宠物'));
    const buy = page.locator('.bag-buy-slot'); await buy.waitFor();
    assert.match(await buy.getAttribute('aria-label'), /购买第 4 格/);
    await shot('11-slot-buy');
    await tap(buy);
    await page.waitForFunction(() => document.querySelectorAll('.bag-slots [role=listitem]').length === 4);
    await shot('12-slot-bought');
    await check('With world 2\'s third layer reached, the 4th slot is a price button in tech coins; buying it opens a 4th slot.');

    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
