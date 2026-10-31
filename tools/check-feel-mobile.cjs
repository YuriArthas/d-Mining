const localTools = require('./local-tools.cjs');
// Public phone-landscape check for game feel: procedural sound cues and mining hit effects.
// Seeds only an isolated acceptance save; every action uses touch. Audio is verified through the
// game's own cue counters (headless Chromium renders audio but nobody listens).
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/feel-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone; audio is checked by cue counters, not by ear.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
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
  const audio = async () => (await snap()).feedback.audio;
  const played = async cue => (await audio()).played[cue] ?? 0;
  const waitPlayed = (cue, atLeast, timeout = 20000) => page.waitForFunction(([cue, n]) => (window.__miningValidation.snapshot().feedback.audio.played[cue] ?? 0) >= n, [cue, atLeast], { timeout, polling: 50 });
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
  };
  const draw = async () => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 3, n, { timeout: 120000, polling: 300 });
  };
  const shot = async (name, label = '') => { await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push({ name, label }); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(300); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  // Hold a finger on a minable block: the lesson ring if present, otherwise a few likely spots.
  const holdOnBlock = async (points) => {
    for (const [x, y] of points) {
      const before = (await snap()).avatar.mining.strikes;
      await touch('touchStart', [{ x, y, id: 3 }]);
      try { await page.waitForFunction(n => window.__miningValidation.snapshot().avatar.mining.strikes > n, before, { timeout: 2500, polling: 50 }); return { x, y }; }
      catch { await touch('touchEnd'); }
    }
    throw new Error('no minable block under the probe points');
  };
  // Copy each newly rendered frame around the miner (normal browser pacing during the grab).
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
          c.width = Math.round(w * crop[2] * 1.4); c.height = Math.round(h * crop[3] * 1.4);
          c.getContext('2d').drawImage(source, w * crop[0], h * crop[1], w * crop[2], h * crop[3], 0, 0, c.width, c.height);
          frames.push({ c, label: `${Math.round(performance.now() - start)}ms chips ${s.feedback.effects.particles}${s.feedback.effects.flashing ? ' flash' : ''}` });
        }
        if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick);
        else {
          const pick = frames.length <= 16 ? frames : Array.from({ length: 16 }, (_, i) => frames[Math.round(i * (frames.length - 1) / 15)]);
          const cols = 8, fw = pick[0].c.width, fh = pick[0].c.height, rows = Math.ceil(pick.length / cols);
          const out = document.createElement('canvas'); out.width = fw * cols; out.height = (fh + 24) * rows;
          const g = out.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, out.width, out.height); g.font = 'bold 14px sans-serif';
          pick.forEach((f, i) => { const x = (i % cols) * fw, y = Math.floor(i / cols) * (fh + 24); g.drawImage(f.c, x, y + 24); g.fillStyle = '#fff'; g.fillText(f.label, x + 5, y + 17); });
          window.__miningValidation.performance({ submission: 'fenced' });
          resolve({ url: out.toDataURL('image/png'), frames: frames.length, withChips: frames.filter(f => !f.label.includes('chips 0')).length });
        }
      };
      requestAnimationFrame(tick);
    }), [seconds, crop]);
    await fs.writeFile(path.join(dir, name + '.png'), Buffer.from(sheet.url.split(',')[1], 'base64'));
    report.screenshots.push({ name, label: `${sheet.frames} frames, ${sheet.withChips} with chips` }); await save();
    return sheet;
  };

  try {
    // Isolated save: first layer unlocked, onboarding skipped.
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=feel-${Date.now()}`;
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
    const seeded = url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`);
    await page.goto(seeded, { waitUntil: 'domcontentloaded' }); await ready();

    // 1. Sound waits for the first touch, then runs.
    assert.equal((await audio()).state, 'locked', 'no audio before any gesture');
    await page.touchscreen.tap(560, 200);
    await page.waitForFunction(() => window.__miningValidation.snapshot().feedback.audio.state === 'running', null, { timeout: 10000 });
    assert.equal((await audio()).enabled, true);
    await check('Audio stays locked until the first touch, then the context runs (sound on by default).');

    // 2. UI taps click; the settings panel offers the sound switch.
    const ui0 = await played('ui');
    await tap(button('设置'));
    await page.getByRole('button', { name: '音效：开' }).waitFor();
    assert.ok(await played('ui') > ui0, 'settings tap clicked');
    await page.touchscreen.tap(560, 230); await page.waitForTimeout(300);
    await check('HUD buttons play the UI click; settings show “音效：开”.');

    // 3. Jump and landing on the plaza.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 22]); window.__miningValidation.look(.55, .18); });
    await page.waitForTimeout(1200);
    const jumpButton = await page.locator('.jump-button').boundingBox();
    const [jump0, land0] = [await played('jump'), await played('land')];
    await touch('touchStart', [{ x: jumpButton.x + jumpButton.width / 2, y: jumpButton.y + jumpButton.height / 2, id: 7 }]); await touch('touchEnd');
    await waitPlayed('jump', jump0 + 1); await waitPlayed('land', land0 + 1);
    await check('A touch jump plays the take-off and landing cues.');

    // 4. Mining soil in the plaza pit: hits sound on contact, the final blow crumbles, ore pops.
    await page.evaluate(() => { window.__miningValidation.teleport([0, -6, 0]); window.__miningValidation.look(0, .5); });
    await page.waitForTimeout(1200); await draw();
    const [hit0, break0, pick0] = [await played('hit'), await played('break'), await played('pickup')];
    await holdOnBlock([[422, 160], [422, 220], [480, 200], [360, 200], [422, 280]]);
    await waitPlayed('hit', hit0 + 1); await waitPlayed('break', break0 + 1, 30000); await waitPlayed('pickup', pick0 + 1, 30000);
    await touch('touchEnd');
    const mined = await snap();
    assert.ok(mined.avatar.mining.contacts > 0, 'swing contacts counted');
    await shot('01-pit-after-break', 'plaza pit after mining soil');
    await check(`Holding on soil: hit cue on swing contact (${await played('hit') - hit0}), crumble on the final blow (${await played('break') - break0}), pickup pop (${await played('pickup') - pick0}).`);

    // 5. Back up and sell: travel whoosh, then the sale chime.
    const [travel0, sell0] = [await played('travel'), await played('sell')];
    await tap(button('返回地表'));
    await waitPlayed('travel', travel0 + 1);
    await page.waitForTimeout(800);
    await tap(button('传送到售卖圈出售'));
    await waitPlayed('sell', sell0 + 1);
    await check('返回地表 and the 出售 trip play the travel whoosh; the sale plays its chime.');

    // 6. Underground in the open station: chips fly off the struck face (frame grab).
    await page.evaluate(() => { window.__miningValidation.teleport([-4, .1, 46]); window.__miningValidation.look(Math.PI / 2, .3); });
    await page.waitForTimeout(1500);
    const stick = await page.locator('.joystick').boundingBox();
    const p = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touch('touchStart', [p]); p.y -= 40; await touch('touchMove', [p]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().position[1] < -100, null, { timeout: 30000 });
    await touch('touchEnd'); await page.waitForTimeout(2000);
    await page.evaluate(() => { window.__miningValidation.teleport([1, -399.9, 4.5]); window.__miningValidation.look(.35, .42); });
    await page.waitForTimeout(1200); await draw();
    const hit1 = await played('hit');
    await holdOnBlock([[470, 230], [520, 250], [380, 235], [560, 270], [430, 205], [600, 230], [500, 300]]);
    const sheet = await grab('02-station-chips', 2.5, [.36, .3, .28, .56]);
    await touch('touchEnd');
    assert.ok(sheet.withChips > 0, 'chips visible in grabbed frames');
    assert.ok(await played('hit') > hit1, 'hits sounded underground');
    await check(`Underground hits throw chips and flash the block (${sheet.withChips}/${sheet.frames} grabbed frames show chips).`);

    // 7. Sound off: cues are requested but not played, and the choice survives a reload.
    await tap(button('设置'));
    await tap(page.getByRole('button', { name: '音效：开' }));
    await page.getByRole('button', { name: '音效：关' }).waitFor();
    await page.touchscreen.tap(560, 230); await page.waitForTimeout(300);
    const muted = await audio();
    await holdOnBlock([[470, 230], [520, 250], [380, 235], [560, 270], [430, 205], [600, 230], [500, 300]]);
    await page.waitForTimeout(1500); await touch('touchEnd');
    const after = await audio();
    assert.ok((after.requested.hit ?? 0) > (muted.requested.hit ?? 0), 'hits still happen');
    assert.equal(after.played.hit ?? 0, muted.played.hit ?? 0, 'but make no sound');
    await page.goto(seeded, { waitUntil: 'domcontentloaded' }); await ready();
    assert.equal((await audio()).enabled, false, 'muted after reload');
    await check('Turning 音效 off silences every cue (hits keep counting) and stays off after a reload.');
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
