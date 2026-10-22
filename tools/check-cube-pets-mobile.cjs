// Public phone-landscape check for the cube pets: followers in the world (looks, sparkles by tier,
// hopping, facing the camera) and the matching UI portraits. Seeds only an isolated acceptance save.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/cube-pets-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const PETS = [['p-dragon', 'moon-dragon'], ['p-core', 'core-friend'], ['p-fox', 'amber-fox'], ['p-moss', 'moss-slime'], ['p-owl', 'crystal-owl'], ['p-tide', 'tide-wing'], ['p-star', 'star-guardian']];

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  // Verification only: keep the last frame readable for in-page frame grabs.
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
      return getContext.call(this, type, type === 'webgl2' || type === 'webgl' ? { ...attributes, preserveDrawingBuffer: true } : attributes);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3, n, { timeout: 120000, polling: 300 });
  };
  const shot = async (name, label = '') => { await draw(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push({ name, label }); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(400); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  const grab = async (name, seconds, crop) => {
    const sheet = await page.evaluate(([seconds, crop]) => new Promise(resolve => {
      window.__miningValidation.performance({ submission: 'browser' });
      const source = document.querySelector('canvas'), frames = [], start = performance.now();
      let last = -1;
      const tick = () => {
        const s = window.__miningValidation.snapshot(), n = s.renderer.submission.submitted;
        if (n !== last) {
          last = n;
          const w = source.width, h = source.height, c = document.createElement('canvas');
          c.width = Math.round(w * crop[2] * 1.2); c.height = Math.round(h * crop[3] * 1.2);
          c.getContext('2d').drawImage(source, w * crop[0], h * crop[1], w * crop[2], h * crop[3], 0, 0, c.width, c.height);
          frames.push({ c, label: `${Math.round(performance.now() - start)}ms hops ${s.petFollowers.filter(p => p.hopping).length}` });
        }
        if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick);
        else {
          const pick = frames.length <= 8 ? frames : Array.from({ length: 8 }, (_, i) => frames[Math.round(i * (frames.length - 1) / 7)]);
          const cols = 4, fw = pick[0].c.width, fh = pick[0].c.height, rows = Math.ceil(pick.length / cols);
          const out = document.createElement('canvas'); out.width = fw * cols; out.height = (fh + 22) * rows;
          const g = out.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, out.width, out.height); g.font = 'bold 14px sans-serif';
          pick.forEach((f, i) => { const x = (i % cols) * fw, y = Math.floor(i / cols) * (fh + 22); g.drawImage(f.c, x, y + 22); g.fillStyle = '#fff'; g.fillText(f.label, x + 5, y + 16); });
          window.__miningValidation.performance({ submission: 'fenced' });
          resolve({ url: out.toDataURL('image/png'), frames: frames.length });
        }
      };
      requestAnimationFrame(tick);
    }), [seconds, crop]);
    await fs.writeFile(path.join(dir, name + '.png'), Buffer.from(sheet.url.split(',')[1], 'base64'));
    report.screenshots.push({ name, label: `${sheet.frames} frames` }); await save();
  };

  try {
    // Isolated save: three equipped pets that cover the sparkle rule, plus a few in the bag.
    const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=cube-pets-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace); assert.match(namespace, /acceptance/);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ([name, pets]) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.coins = 5000; d.onboarding.status = 'skipped';
          d.pets = { version: 1, inventory: { version: 1, pets: pets.map(([id, speciesId]) => ({ id, speciesId, level: 1 })) }, equipment: { version: 1, slots: pets.slice(0, 3).map(([id]) => id) } };
          s.put(v, 'main');
        };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, [namespace, PETS]);
    const seeded = url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`);
    await page.goto(seeded, { waitUntil: 'domcontentloaded' }); await ready();

    // 1. Followers: right looks, sparkles by tier, glow only on the legendary.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 22]); window.__miningValidation.look(.35, .3); });
    await page.waitForTimeout(3000);
    const pets = (await snap()).petFollowers;
    assert.equal(pets.length, 3);
    const by = Object.fromEntries(pets.map(p => [p.speciesId, p]));
    assert.equal(by['moon-dragon'].face, 'dragon'); assert.ok(by['moon-dragon'].sparkles > 0 && by['moon-dragon'].glow, 'legendary sparkles and glows');
    assert.ok(by['core-friend'].sparkles > 0 && !by['core-friend'].glow, 'a late-egg rare sparkles');
    assert.equal(by['amber-fox'].sparkles, 0, 'an early-egg rare does not');
    assert.ok(pets.every(p => p.visible));
    await check('Equipped pets appear as cube pets: the meadow legendary sparkles and glows, a core-egg rare sparkles, a meadow rare does not.');

    // 2. Standing still, they turn to face the camera.
    await shot('01-standing', 'standing still: pets face the camera');
    await check('Standing still, the pets face the camera (screenshot).');

    // 3. Walking: they hop after the miner.
    const stick = await page.locator('.joystick').boundingBox();
    const p = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touch('touchStart', [p]); p.y -= 40; await touch('touchMove', [p]);
    await page.waitForTimeout(600);
    await grab('02-hopping', 2.2, [.18, .25, .64, .7]);
    let hops = 0;
    for (let i = 0; i < 20; i++) { hops = Math.max(hops, (await snap()).petFollowers.filter(f => f.hopping || f.position[1] > .05).length); await page.waitForTimeout(80); }
    await touch('touchEnd');
    assert.ok(hops > 0, 'pets hop while the miner walks');
    await check('Walking with the joystick, the pets hop after the miner (frame grab).');

    // 4. UI portraits: the bag, an egg stand and a hatch.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 22]); window.__miningValidation.look(.35, .3); });
    await page.waitForTimeout(1500); await draw();
    await tap(button('打开我的宠物'));
    await page.getByRole('dialog').first().waitFor();
    await page.waitForFunction(() => document.querySelectorAll('canvas.ui-cell-art[data-species]').length >= 5, null, { timeout: 20000 });
    await shot('03-bag-pets', 'bag: cube portraits');
    await tap(page.getByRole('dialog').getByRole('button', { name: /关闭/ }).first());
    await tap(button('打开我的宠物')); await tap(button('获取宠物')); await tap(button('前往原野蛋蛋台'));
    await page.waitForFunction(() => document.querySelector('.egg-world-prompt')?.style.visibility === 'visible', null, { timeout: 30000 });
    await tap(button('查看宠物蛋')); await page.getByRole('dialog').first().waitFor();
    await page.waitForTimeout(600);
    await shot('04-egg-sheet', 'egg stand: odds with cube portraits');
    await tap(page.getByRole('button', { name: /^开一个/ }));
    await page.waitForTimeout(1800);
    await shot('05-hatch', 'hatch reveal');
    await check('The bag, the egg stand and the hatch reveal show the same cube pets as the world.');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
