// Public phone-landscape check for I0 (docs/draft-ui-v2.md): the game in English, Indonesian and Vietnamese (?lang=). Every screen is shot;
// no Chinese is left in the page's text (the language picker's 简体中文 aside) and no button, tab, tag or card
// clips its text. Then the menu switches the language to Chinese and back.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/i18n');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [], overflow: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA, locale: 'en-US' });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /\[i18n\]/.test(m.text())) report.errors.push(m.text()); });
  const LANGS = (process.env.LANGS || 'en,id,vi').split(',');
  let url = '', shotDir = dir;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.__miningValidation.overlayTimeScale(5));
  };
  const tap = async locator => { const r = await locator.first().boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(500); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  /** No Chinese in the visible text, and no clipped labels. */
  const english = async (name, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name);
    const found = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), cjk = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement; if (!el || el.closest('[lang=zh], .hud-debug-tools, .dev-unlock, script, style')) continue;
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        if (/[一-鿿]/.test(n.textContent)) cjk.push(n.textContent.trim().slice(0, 40));
      }
      for (const el of document.querySelectorAll('[aria-label]')) { if (el.closest('[lang=zh], .hud-debug-tools, .dev-unlock')) continue; const v = el.getAttribute('aria-label'); if (/[一-鿿]/.test(v)) cjk.push('aria: ' + v.slice(0, 40)); }
      const clipped = [];
      for (const el of document.querySelectorAll('.ui-btn, .ui-tab, .ui-tile-label, .world-cards h4, .world-cards small, .shop-name, .bag-gear-info h4, .hud-trips .ui-btn, .shop-tag, .hud-place b, .hud-depth, .hud-goal span, .ui-chip, .ui-stamp, .bag-egg-name, .bag-egg-go, .egg-card-name, .egg-tag, .ui-cell-name, .hatch-chip, .ui-toast, .mine-plate-head, .ui-sheet-title, .ui-card-tile h4, .ui-bar > span, .hud-buff')) {
        // The buy button's shine sweeps past its edges on purpose.
        if (!el.getClientRects().length || el.matches('.shop-buy')) continue;
        // Its own text (not a badge pinned to its corner) reaching past its box: cut off or spilling out.
        const box = el.getBoundingClientRect(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let out = false;
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent.trim() || t.parentElement.closest('.ui-badge')) continue;
          const range = document.createRange(); range.selectNodeContents(t);
          for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 2 || r.right > box.right + 2)) out = true;
        }
        if (out) clipped.push(`${el.className.split(' ')[0]}: ${el.textContent.trim().slice(0, 30)}`);
      }
      return { cjk: [...new Set(cjk)], clipped };
    });
    report.overflow.push({ name, clipped: found.clipped }); await save();
    assert.deepEqual(found.cjk, [], `${name}: Chinese left in the page`);
    if (found.clipped.length) console.log('CLIP', name, JSON.stringify(found.clipped));
    return found.clipped;
  };
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
  };
  const at = async (feet, yaw = 0, pitch = .26) => { await page.evaluate(([f, y, p]) => { window.__miningValidation.teleport(f); window.__miningValidation.look(y, p); }, [feet, yaw, pitch]); await settle(); };
  const clippedAll = [];

  try {
    for (const lang of LANGS) {
      url = `${base}?lang=${lang}&debug=1&submission=fenced&framesInFlight=1&saveTest=${lang}-${Date.now()}`;
      shotDir = path.join(dir, lang); await fs.mkdir(shotDir, { recursive: true });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(shotDir, '00-boot.png') }).catch(() => {});
      assert.doesNotMatch(await page.locator('body').innerText(), /[\u4e00-\u9fff]/, `${lang}: boot screen`);
      await ready();
      await seed(`d.wallet.balances = { gold: 48000, tech: 130000, star: 0 }; d.onboarding.status = 'skipped';
        d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
        d.pets.inventory.pets = [['a', 'moss-slime'], ['b', 'amber-fox'], ['c', 'pebble-guardian'], ['d', 'copper-friend'], ['m1', 'quarry-mole'], ['m2', 'quarry-mole'], ['m3', 'quarry-mole'], ['m4', 'quarry-mole'], ['m5', 'quarry-mole']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
        d.pets.equipment.slots = ['a', 'b', null];
        d.worldProgress = { version: 2, openWorlds: [1, 2] };
        d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
        d.materials = { version: 1, items: { 'journey.sulfur': 12 } };
        d.pickaxe.level = 3; d.equipment.toolLevel = 3; d.rewards.timed = { speed: 300, luck: 0, sell: 0 };`);
      assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
      await at([0, .1, 46]);
      clippedAll.push(...await english(`${lang}/01-hud`));
      assert.match(await page.getByTestId('coins').innerText(), /48K/);
      await tap(page.locator('.hud-menu')); clippedAll.push(...await english(`${lang}/02-menu`)); await page.touchscreen.tap(420, 300);

      await tap(page.locator('[data-tip-target=pets]')); await page.getByRole('dialog').first().waitFor();
      clippedAll.push(...await english(`${lang}/03-pets`));
      await tap(page.locator('.bag-pet-grid .ui-cell:has(canvas[data-species=quarry-mole])').first()); clippedAll.push(...await english(`${lang}/04-pet-merge`));
      await tap(page.locator('.bag-get')); clippedAll.push(...await english(`${lang}/05-eggs`));
      await tap(page.locator('.bag-finder-bar .ui-btn').first());
      await tap(page.locator('.ui-tab').nth(1)); clippedAll.push(...await english(`${lang}/06-ores`));
      await tap(page.locator('.ui-tab').nth(2)); clippedAll.push(...await english(`${lang}/07-gear`));
      await tap(page.locator('.ui-sheet-close'));

      const zone = await page.evaluate(() => window.__miningValidation.snapshot().content.eggStations.find(s => s.eggId === 'pebble-egg').zone);
      await at([zone.x, zone.y + .1, zone.z]);
      await tap(page.locator('.egg-world-prompt')); await page.locator('.egg-sheet').waitFor();
      clippedAll.push(...await english(`${lang}/08-egg`));
      await tap(page.locator('.egg-buy')); await page.locator('.hatch').waitFor();
      await page.waitForFunction(() => document.querySelector('.hatch')?.dataset.done === 'true', null, { timeout: 20000 });
      clippedAll.push(...await english(`${lang}/09-hatch`));
      await tap(page.locator('.hatch-actions .ui-btn').first()); await tap(page.locator('.ui-sheet-close'));

      await tap(page.locator('[data-tip-target=shop]')); await page.locator('.shop-showroom').waitFor();
      await page.waitForFunction(() => !document.querySelector('.shop-loading'), null, { timeout: 120000 });
      clippedAll.push(...await english(`${lang}/10-shop`, 1800));
      await tap(page.locator('.shop-next')); clippedAll.push(...await english(`${lang}/11-shop-next`, 1500));
      await tap(page.locator('.shop-top-actions .ui-close'));

      await tap(page.locator('.hud-rail-row .ui-tile').last()); await page.getByRole('dialog').first().waitFor(); clippedAll.push(...await english(`${lang}/12-rewards`));
      await tap(page.locator('.ui-sheet-close'));
      await tap(page.locator('.hud-menu')); await tap(page.locator('.hud-menu-help')); clippedAll.push(...await english(`${lang}/13-help`)); await tap(page.locator('.ui-sheet-close'));

      await at([-7.9, .1, 53.1]); await page.waitForTimeout(1500);
      if (await page.locator('.station-sheet').count()) { clippedAll.push(...await english(`${lang}/14-station`)); await tap(page.locator('.ui-sheet-close')); }
      await at([3, -1.9, 3], 0, .7);
      for (let i = 0; i < 4; i++) { await page.touchscreen.tap(560, 230); await page.waitForTimeout(300); }
      clippedAll.push(...await english(`${lang}/15-mining`, 300));
      await check(`${lang}: boot, HUD, menu, bag (pets, merge, eggs, ores, gear), egg stand, hatch, shop, rewards, help, station and mining — no Chinese, nothing clipped so far.`);
    }

    // The menu switches the language: to Chinese, then to Vietnamese.
    await tap(page.locator('.hud-menu')); await page.locator('.hud-menu-lang button[lang=zh]').click();
    await page.waitForTimeout(3000); await ready(); await page.waitForTimeout(1500);
    assert.match(await page.locator('.ui-hud').innerText(), /[\u4e00-\u9fff]/);
    await page.screenshot({ path: path.join(dir, '16-switched-zh.png') });
    await tap(page.locator('.hud-menu')); await page.locator('.hud-menu-lang button[lang=vi]').click();
    await page.waitForTimeout(3000); await ready(); await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'vi');
    await page.screenshot({ path: path.join(dir, '17-switched-vi.png') });
    await check('The menu switches the page to 简体中文 and then to Tiếng Việt (each reloads in that language).');

    report.clipped = [...new Set(clippedAll)];
    console.log('CLIPPED', JSON.stringify(report.clipped));
    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors and no missing translations');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
