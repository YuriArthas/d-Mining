// Public phone-landscape check for the music, ambience and footsteps. Seeds only an isolated
// acceptance save; every action uses touch. Sound is verified by the game's own counters, the scene
// it reports and the measured level of the final audio output, and a short recording of that output
// is saved (headless Chromium renders audio but nobody listens).
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/audio-mobile');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, isMobile, touch, landscape, DPR 2, SwiftShader). Not a physical phone; sound is checked by counters, output level and a recording, not by ear.', checks: [], levels: {}, errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const audio = async () => (await snap()).feedback.audio;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
  };
  const shot = async (name, label = '') => { await page.screenshot({ path: path.join(dir, name + '.png') }); report.screenshots.push({ name, label }); console.log('SHOT', name); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(300); };
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
  /** Median output level over a few seconds (dBFS RMS). */
  const level = async (seconds = 3) => {
    const values = await page.evaluate(seconds => new Promise(resolve => {
      const out = [], start = performance.now();
      const id = setInterval(() => { out.push(window.__miningValidation.audioLevel() ?? -120); if (performance.now() - start > seconds * 1000) { clearInterval(id); resolve(out); } }, 100);
    }), seconds);
    values.sort((a, b) => a - b);
    return +values[Math.floor(values.length / 2)].toFixed(1);
  };
  const stick = async () => { const s = await page.locator('.joystick').boundingBox(); return { x: s.x + s.width / 2, y: s.y + s.height / 2, id: 1 }; };
  /** Walk forward for `seconds`, sampling the footstep surface every 100 ms. */
  const walk = async seconds => {
    const p = await stick(), surfaces = [], before = (await audio()).played.step ?? 0;
    await touch('touchStart', [p]); p.y -= 45; await touch('touchMove', [p]);
    const end = Date.now() + seconds * 1000;
    let counted = before;
    while (Date.now() < end) {
      const now = await audio(), n = now.played.step ?? 0, s = now.last.step?.surface;
      // Only steps taken during this walk, in the order the ground changes.
      if (n > counted && s && surfaces.at(-1) !== s) surfaces.push(s);
      counted = n; await page.waitForTimeout(100);
    }
    await touch('touchEnd');
    return { steps: ((await audio()).played.step ?? 0) - before, surfaces };
  };

  try {
    const url = `${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=audio-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();

    // 1. Nothing plays before the first touch; the first touch starts the valley music and ambience.
    assert.equal((await audio()).state, 'locked');
    await page.touchscreen.tap(600, 120); await page.waitForTimeout(600);
    await page.waitForFunction(() => window.__miningValidation.snapshot().feedback.audio.player?.playing === 'meadow', null, { timeout: 20000 });
    let a = await audio();
    assert.equal(a.state, 'running');
    assert.deepEqual([a.scene.song, a.scene.ambience], ['meadow', 'meadow']);
    await page.waitForTimeout(3000);
    a = await audio();
    assert.ok(a.player.scheduled > 10, `music notes scheduled: ${a.player.scheduled}`);
    assert.ok(Object.values(a.ambience.played).reduce((x, y) => x + y, 0) > 0, `ambience events: ${JSON.stringify(a.ambience.played)}`);
    report.levels.surface = await level();
    assert.ok(report.levels.surface > -60, `music and ambience reach the output: ${report.levels.surface} dBFS`);
    await check(`Before the first touch nothing plays; after it the valley tune (${a.player.lead_instrument}) and the valley ambience play (output ${report.levels.surface} dBFS).`);

    // 2. Walking from the spawn over the path and the bridge onto the plaza: footsteps change with the ground.
    await page.evaluate(() => { window.__miningValidation.teleport([0, .1, 47]); window.__miningValidation.look(0, .3); });
    await page.waitForTimeout(1500);
    const recording = page.evaluate(seconds => new Promise(resolve => {
      const stream = window.__miningValidation.audioStream(), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => { const blob = new Blob(chunks, { type: 'audio/webm' }), bytes = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); resolve(btoa(s)); };
      recorder.start(); setTimeout(() => recorder.stop(), seconds * 1000);
    }), 12);
    const walked = await walk(4.2);
    report.levels.walk = walked;
    assert.ok(walked.steps >= 12, `running steps: ${walked.steps}`);
    assert.ok(new Set(walked.surfaces).size >= 2, `the ground changes underfoot: ${walked.surfaces}`);
    await page.waitForTimeout(500);
    await check(`Running from the spawn to the plaza plays ${walked.steps} footsteps that follow the ground (${walked.surfaces.join(' → ')}).`);
    await page.waitForTimeout(7000);
    await fs.writeFile(path.join(dir, 'surface-walk.webm'), Buffer.from(await recording, 'base64'));
    report.screenshots.push({ name: 'surface-walk.webm', label: '12 s recording of the game output on the surface' });

    // 3. Night: the drums rest and crickets replace the birds.
    for (let i = 0; i < 40 && (await audio()).scene.daylight > 0.1; i++) { await page.evaluate(() => window.__miningValidation.advanceDayNight(30)); await page.waitForTimeout(150); }
    const crickets0 = (await audio()).ambience.played.cricket ?? 0, birds0 = (await audio()).ambience.played.bird ?? 0;
    await page.waitForTimeout(4000);
    a = await audio();
    assert.ok(a.scene.rhythm < 0.1, `drums rest at night: ${a.scene.rhythm}`);
    assert.ok((a.ambience.played.cricket ?? 0) > crickets0 + 3, 'crickets at night');
    assert.equal(a.ambience.played.bird ?? 0, birds0, 'no birds at night');
    await shot('01-night', 'night on the surface: crickets, no drums');
    await check('At night the drums fade out and crickets replace the birds.');

    // 4. Underground: the old mine's own piece and cave ambience, with echoing footsteps on its floor.
    await page.evaluate(() => { window.__miningValidation.teleport([1, -399.9, 4.5]); window.__miningValidation.look(.35, .35); });
    await page.waitForFunction(() => window.__miningValidation.snapshot().feedback.audio.player?.playing === 'timber', null, { timeout: 30000 });
    a = await audio();
    assert.deepEqual([a.scene.song, a.scene.ambience], ['timber', 'timber']);
    assert.ok(a.scene.cave > 0, 'effects echo underground');
    await page.waitForTimeout(2500);
    report.levels.oldMine = await level();
    const station = await walk(1.5);
    assert.ok(station.steps >= 3, `steps in the station: ${station.steps}`);
    await shot('02-old-mine', 'old mine station: its own music and cave ambience');
    await check(`In the old mine (400 m) its own piece and cave ambience play (output ${report.levels.oldMine} dBFS); footsteps sound on ${station.surfaces.join('/')}.`);

    // 5. Settings: music and sound switch separately and stay switched after a reload.
    await tap(button('设置'));
    await page.getByRole('button', { name: '音乐：开' }).waitFor();
    await shot('03-settings', 'settings: 音乐 and 音效 switches');
    await tap(page.getByRole('button', { name: '音乐：开' }));
    await page.getByRole('button', { name: '音乐：关' }).waitFor();
    await page.waitForTimeout(2500);
    a = await audio();
    assert.equal(a.music, false);
    assert.ok(a.player.state !== 'playing' || a.player.scheduled === a.player.scheduled, 'music stopped');
    const scheduled = a.player.scheduled;
    await page.waitForTimeout(2000);
    assert.equal((await audio()).player.scheduled, scheduled, 'no new notes with music off');
    report.levels.musicOff = await level();
    await tap(page.getByRole('button', { name: '音效：开' }));
    await page.getByRole('button', { name: '音效：关' }).waitFor();
    await page.waitForTimeout(800);
    assert.equal((await audio()).state, 'suspended', 'both off: the audio sleeps');
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    a = await audio();
    assert.deepEqual([a.music, a.enabled], [false, false], 'both choices survive a reload');
    await check(`音乐 and 音效 switch separately (music off: ${report.levels.musicOff} dBFS of ambience left; both off: audio suspended) and stay off after a reload.`);
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
