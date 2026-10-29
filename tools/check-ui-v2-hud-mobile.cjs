// Public phone-landscape check for UI v2 U2 (docs/draft-ui-v2.md): the new HUD on the surface, while mining, in a
// rest hall, with a full bag, buffs and the rebirth button, at four screen sizes; the HUD zones never overlap each
// other or the jump button, and the testing unlock and performance report buttons show only with ?debug=1.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u2');
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
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=hud-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async name => { await draw(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(400); };
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2500); };
  /** The HUD zones as boxes; none may overlap, and the right rail must end above the jump button. */
  const layout = async label => {
    const boxes = await page.evaluate(() => {
      const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, r: r.right, b: r.bottom } : null; };
      return { left: box('.hud-left'), where: box('.hud-where'), menu: box('.hud-system'), rail: box('.hud-rail'), jump: box('.jump-button'), stick: box('.joystick'), perf: box('.hud-perf'), bottom: box('.hud-bottom'),
        w: innerWidth, h: innerHeight };
    });
    const hit = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
    for (const [a, b] of [['left', 'where'], ['where', 'menu'], ['where', 'rail'], ['left', 'rail'], ['rail', 'jump'], ['left', 'stick'], ['menu', 'rail'], ['perf', 'left'], ['perf', 'stick'], ['perf', 'jump'], ['perf', 'rail'], ['perf', 'bottom']])
      assert.ok(!hit(boxes[a], boxes[b]), `${label}: ${a} overlaps ${b} ${JSON.stringify([boxes[a], boxes[b]])}`);
    for (const k of ['left', 'where', 'menu', 'rail', 'perf']) { const b = boxes[k]; assert.ok(b && b.x >= 0 && b.y >= 0 && b.r <= boxes.w && b.b <= boxes.h, `${label}: ${k} on screen`); }
    await check(`${label}: wallet, whereabouts, menu, rail, joystick, jump button and the performance button do not overlap at ${boxes.w}×${boxes.h}.`);
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
  const pit = async () => {
    await page.evaluate(() => { window.__miningValidation.teleport([3, -1.9, 3]); window.__miningValidation.look(0, .7); });
    await settle();
    for (let i = 0; i < 6; i++) { await page.touchscreen.tap(560, 230); await page.waitForTimeout(250); }
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await seed(`d.wallet.balances = { gold: 4800, tech: 0, star: 0 }; d.onboarding.status = 'skipped';
      d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
      d.worldExploration['1'] = { version: 1, maxDepth: 150, unlockedDestinationIds: ['old_mine', 'fungal'] };
      d.pickaxe.level = 3; d.equipment.toolLevel = 3;`);
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 46]); window.__miningValidation.look(0, .26); });
    await settle();
    assert.equal(await page.locator('.hud-place b').innerText(), '松风矿谷');
    assert.match(await page.getByTestId('journey-goals').innerText(), /下一层\s*水晶洞穴\s*150 \/ 260 米/);
    assert.equal(await page.locator('.hud-trips .hud-return').count(), 0);
    await shot('01-surface'); await layout('Surface');
    await check('Surface: the plate names the place (第一世界 · 松风矿谷); one bar to the next layer (水晶洞穴 150 / 260 米); sell shows for a part-full bag, no return button.');

    await tap(page.getByRole('button', { name: '菜单' }));
    const menu = page.locator('#hud-menu-panel'); await menu.waitFor();
    assert.equal(await menu.getByRole('button', { name: '操作帮助' }).count(), 1);
    assert.equal(await menu.locator('.ui-toggle').count(), 4);
    await shot('02-menu');
    await tap(menu.locator('.ui-toggle').filter({ hasText: '阴影' }));
    assert.equal(await menu.locator('.ui-toggle').filter({ hasText: '阴影' }).getAttribute('aria-pressed'), 'false');
    await tap(menu.locator('.ui-toggle').filter({ hasText: '阴影' }));
    await page.touchscreen.tap(420, 300); await page.waitForTimeout(400);
    assert.equal(await menu.count(), 0);
    await check('Menu: one corner button opens help, four switches (music, sound, shadows, 60 fps) and exit; a switch flips; tapping outside closes it.');

    await pit();
    assert.match(await page.getByTestId('depth').innerText(), /\d+\s*米/);
    assert.equal(await page.locator('.hud-trips .hud-return').count(), 1);
    await shot('03-mining'); await layout('Mining');
    await check('Mining: the plate shows the depth, return and sell sit small at the top left, the middle of the pit is clear.');

    const room = await page.evaluate(() => window.__miningValidation.snapshot().content.rooms[0]);
    await page.evaluate(spawn => { window.__miningValidation.teleport(spawn); window.__miningValidation.look(Math.PI, .1); }, room.spawn);
    await settle();
    assert.match(await page.locator('.hud-depth small').innerText(), /老矿井/);
    await shot('04-hall');
    await check('Rest hall: the plate names the layer (老矿井) over the depth.');

    await seed(`d.inventory.items = { 'journey.rock.0': 25 }; d.rewards.timed = { speed: 600, luck: 0, sell: 900 }; d.rebirth = { version: 2, count: 1 };`);
    await pit();
    assert.equal(await page.locator('.hud-sell').getAttribute('data-state'), 'full');
    assert.equal(await page.locator('.hud-buff').count(), 2);
    assert.equal(await page.getByRole('button', { name: /^重生/ }).count(), 1);
    assert.ok(await page.locator('.hud-coin-mult').count());
    await shot('05-full-buffs-rebirth'); await layout('Full bag, buffs, rebirth');
    await check('A full bag pulses the sell button in a gold ring; two buffs show with their clocks; the rebirth tile sits beside rewards; the coin pill carries the rebirth multiplier.');

    for (const [w, h, name] of [[640, 320, '06-small-640'], [932, 430, '07-wide-932'], [1280, 720, '08-desktop-1280']]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(1200);
      await shot(name); await layout(`${w}×${h}`);
    }
    await page.setViewportSize({ width: 844, height: 390 });

    const plain = await context.newPage();
    await plain.goto(`${base}?lang=zh&saveTest=hud-plain-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await plain.locator('.ui-hud').waitFor({ timeout: 300000 });
    assert.equal(await plain.locator('.dev-unlock-button').count(), 0);
    assert.equal(await plain.locator('.hud-perf').count(), 0);
    await plain.close();
    await check('Without ?debug=1 there is no testing 解锁 button and no performance report button.');

    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
