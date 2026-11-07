const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const url = process.env.SCENE_URL || 'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?scene=courtyard';
  const dir = path.resolve(__dirname, process.env.ARTIFACT_DIR || '../artifacts/public');
  await fs.mkdir(dir, { recursive: true });
  const report = { url, mode: process.env.QUICK_ONLY === '1' ? 'quick' : 'full', startedAt: new Date().toISOString(), errors: [], checks: [], views: [], profile: [], bundles: [] };
  let browser, page;
  const bounded = async (promise, label, milliseconds = 180000) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms`)), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  };
  const observe = () => {
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    page.on('pageerror', error => report.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });
  };
  const snap = () => bounded(page.evaluate(() => window.__lightStudy?.snapshot()), 'snapshot', 30000);
  const debug = (method, ...args) => bounded(page.evaluate(({ method, args }) => window.__lightStudy[method](...args), { method, args }), `debug.${method}`);
  const check = text => { report.checks.push(text); console.log('PASS', text); };
  const noErrors = snapshot => {
    assert.deepEqual(snapshot.errors, [], 'Scene collected no runtime or GPU errors');
    assert.deepEqual(report.errors, [], 'Browser collected no page or GPU errors');
  };
  const shot = async name => {
    await debug('draw');
    const snapshot = await snap();
    noErrors(snapshot);
    await page.screenshot({ path: path.join(dir, `${name}.png`), timeout: 120000 });
    report.views.push({ name, ...snapshot });
    console.log('Captured', name);
    return snapshot;
  };
  const openScene = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.loading.error') ||
      (window.__lightStudy?.snapshot().ready && !document.querySelector('.loading:not([hidden])')),
    null, { timeout: 240000, polling: 500 });
    if (await page.locator('.loading.error').count()) throw new Error(await page.locator('.loading.error').innerText());
  };
  const measuredFrames = async (count = 3) => {
    const frames = [];
    for (let i = 0; i < count; i++) {
      await debug('draw');
      const snapshot = await snap();
      noErrors(snapshot);
      if (snapshot.gpuMs !== null) assert.equal(snapshot.gpuSampleFrame, snapshot.submitted, 'GPU timestamp belongs to this exact measured frame');
      frames.push({ frame: snapshot.submitted, gpuSampleFrame: snapshot.gpuSampleFrame, cpu: snapshot.cpuSubmitMs, gpu: snapshot.gpuMs, render: snapshot.render, memory: snapshot.memory, adapter: snapshot.adapter });
    }
    return frames;
  };
  const click = async selector => {
    await page.locator(selector).click();
    await debug('draw');
    return snap();
  };
  const assertCamera = (actual, expected, label) => assert.deepEqual(actual.camera, expected.camera, `${label} preserves camera and target`);
  try {
    browser = await chromium.launch({ dumpio: process.env.DEBUG_GPU === '1', args: [
      '--no-sandbox', '--disable-quic',
      ...(process.env.GPU_VULKAN === '1' ? ['--use-angle=vulkan', '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--disable-vulkan-surface'] : ['--use-angle=swiftshader']),
      '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu',
    ] });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    observe();
    console.log('Opening', url);
    await openScene();
    await debug('draw');
    const initial = await snap();
    assert.equal(initial.renderer, 'WebGPU');
    noErrors(initial);
    report.adapter = initial.adapter;
    report.assetRevisions = { model: initial.model.revision, materials: initial.materials.revision, generator: initial.materials.generatorSha256 };
    report.release = await page.locator('script[src]').evaluateAll(scripts => scripts.map(script => script.src));
    for (const source of report.release) {
      const response = await page.request.get(source, { timeout: 120000 });
      assert.ok(response.ok(), `Public source bundle returned HTTP ${response.status()}`);
      const body = await response.body();
      const file = `release-${path.basename(new URL(source).pathname)}`;
      await fs.writeFile(path.join(dir, file), body);
      report.bundles.push({ url: source, file, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
    }
    check('Independent public entry initializes actual WebGPU and records its public source bundle and asset revisions');

    if (process.env.QUICK_ONLY === '1') {
      await debug('view', 'courtyard'); await debug('light', 'day'); await debug('detail', true);
      await shot('01-courtyard-day');
      await debug('view', 'ground'); await shot('02-ground-day');
      await debug('view', 'wall'); await shot('03-wall-day');
      await debug('view', 'courtyard'); await debug('light', 'golden');
      const detailed = await shot('04-courtyard-golden');
      await debug('view', 'wall'); await shot('05-wall-golden');
      await debug('view', 'courtyard'); await debug('detail', false);
      const plain = await shot('06-courtyard-plain-golden');
      assertCamera(plain, detailed, 'Detailed/plain comparison');
      assert.deepEqual(plain.lighting.sun, detailed.lighting.sun);
      await debug('detail', true); await debug('light', 'day');
      report.final = await shot('07-courtyard-day-restored');
      check('Quick public visual set includes matched detailed/plain framing and restores the detailed day courtyard');
      report.completedAt = new Date().toISOString();
      return;
    }

    await debug('draw');
    const warm = await shot('01-courtyard-day');
    report.defaultWarm = warm;
    assert.equal(warm.view, 'courtyard');
    assert.equal(warm.detailed, true);
    assert.equal(warm.materials.detailed, true);
    assert.equal(warm.materials.materialCount, 12);
    assert.equal(warm.materials.activeTextureCount, 21);
    assert.ok(warm.model.triangles > 0 && warm.model.batches > 0 && warm.model.geometryBytes > 0);
    assert.equal(warm.lighting.ao, true);
    assert.equal(warm.lighting.shadowNeedsUpdate, false);
    assert.equal(warm.lighting.environmentBuilds, 2);
    assert.equal(warm.render.frameCalls, 6);
    assert.match(warm.model.revision, /^[a-f0-9]{64}$/);
    assert.match(warm.materials.revision, /^[a-f0-9]{64}$/);
    check('Default detailed PBR scene loads 12 materials and 21 authored maps with valid geometry and revision hashes');
    check('Warm default uses six passes, cached static shadows, and two cached environments');
    const beforeIdle = warm.submitted;
    await page.waitForTimeout(2000);
    assert.equal((await snap()).submitted, beforeIdle);
    check('Idle scene submits zero extra frames over two seconds');

    for (const view of ['ground', 'wall', 'courtyard']) {
      const snapshot = await click(`[data-view="${view}"]`);
      assert.equal(snapshot.view, view);
      assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'), 'true');
      await shot(`view-${view}`);
    }
    assert.equal(await page.locator('[data-view]').count(), 3);
    check('All three view buttons select and render their curated desktop cameras');
    const beforeLight = await snap();
    const golden = await click('[data-light="golden"]');
    assert.equal(golden.lighting.mode, 'golden'); assertCamera(golden, beforeLight, 'Light toggle');
    await shot('04-courtyard-golden');
    const plain = await click('[data-detail="false"]');
    assert.equal(plain.detailed, false); assert.equal(plain.materials.detailed, false);
    assertCamera(plain, golden, 'Material A/B');
    assert.deepEqual(plain.lighting.sun, golden.lighting.sun);
    assert.deepEqual(plain.model, golden.model, 'Material A/B preserves the complete model');
    await shot('05-courtyard-plain-golden');
    const restored = await click('[data-detail="true"]');
    assert.equal(restored.detailed, true); assertCamera(restored, golden, 'Material restoration');
    const day = await click('[data-light="day"]');
    assert.equal(day.lighting.mode, 'day'); assertCamera(day, golden, 'Day restoration');
    check('Day/golden and detailed/plain controls preserve camera, with model geometry unchanged across material comparison');

    const comparisonCamera = day.camera;
    for (const enabled of [false, true]) {
      await debug('ao', enabled);
      await debug('draw'); await debug('draw');
      const snapshot = await shot(enabled ? '07-ao' : '06-no-ao');
      assert.equal(snapshot.lighting.ao, enabled);
      assert.equal(snapshot.render.frameCalls, enabled ? 6 : 2);
      assert.equal(snapshot.lighting.shadowNeedsUpdate, false);
      assert.deepEqual(snapshot.camera, comparisonCamera);
      assert.deepEqual(snapshot.lighting.sun, day.lighting.sun);
      report.profile.push({ ao: enabled, camera: snapshot.camera, light: snapshot.lighting.mode, detailed: snapshot.detailed, frames: await measuredFrames(3) });
    }
    check('AO on/off records three warmed exact-frame CPU/GPU samples with matching camera, light and materials');
    const beforeOrbit = await snap();
    await page.mouse.move(720, 450); await page.mouse.down();
    await page.mouse.move(830, 475, { steps: 5 }); await page.mouse.up();
    await debug('draw');
    assert.notDeepEqual((await snap()).camera.position, beforeOrbit.camera.position);
    check('Pointer drag changes the actual orbit camera');
    if (process.env.EXTRA_VIEWS === '1') {
      for (const view of [{ name: 'side', eye: [-8, 5, 10], target: [-.5, 1, 0] }, { name: 'rear', eye: [9, 5, -9], target: [-.5, 1, 0] }]) {
        await debug('orbit', view.eye, view.target); await shot(view.name);
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await debug('view', 'courtyard');
    const desktop = await shot('08-courtyard-1080');
    assert.equal(desktop.viewport.width, 1920); assert.equal(desktop.viewport.height, 1080);
    await debug('capture', true);
    report.final = await shot('09-clean-courtyard-1080');
    check('Desktop 1920 by 1080 resize and clean image capture retain the detailed day courtyard');

    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="games/mining-light/index.html"]').waitFor();
    report.launcher = {};
    for (const slug of ['mining', 'mining-test', 'mining-surface', 'mining-light']) {
      const locator = page.locator(`a[href*="games/${slug}/index.html"]`);
      assert.equal(await locator.count(), 1, `Launcher retains ${slug}`);
      report.launcher[slug] = await locator.getAttribute('href');
    }
    check('Public launcher lists the light sample beside formal Mining, test Mining and the surface study');

    // One active WebGPU page at a time avoids competing software devices.
    await page.close();
    page = await browser.newPage({ viewport: { width: 1439, height: 917 }, deviceScaleFactor: 1.5 });
    observe(); await openScene(); await debug('draw'); await debug('draw');
    const highDpi = await shot('10-native-dpr15');
    assert.equal(highDpi.viewport.dpr, 1.5); assert.equal(highDpi.render.frameCalls, 6);
    assert.equal(highDpi.lighting.shadowNeedsUpdate, false); assert.equal(highDpi.detailed, true);
    report.highDpi = highDpi;
    check('Sequential desktop DPR 1.5 check preserves native output and the six-pass default');
    noErrors(highDpi);
    report.completedAt = new Date().toISOString();
  } catch (error) {
    report.failure = String(error?.stack || error);
    if (page && !page.isClosed()) {
      report.snapshot = await snap().catch(() => null);
      await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 30000 }).catch(() => {});
    }
    throw error;
  } finally {
    try {
      await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
    } finally {
      if (browser) await bounded(browser.close(), 'browser close', 30000).catch(error => console.error(error));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
