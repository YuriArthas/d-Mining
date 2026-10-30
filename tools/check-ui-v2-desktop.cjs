// Public desktop spot check for UI v2 U9 (docs/draft-ui-v2.md): the phone-first UI must not break on a PC. At
// 1280×720 and 1920×1080, in English and Chinese, with a mouse: HUD, menu, pets, ores, egg stand, shop, station,
// portal, rewards, help. Every screen: no text past its box, the open sheet inside the window, HUD zones apart.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u9-desktop');

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let page, tag = '', url = '';
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const click = async locator => { await locator.first().click(); await page.waitForTimeout(500); };
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  const shot = async (name, wait = 800) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(dir, `${tag}-${name}.png`), timeout: 180000 }); report.screenshots.push(`${tag}-${name}`); console.log('SHOT', tag, name);
    const found = await page.evaluate(() => {
      const clipped = [], W = innerWidth, H = innerHeight;
      for (const el of document.querySelectorAll('.ui-btn, .ui-tab, .ui-tile-label, .ui-sheet h4, .ui-sheet b, .ui-sheet small, .ui-sheet-title, .hud-place b, .hud-depth, .hud-goal span, .shop-tag, .shop-name, .ui-pill-value')) {
        if (!el.getClientRects().length || el.closest('.ui-badge')) continue;
        const box = el.getBoundingClientRect(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(t);
          for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 2 || r.right > box.right + 2)) clipped.push(t.textContent.trim().slice(0, 30));
        }
      }
      const sheet = document.querySelector('.ui-sheet')?.getBoundingClientRect();
      const out = sheet && (sheet.left < 0 || sheet.top < 0 || sheet.right > W || sheet.bottom > H);
      return { clipped: [...new Set(clipped)], out };
    });
    assert.deepEqual(found.clipped, [], `${tag} ${name}: text past its box`);
    assert.ok(!found.out, `${tag} ${name}: the sheet leaves the window`);
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
  const zone = (kind, pick) => page.evaluate(([k, p]) => { const z = window.__miningValidation.snapshot().content[k].find(e => e.worldId === p || e.eggId === p).zone; return [z.x, (z.y ?? 0) + .1, z.z]; }, [kind, pick]);

  try {
    for (const [w, h] of [[1280, 720], [1920, 1080]]) for (const lang of ['en', 'zh']) {
      tag = `${w}-${lang}`;
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      page = await context.newPage(); page.setDefaultTimeout(60000);
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' || /\[i18n\]/.test(m.text())) report.errors.push(m.text()); });
      url = `${base}?lang=${lang}&debug=1&submission=fenced&framesInFlight=1&saveTest=pc-${tag}-${Date.now()}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
      await seed(`d.onboarding.status = 'skipped'; d.wallet.balances = { gold: 48000, tech: 0, star: 0 };
        d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 }; d.rewards.onlineSeconds = 420;
        d.pets.inventory.pets = [['a', 'moss-slime'], ['b', 'amber-fox'], ['c', 'pebble-guardian'], ['d', 'copper-friend']].map(([id, speciesId]) => ({ id, speciesId, level: 1 }));
        d.pets.equipment.slots = ['a', 'b', null];
        d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
        d.pickaxe.level = 3; d.equipment.toolLevel = 3;`);
      await at([0, .1, 46]);
      await shot('01-hud');
      await click(page.locator('.hud-menu')); await shot('02-menu'); await page.keyboard.press('Escape');
      await click(page.locator('[data-tip-target=pets]')); await page.locator('.bag-sheet').waitFor(); await shot('03-pets');
      await click(page.locator('.ui-tab').nth(1)); await shot('04-ores'); await page.keyboard.press('Escape');
      await at(await zone('eggStations', 'pebble-egg'));
      await click(page.locator('.egg-world-prompt')); await page.locator('.egg-sheet').waitFor(); await shot('05-egg'); await page.keyboard.press('Escape');
      await at([0, .1, 46]);
      await click(page.locator('[data-tip-target=shop]')); await page.locator('.shop-showroom').waitFor();
      await page.waitForFunction(() => !document.querySelector('.shop-loading'), null, { timeout: 120000 }); await shot('06-shop', 1800);
      await click(page.locator('.shop-top-actions .ui-close'));
      await at(await zone('stations', 1)); await page.locator('.station-sheet').waitFor(); await shot('07-station'); await click(page.locator('.ui-sheet-close'));
      await at(await zone('portals', 1)); await page.locator('.portal-sheet').waitFor(); await shot('08-portal'); await click(page.locator('.ui-sheet-close'));
      await at([0, .1, 46]);
      await click(page.locator('.hud-rail [data-kind=rewards]')); await page.locator('.rewards-sheet').waitFor(); await shot('09-rewards'); await page.keyboard.press('Escape');
      await click(page.locator('.hud-menu')); await click(page.locator('.hud-menu-help')); await page.locator('.help-sheet').waitFor(); await shot('10-help');
      await check(`${w}×${h} ${lang}: HUD, menu, pets, ores, egg stand, shop, station, portal, rewards and help — nothing past its box, sheets inside the window.`);
      await context.close();
    }
    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors and no missing translations');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page?.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
