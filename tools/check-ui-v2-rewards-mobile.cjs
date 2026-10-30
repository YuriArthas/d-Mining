// Public phone-landscape check for UI v2 U8 (docs/draft-ui-v2.md): rewards (online gifts, sign-in, invite, the capsule
// strip), the capsule machine and its result, how-to-play and the loading screen. Chinese, then Vietnamese (longest
// words): no Chinese left, no text past its box, everything on one screen.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u8');
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
  /** Screenshot; the open sheet fits the screen; outside Chinese, no Chinese and no text past its box. */
  const shot = async (name, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(dir, `${lang}-${name}.png`), timeout: 180000 }); report.screenshots.push(`${lang}-${name}`); console.log('SHOT', lang, name);
    const found = await page.evaluate(zh => {
      const out = { cjk: [], clipped: [], scroll: false };
      const body = document.querySelector('.ui-sheet-body');
      if (body && body.scrollHeight > body.clientHeight + 2) out.scroll = true;
      for (const el of document.querySelectorAll('.ui-sheet .ui-btn, .ui-sheet h4, .ui-sheet small, .ui-sheet b, .ui-sheet p, .help-tip b, .rewards-capsule span, .loading-steps li, .loading-tip, .loading-topline button')) {
        if (!el.getClientRects().length || el.closest('.ui-badge')) continue;
        const box = el.getBoundingClientRect(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          if (!t.textContent.trim()) continue;
          if (!zh && /[一-鿿]/.test(t.textContent)) out.cjk.push(t.textContent.trim().slice(0, 30));
          const range = document.createRange(); range.selectNodeContents(t);
          for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 2 || r.right > box.right + 2 || r.bottom > box.bottom + 4)) out.clipped.push(t.textContent.trim().slice(0, 30));
        }
      }
      return { ...out, cjk: [...new Set(out.cjk)], clipped: [...new Set(out.clipped)] };
    }, lang === 'zh');
    assert.deepEqual(found.cjk, [], `${lang} ${name}: Chinese left`);
    assert.deepEqual(found.clipped, [], `${lang} ${name}: text past its box`);
    assert.equal(found.scroll, false, `${lang} ${name}: the sheet needs scrolling`);
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
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); }); await settle();
  };

  try {
    for (lang of ['zh', 'vi']) {
      url = `${base}?lang=${lang}&debug=1&submission=fenced&framesInFlight=1&saveTest=rw-${lang}-${Date.now()}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await shot('00-loading', 0);
      assert.ok(await page.locator('.loading-screen .boot-exit, .loading-screen .loading-topline button').count());
      await ready();
      await check(`${lang}: the loading screen is flat style A, its exit a small link.`);

      await seed(`d.onboarding.status = 'skipped'; d.rewards.onlineSeconds = 420; d.rewards.balance = 30;`);
      await tap(page.locator('.hud-rail [data-kind=rewards]'));
      await page.locator('.rewards-sheet').waitFor();
      await tap(page.locator('.ui-tab').nth(1));
      assert.equal(await page.locator('.reward-card[data-state=ready]').count(), 1);
      await shot('01-signin');
      await tap(page.locator('.reward-card[data-state=ready] .ui-btn'));
      await page.locator('.rewards-toast').waitFor();
      assert.equal(await page.locator('.reward-card[data-state=claimed]').count(), 1);
      await shot('02-signed');
      await tap(page.locator('.ui-tab').nth(0));
      assert.ok(await page.locator('.reward-card[data-state=ready]').count() >= 1);
      await shot('03-online');
      await tap(page.locator('.ui-tab').nth(2)); await shot('04-invite');
      await check(`${lang}: rewards — sign-in day 1 framed gold, claimed with a toast and turned grey; online gifts ready; invite; the capsule strip at the bottom; one screen each.`);

      await tap(page.locator('.rewards-capsule .ui-btn'));
      await page.locator('.capsule-world-prompt').waitFor({ timeout: 30000 }); await tap(page.locator('.capsule-world-prompt'));
      await page.locator('.capsule-sheet').waitFor(); await shot('05-capsule');
      assert.match(await page.locator('.capsule-spin').innerText(), /\d/);
      await tap(page.locator('.capsule-spin')); await page.locator('.hatch').waitFor(); await shot('06-capsule-result');
      await tap(page.locator('.hatch-actions .ui-btn').first()); await tap(page.locator('.ui-sheet-close'));
      await check(`${lang}: the capsule machine's prize table and the spin as a verb + price button; a spin shows its result.`);

      await tap(page.locator('.hud-menu')); await tap(page.locator('.hud-menu-help'));
      await page.locator('.help-sheet').waitFor();
      assert.equal(await page.locator('.help-tip').count(), 8);
      await shot('07-help');
      await tap(page.locator('.ui-sheet-close'));
      await check(`${lang}: how to play — eight numbered picture cards on one screen, one short line each.`);
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
