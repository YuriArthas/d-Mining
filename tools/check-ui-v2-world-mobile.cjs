// Public phone-landscape check for UI v2 U7 (docs/draft-ui-v2.md): the teleport station (layers in one row, the next
// one with its depth), the world portal (the next world's ticket on its card, unlocking with one confirmation) and the
// rebirth panel (multiplier, checklist, reset/kept, confirm, celebration). Chinese first, then Vietnamese (the
// longest words) for the same screens: no Chinese left and no text spilling out.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u7');
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
  page.on('console', m => { if (m.type() === 'error' || /\[i18n\]/.test(m.text())) report.errors.push(m.text()); });
  let lang = 'zh', url = '';
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const tap = async locator => { const r = await locator.first().boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(500); };
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2000); };
  /** Screenshot; in a language other than Chinese, no Chinese text and no text past its box. */
  const shot = async (name, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(dir, `${lang}-${name}.png`), timeout: 180000 }); report.screenshots.push(`${lang}-${name}`); console.log('SHOT', lang, name);
    if (lang === 'zh') return;
    const found = await page.evaluate(() => {
      const cjk = [], clipped = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement; if (!el || el.closest('[lang=zh], .hud-debug-tools, .dev-unlock, script, style') || !el.getClientRects().length) continue;
        if (/[一-鿿]/.test(n.textContent)) cjk.push(n.textContent.trim().slice(0, 40));
      }
      for (const el of document.querySelectorAll('.ui-sheet .ui-btn, .ui-sheet small, .ui-sheet b, .station-name, .portal-need-label, .rebirth-term span, .rebirth-needs li, .ui-stamp')) {
        if (!el.getClientRects().length || el.closest('.ui-badge')) continue;
        const box = el.getBoundingClientRect(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(t);
          for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 2 || r.right > box.right + 2)) clipped.push(t.textContent.trim().slice(0, 30));
        }
      }
      return { cjk: [...new Set(cjk)], clipped: [...new Set(clipped)] };
    });
    assert.deepEqual(found.cjk, [], `${lang} ${name}: Chinese left`);
    assert.deepEqual(found.clipped, [], `${lang} ${name}: text past its box`);
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
  const standAt = async (kind, worldId) => {
    const zone = await page.evaluate(([k, w]) => window.__miningValidation.snapshot().content[k].find(p => p.worldId === w).zone, [kind, worldId]);
    await page.evaluate(z => window.__miningValidation.teleport([z.x, (z.y ?? 0) + .1, z.z]), zone);
    await settle();
  };
  const away = async () => { await page.evaluate(() => window.__miningValidation.teleport([0, .1, 46])); await settle(); };
  const button = text => page.locator('.ui-sheet .ui-btn', { hasText: text });

  try {
    for (lang of ['zh', 'vi']) {
      url = `${base}?lang=${lang}&debug=1&submission=fenced&framesInFlight=1&saveTest=world-${lang}-${Date.now()}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
      // World 1: two layers reached, the third the next; world 2's ticket part-way.
      await seed(`d.onboarding.status = 'skipped'; d.wallet.balances = { gold: 4800, tech: 0, star: 0 };
        d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
        d.pickaxe.level = 3; d.equipment.toolLevel = 3; d.materials = { version: 1, items: { 'journey.amethyst': 20, 'journey.sapphire': 4 } };`);
      await standAt('stations', 1);
      await page.locator('.station-sheet').waitFor();
      assert.equal(await page.locator('.station-layer').count(), 7);
      assert.equal(await page.locator('.station-layer[data-state=open] .station-go').count(), 2);
      assert.equal(await page.locator('.station-layer[data-state=next]').count(), 1);
      assert.equal(await page.locator('.station-layer[data-state=here]').count(), 1);
      await shot('01-station');
      await check(`${lang}: station — surface (you are here), two layers to teleport to, the next with its depth bar, the rest locked.`);
      await tap(page.locator('.ui-sheet-close')); await away();

      await standAt('portals', 1);
      await page.locator('.portal-sheet').waitFor();
      assert.equal(await page.locator('.portal-world[data-state=next] .portal-need').count(), 5);
      assert.equal(await page.locator('.portal-world[data-state=next] .portal-need[data-done]').count(), 1);
      assert.ok(await page.locator('.portal-unlock').isDisabled());
      await shot('02-portal-ticket');
      await check(`${lang}: portal — world 2's ticket on its card (pickaxe, three ores, gold), one line met, unlock greyed with its price.`);
      await tap(page.locator('.ui-sheet-close')); await away();

      // Everything for world 2: unlock it with one confirmation.
      await seed(`d.wallet.balances = { gold: 5400000, tech: 0, star: 0 }; d.pickaxe.level = 10; d.equipment.toolLevel = 10;
        d.materials = { version: 1, items: { 'journey.amethyst': 20, 'journey.sapphire': 15, 'journey.obsidian': 10 } };`);
      await standAt('portals', 1);
      await page.locator('.portal-sheet').waitFor();
      assert.equal(await page.locator('.portal-world[data-state=next] .portal-need[data-done]').count(), 5);
      await tap(page.locator('.portal-unlock'));
      await page.locator('.portal-confirm').waitFor(); await shot('03-portal-confirm');
      await tap(page.locator('.portal-confirm .ui-btn').last());
      await page.waitForFunction(() => document.querySelectorAll('.portal-world[data-state=open], .portal-world[data-state=here]').length === 2);
      await shot('04-portal-opened');
      await check(`${lang}: all five lines ticked; 解锁 asks once on the card, then world 2 opens (a 传送 button) and world 3 becomes the next.`);
      await tap(page.locator('.ui-sheet-close')); await away();

      // Rebirth: world 3 open, the journey not finished; then finished, reborn.
      await seed(`d.worldProgress = { version: 2, openWorlds: [1, 2, 3] }; d.pickaxe.level = 25; d.equipment.toolLevel = 25;
        d.worldExploration['3'] = { version: 1, maxDepth: 900, unlockedDestinationIds: [] };`);
      await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); });
      await settle();
      await tap(page.locator('.hud-rail-row .ui-tile').first());
      await page.locator('.rebirth-sheet').waitFor();
      assert.ok(await page.locator('.rebirth-go').isDisabled());
      assert.equal(await page.locator('.rebirth-needs li[data-done]').count(), 0);
      await shot('05-rebirth-locked');
      await tap(page.locator('.ui-sheet-close'));
      // World 3's last layer (the debug snapshot lists world 1's rooms only).
      const finalLayer = 'world3.6';
      await seed(`d.pickaxe.level = 30; d.equipment.toolLevel = 30; d.worldExploration['3'] = { version: 1, maxDepth: 2400, unlockedDestinationIds: ['${finalLayer}'] };`);
      await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); }); await settle();
      await tap(page.locator('.hud-rail-row .ui-tile').first()); await page.locator('.rebirth-sheet').waitFor();
      assert.equal(await page.locator('.rebirth-needs li[data-done]').count(), 2);
      await shot('06-rebirth-ready');
      await tap(page.locator('.rebirth-go')); await page.locator('.rebirth-confirm').waitFor(); await shot('07-rebirth-confirm');
      await tap(page.locator('.rebirth-confirm .ui-btn').last());
      await page.locator('.rebirth-celebration').waitFor(); await shot('08-rebirth-celebration', 400);
      await check(`${lang}: rebirth — ×1 → next multiplier, the checklist unticked then both ticked, reset/kept lists, a confirm on the panel, then the celebration.`);
    }
    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors and no missing translations');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
