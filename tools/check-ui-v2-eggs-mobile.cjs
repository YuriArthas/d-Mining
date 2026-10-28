// Public phone-landscape check for UI v2 U5 (docs/draft-ui-v2.md): the egg stand sheet (every pet's odds on one
// screen, pets that would beat the team marked), the hatch (shake, crack, pop by rarity), the result (立即装备 replaces
// the team's weakest pet; a duplicate shows its golden progress), a price the player cannot pay (greyed, never a
// missing amount) and a locked egg.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u5');
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
  const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=eggs-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    // SwiftShader takes over a second per screenshot: stretch the hatch so its shake can be caught.
    await page.evaluate(() => window.__miningValidation.overlayTimeScale(5));
  };
  const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.first().boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(350); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  const noShortfall = async where => assert.doesNotMatch(await page.locator('body').innerText(), /还差|不足|不够/, `${where}: no missing-amount wording`);
  const seed = async mutate => {
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'commit', timeout: 120000 });
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
  const standAt = async eggId => {
    const zone = await page.evaluate(id => window.__miningValidation.snapshot().content.eggStations.find(s => s.eggId === id).zone, eggId);
    await page.evaluate(z => window.__miningValidation.teleport([z.x, z.y + .1, z.z]), zone);
    await settle();
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    // A team of three pebble pets (石团 +130% the weakest), 4800 gold, old mine reached (the pebble egg unlocks there).
    await seed(`d.wallet.balances = { gold: 4800, tech: 0, star: 0 }; d.onboarding.status = 'skipped';
      d.pets.inventory.pets = [['a', 'pebble-blob'], ['b', 'pebble-scout'], ['c', 'pebble-friend']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
      d.pets.equipment.slots = ['a', 'b', 'c'];
      d.worldExploration['1'] = { version: 1, maxDepth: 70, unlockedDestinationIds: ['old_mine'] };`);
    await standAt('pebble-egg');
    await tap(button('查看卵石蛋')); await page.locator('.egg-sheet').waitFor();
    assert.equal(await page.locator('.egg-outcome').count(), 5);
    assert.equal(await page.locator('.egg-mining').count(), 5);
    const better = await page.locator('.egg-outcome:has(.egg-better)').evaluateAll(o => o.map(e => e.querySelector('.egg-card-name').textContent));
    assert.equal(better.length, 4, `four pets beat 石团 (+130%): ${better}`);
    assert.ok(await page.evaluate(() => { const s = document.querySelector('.egg-sheet').getBoundingClientRect(); return [...document.querySelectorAll('.egg-outcome')].every(o => o.getBoundingClientRect().bottom <= s.bottom); }), 'all five pets on one screen');
    assert.match(await page.locator('.egg-buy').getAttribute('aria-label'), /开蛋，130 金币/);
    await shot('01-egg');
    await check(`Egg sheet: five pets with odds on one screen; ${better.join('、')} marked ↑ 比队伍强 (the team's weakest is 石团 +130%); the button reads 开蛋 · 130.`);

    // Hatch until both kinds of result have been seen: a pet that beats the team (立即装备) and a duplicate.
    let sawBetter = false, sawDuplicate = false, opened = 0;
    while ((!sawBetter || !sawDuplicate) && opened < 16) {
      opened++;
      await tap(page.locator(await page.locator('.hatch').count() ? '.hatch .ui-price-btn' : '.egg-buy'));
      await page.locator('.hatch').waitFor();
      if (opened === 1) { assert.equal(await page.locator('.hatch').getAttribute('data-done'), 'false', 'the egg shakes first'); await shot('02-shake', 400); }
      await page.waitForFunction(() => document.querySelector('.hatch')?.dataset.done === 'true', null, { timeout: 20000 });
      const tags = await page.locator('.hatch-tags').innerText();
      assert.match(tags, /金币收入 \+\d+%/); assert.match(tags, /挖矿 \+\d+%/);
      const equip = await page.locator('.hatch-equip').count();
      if (equip && !sawBetter) {
        sawBetter = true;
        const name = (await page.locator('.hatch h2').innerText()).trim();
        await shot('03-result-better');
        await tap(page.locator('.hatch-equip'));
        const said = await page.locator('.egg-toast').innerText();
        assert.match(said, new RegExp(`${name} 替换了 石团`));
        await shot('04-equipped', 300);
        await check(`A pet that beats the team: 立即装备 puts it in place of the weakest (${said}).`);
      } else if (!equip && !sawDuplicate && /已有 \d+ 只 · 金色 \d+\/5/.test(tags)) {
        sawDuplicate = true;
        await shot('05-result-duplicate', 200);
        await check(`A duplicate: no equip button, its golden progress shown (${tags.match(/已有 \d+ 只 · 金色 \d+\/5/)[0]}).`);
      }
    }
    assert.ok(sawBetter && sawDuplicate, `saw both results within ${opened} opens`);
    if (await page.locator('.hatch').count()) await tap(button('完成'));
    await tap(button('关闭卵石蛋'));

    // Short of gold: the same button, grey, with its price; nowhere a missing amount.
    await seed(`d.wallet.balances = { gold: 100, tech: 0, star: 0 };`);
    await standAt('pebble-egg');
    await tap(button('查看卵石蛋')); await page.locator('.egg-sheet').waitFor();
    assert.ok(await page.locator('.egg-buy').isDisabled());
    assert.match(await page.locator('.egg-buy').innerText(), /开蛋\s*130/);
    await noShortfall('Egg sheet short of gold');
    await shot('06-short');
    await check('Short of gold: 开蛋 · 130 greyed out, no 还差/不足 anywhere.');
    await tap(button('关闭卵石蛋'));

    // A locked egg (the crystal cave's): dark, its price and where it unlocks, its pets secret.
    const locked = await page.evaluate(() => window.__miningValidation.snapshot().content.eggStations.map(s => s.eggId).find(id => id === 'crystal-egg') ?? null);
    const lockedId = locked ?? await page.evaluate(() => window.__miningValidation.snapshot().content.eggStations[3].eggId);
    await standAt(lockedId);
    await page.locator('.egg-world-prompt').waitFor(); await tap(page.locator('.egg-world-prompt')); await page.locator('.egg-sheet').waitFor();
    assert.ok(await page.locator('.egg-mystery').count());
    assert.match(await page.locator('.egg-buy').innerText(), /到达.*解锁/);
    await noShortfall('Locked egg');
    await shot('07-locked');
    await check(`A locked egg (${lockedId}): ??? with its price and 到达…解锁; its pets stay secret.`);

    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
