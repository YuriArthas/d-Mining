const localTools = require('./local-tools.cjs');
// Public phone-landscape check for the authored miner motions (jump / fall / landing, pickaxe swing)
// and the mip-mapped ore atlas. Seeds only an isolated acceptance save; every action uses touch.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/miner-motion-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  // Verification only: keep the last frame readable so motion can be grabbed frame by frame in-page
  // (a Playwright screenshot under SwiftShader takes longer than a whole jump).
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
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3; }, n, { timeout: 120000, polling: 300 });
  };
  const shot = async (name, label = '') => {
    await page.screenshot({ path: path.join(dir, name + '.png') });
    report.screenshots.push({ name, label }); console.log('SHOT', name, label); await save();
  };
  // Per-frame avatar samples in the page, so assertions do not depend on screenshot timing.
  const record = () => page.evaluate(() => {
    window.__motion = [];
    const tick = () => {
      const s = window.__miningValidation.snapshot(), a = s.avatar;
      window.__motion.push({ t: performance.now(), y: s.position[1], grounded: s.grounded, air: a.air, mining: a.mining, idle: a.clips[0].weight });
      if (window.__motion.length < 4000) window.__motionFrame = requestAnimationFrame(tick);
    };
    tick();
  });
  const samples = () => page.evaluate(() => { cancelAnimationFrame(window.__motionFrame); return window.__motion; });
  // Copy each newly submitted frame around the miner for `seconds` (SwiftShader renders slower than
  // requestAnimationFrame fires, so unchanged frames are skipped), then lay up to 16 out as one sheet.
  const grab = async (name, seconds, kind, crop = [.39, .3, .22, .56], scale = 1.6) => {
    const sheet = await page.evaluate(([seconds, kind, crop, scale]) => new Promise(resolve => {
      // Normal browser pacing renders on every animation frame; fenced single-frame pacing would
      // wait for SwiftShader to finish each frame first.
      window.__miningValidation.performance({ submission: 'browser' });
      const source = document.querySelector('canvas'), frames = [], start = performance.now();
      let last = -1;
      const tick = () => {
        const s = window.__miningValidation.snapshot(), submitted = s.renderer.submission.submitted;
        if (submitted !== last) {
          last = submitted;
          const w = source.width, h = source.height, c = document.createElement('canvas');
          c.width = Math.round(w * crop[2] * scale); c.height = Math.round(h * crop[3] * scale);
          c.getContext('2d').drawImage(source, w * crop[0], h * crop[1], w * crop[2], h * crop[3], 0, 0, c.width, c.height);
          const a = s.avatar, t = Math.round(performance.now() - start);
          frames.push({ c, label: kind === 'jump' ? `${t}ms air ${a.air.airborne.toFixed(2)} vy ${a.air.verticalSpeed.toFixed(1)}${a.air.landing ? ' land' : ''}` : `${t}ms phase ${a.mining.phase.toFixed(2)} #${a.mining.swings}` });
        }
        if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick);
        else {
          const pick = frames.length <= 16 ? frames : Array.from({ length: 16 }, (_, i) => frames[Math.round(i * (frames.length - 1) / 15)]);
          const cols = 8, fw = pick[0].c.width, fh = pick[0].c.height, rows = Math.ceil(pick.length / cols);
          const out = document.createElement('canvas'); out.width = fw * cols; out.height = (fh + 24) * rows;
          const g = out.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, out.width, out.height); g.font = 'bold 14px sans-serif';
          pick.forEach((f, i) => { const x = (i % cols) * fw, y = Math.floor(i / cols) * (fh + 24); g.drawImage(f.c, x, y + 24); g.fillStyle = '#fff'; g.fillText(f.label, x + 5, y + 17); });
          window.__miningValidation.performance({ submission: 'fenced' });
          resolve({ url: out.toDataURL('image/png'), frames: frames.length });
        }
      };
      requestAnimationFrame(tick);
    }), [seconds, kind, crop, scale]);
    await fs.writeFile(path.join(dir, name + '.png'), Buffer.from(sheet.url.split(',')[1], 'base64'));
    report.screenshots.push({ name, label: `${sheet.frames} frames in ${seconds}s` }); console.log('SHEET', name, sheet.frames); await save();
  };

  try {
    // Isolated save with the first underground layer unlocked.
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=motion-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace); assert.match(namespace, /acceptance/);
    await page.goto(localTools.publicRoot(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(async name => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => {
          const v = q.result, d = v.data;
          d.wallet.coins = 2500; d.onboarding.status = 'skipped';
          const explored = { version: 1, maxDepth: 812, unlockedDestinationIds: ['old_mine', 'fungal'] };
          d.exploration = explored; d.worldExploration['1'] = explored;
          s.put(v, 'main');
        };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, namespace);
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();

    // 1. Jump on the plaza with the touch jump button: knee tuck up, arms out down, landing crouch.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 22]); window.__miningValidation.look(.55, .18); });
    await page.waitForTimeout(1200); await draw();
    const jumpButton = await page.locator('.jump-button').boundingBox();
    const jumpAt = { x: jumpButton.x + jumpButton.width / 2, y: jumpButton.y + jumpButton.height / 2, id: 7 };
    for (let i = 0; i < 3; i++) {
      await page.waitForFunction(() => window.__miningValidation.snapshot().grounded, null, { polling: 50 });
      await page.waitForTimeout(700);
      await record();
      await touch('touchStart', [jumpAt]); await touch('touchEnd');
      await page.waitForTimeout(1300);
      await page.waitForTimeout(400);
      const motion = await samples();
      const peak = Math.max(...motion.map(m => m.air.airborne));
      const rose = motion.findIndex(m => m.air.jumped && m.air.verticalSpeed > 2);
      const fell = motion.findIndex((m, k) => k > rose && m.air.verticalSpeed < -2 && m.air.airborne > .5);
      const landed = motion.findIndex((m, k) => k > fell && m.air.landing);
      assert.ok(peak > .9, `air pose takes over (${peak})`);
      assert.ok(rose >= 0 && fell > rose && landed > fell, `rise → fall → landing in order (${rose}, ${fell}, ${landed})`);
      assert.equal(motion.at(-1).idle, 1, 'idle restored after landing');
    }
    await check('Touch jump plays the take-off tuck, the falling pose and a landing crouch in order, then returns to idle (3 jumps).');

    // 2. Through the 老矿井 portal with the joystick.
    await page.evaluate(() => { window.__miningValidation.teleport([-4, .1, 46]); window.__miningValidation.look(Math.PI / 2, .3); });
    await page.waitForTimeout(1500);
    const stick = await page.locator('.joystick').boundingBox();
    const p = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touch('touchStart', [p]); p.y -= 40; await touch('touchMove', [p]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().position[1] < -100, null, { timeout: 30000 });
    await touch('touchEnd'); await page.waitForTimeout(2500);
    const arrived = await snap();
    await check(`Joystick walk into the 老矿井 portal arrives underground (feet y ${arrived.position[1].toFixed(0)}).`);

    // Frame-by-frame look at one jump on the station deck (the underground scene renders fast enough).
    await page.evaluate(() => window.__miningValidation.look(.9, .12)); await draw(); await page.waitForTimeout(500);
    await touch('touchStart', [jumpAt]); await touch('touchEnd');
    await grab('05-jump-frames', 6, 'jump', [.36, .24, .28, .66], 1.3);

    // 3. Ore floor at grazing angles: the mip-mapped atlas must stay smooth, not speckled.
    for (const [i, [yaw, pitch]] of [[0, .05], [Math.PI * .75, .03], [-Math.PI / 2, .12]].entries()) {
      await page.evaluate(([yaw, pitch]) => window.__miningValidation.look(yaw, pitch), [yaw, pitch]); await draw(); await page.waitForTimeout(400);
      await shot(`1${i + 1}-ore-grazing`, `ore floor at a grazing angle (yaw ${yaw.toFixed(2)}, pitch ${pitch})`);
    }
    await check('Ore floor rendered at three grazing angles underground (screenshots for the speckle check).');

    // 4. Touch-hold mining on the minable floor north of the station deck; probe a few finger spots.
    await page.evaluate(() => { window.__miningValidation.teleport([1, -399.9, 4.5]); window.__miningValidation.look(.35, .42); });
    await page.waitForTimeout(1200); await draw();
    const before = (await snap()).avatar.mining;
    await record();
    let hold = null;
    for (const [x, y] of [[470, 230], [520, 250], [380, 235], [560, 270], [430, 205], [600, 230], [500, 300]]) {
      const point = { x, y, id: 3 };
      await touch('touchStart', [point]);
      try { await page.waitForFunction(n => window.__miningValidation.snapshot().avatar.mining.strikes > n, before.strikes, { timeout: 2500, polling: 50 }); hold = point; break; }
      catch { await touch('touchEnd'); }
    }
    assert.ok(hold, 'a minable block under the finger');
    const mined = (await snap()).target;
    await grab('21-mining-frames', 1.3, 'mining', [.38, .36, .24, .5], 1.6);
    await shot('22-mining-hud', 'whole screen while mining: the block card sits under the depth, clear of the miner');
    await touch('touchEnd');
    await page.waitForFunction(() => !window.__miningValidation.snapshot().avatar.mining.active, null, { timeout: 10000, polling: 50 });
    await page.waitForTimeout(300);
    const after = (await snap()).avatar;
    const motion = await samples();
    const hits = after.mining.strikes - before.strikes, swings = after.mining.swings - before.swings;
    assert.ok(hits >= 3, `several damaging hits while holding (${hits})`);
    assert.ok(swings >= 2 && swings <= hits, `one swing per hit at most (${swings} swings, ${hits} hits)`);
    assert.ok(new Set(motion.filter(m => m.mining.active).map(m => m.mining.phase.toFixed(1))).size >= 5, 'swing passes through its phases');
    assert.equal(after.clips[0].weight, 1, 'idle restored after release');
    report.mining = { hits, swings, speed: after.mining.speed, swingSeconds: after.mining.swingSeconds, firstTarget: mined };
    await check(`Touch-hold mining underground: ${hits} hits, ${swings} swings at ${after.mining.speed}/s (swing ${after.mining.swingSeconds}s); release returns to idle.`);

    // 5. Cracked blocks seen at grazing angles: the crack overlay must not break into dots either.
    for (const [i, [yaw, pitch]] of [[0, .06], [.5, .03]].entries()) {
      await page.evaluate(([yaw, pitch]) => window.__miningValidation.look(yaw, pitch), [yaw, pitch]); await draw(); await page.waitForTimeout(400);
      await shot(`3${i + 1}-cracks-grazing`, `damaged floor at a grazing angle (yaw ${yaw}, pitch ${pitch})`);
    }
    await check('Damaged blocks rendered at grazing angles (screenshots for the crack speckle check).');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
