const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

(async () => {
  const entry = new URL(process.env.SCENE_URL || 'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?scene=courtyard');
  assert.equal(entry.protocol, 'https:', 'Night checks run against a published HTTPS entry');
  assert.ok(!['localhost', '127.0.0.1', '[::1]'].includes(entry.hostname), 'Private preview checks are not public validation');
  entry.searchParams.set('light', 'night');
  entry.searchParams.delete('view');
  entry.searchParams.delete('detail');
  entry.searchParams.delete('ao');
  const url = entry.href;
  const dir = path.resolve(__dirname, process.env.ARTIFACT_DIR || '../artifacts/night-public');
  const quick = process.env.QUICK_ONLY === '1';
  await fs.mkdir(dir, { recursive: true });
  const report = { url, mode: quick ? 'quick' : 'full', startedAt: new Date().toISOString(), errors: [], checks: [], views: [], profile: [], bundles: [] };
  let browser, page;
  const bounded = async (promise, label, milliseconds = 180000) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms`)), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  };
  const check = text => { report.checks.push(text); console.log('PASS', text); };
  const snap = () => bounded(page.evaluate(() => window.__lightStudy?.snapshot()), 'snapshot', 30000);
  const debug = (method, ...args) => bounded(page.evaluate(({ method, args }) => window.__lightStudy[method](...args), { method, args }), `debug.${method}`);
  const noErrors = snapshot => {
    assert.deepEqual(snapshot.errors, [], 'Scene collected no runtime or GPU errors');
    assert.deepEqual(report.errors, [], 'Browser collected no page or GPU errors');
  };
  const cachedShadows = snapshot => {
    assert.equal(snapshot.lighting.shadowNeedsUpdate, false, 'Directional shadow remains cached after rendering');
    assert.equal(snapshot.lighting.lamp.shadowNeedsUpdate, false, 'Lantern shadow remains cached after rendering');
    assert.equal(snapshot.lighting.environmentBuilds, 2, 'Two retained environments are reused across modes');
  };
  // Counters differ across a mode round trip; all actual light parameters must restore.
  const lightState = snapshot => {
    const value = structuredClone(snapshot.lighting);
    delete value.shadowInvalidations;
    return value;
  };
  const sameCamera = (actual, expected, label) => assert.deepEqual(actual.camera, expected.camera, `${label} preserves camera and target`);
  const shot = async name => {
    await debug('draw');
    const snapshot = await snap();
    noErrors(snapshot);
    await page.screenshot({ path: path.join(dir, `${name}.png`), timeout: 120000 });
    report.views.push({ name, ...snapshot });
    console.log('Captured', name);
    return snapshot;
  };
  const click = async selector => {
    await page.locator(selector).click();
    await debug('draw');
    const snapshot = await snap();
    noErrors(snapshot);
    return snapshot;
  };
  try {
    browser = await chromium.launch({ dumpio: process.env.DEBUG_GPU === '1', args: [
      '--no-sandbox', '--disable-quic',
      ...(process.env.GPU_VULKAN === '1' ? ['--use-angle=vulkan', '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--disable-vulkan-surface'] : ['--use-angle=swiftshader']),
      '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu',
    ] });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    page.on('pageerror', error => report.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.loading.error') ||
      (window.__lightStudy?.snapshot().ready && !document.querySelector('.loading:not([hidden])')),
    null, { timeout: 240000, polling: 500 });
    if (await page.locator('.loading.error').count()) throw new Error(await page.locator('.loading.error').innerText());
    await debug('draw');
    const initial = await snap();
    noErrors(initial);
    assert.equal(initial.renderer, 'WebGPU');
    assert.equal(initial.lighting.mode, 'night');
    assert.equal(initial.view, 'courtyard');
    assert.equal(initial.detailed, true);
    assert.equal(await page.locator('body').getAttribute('data-light'), 'night');
    assert.equal(await page.locator('button[data-light="night"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('button[data-light]').count(), 3);
    assert.ok(initial.lighting.lamp.intensity > 0, 'Night activates the actual lantern light');
    assert.ok(initial.lighting.lampEmissiveIntensity > 0, 'Night lantern geometry visibly emits');
    assert.ok(initial.lighting.environmentIntensity > 0, 'Night retains indirect illumination');
    cachedShadows(initial);
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
    check('Direct public ?light=night initializes real WebGPU, warm lantern, environment fill and selected night UI');
    check('Public source bundle, adapter and authored asset revisions are recorded');

    const courtyard = await shot('01-courtyard-night');
    for (const [view, name] of [['ground', '02-ground-night'], ['wall', '03-wall-night']]) {
      const snapshot = await click(`[data-view="${view}"]`);
      assert.equal(snapshot.view, view);
      assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(lightState(snapshot), lightState(courtyard), 'Changing views preserves nighttime lighting');
      await shot(name);
    }
    check('All three curated nighttime views render through their public UI buttons');
    if (quick) {
      report.final = await snap();
      report.completedAt = new Date().toISOString();
      return;
    }

    await click('[data-view="courtyard"]');
    const day = await click('button[data-light="day"]');
    assert.equal(day.lighting.mode, 'day');
    assert.equal(await page.locator('body').getAttribute('data-light'), 'day');
    assert.equal(await page.locator('button[data-light="day"]').getAttribute('aria-pressed'), 'true');
    sameCamera(day, courtyard, 'Day mode');
    cachedShadows(day);
    report.dayBefore = day;
    const golden = await click('button[data-light="golden"]');
    assert.equal(golden.lighting.mode, 'golden');
    assert.equal(await page.locator('body').getAttribute('data-light'), 'golden');
    assert.equal(await page.locator('button[data-light="golden"]').getAttribute('aria-pressed'), 'true');
    sameCamera(golden, day, 'Golden mode');
    assert.notDeepEqual(golden.lighting.sun, day.lighting.sun, 'Golden light has distinct parameters');
    cachedShadows(golden);
    report.golden = golden;
    const night = await click('button[data-light="night"]');
    assert.equal(night.lighting.mode, 'night');
    sameCamera(night, day, 'Night mode');
    assert.deepEqual(lightState(night), lightState(courtyard), 'Returning to night restores its complete light state');
    assert.deepEqual(night.model, day.model, 'Day/night switches preserve authored geometry');
    assert.ok(night.lighting.lamp.intensity > day.lighting.lamp.intensity, 'Night lantern is stronger than its daytime state');
    assert.ok(night.lighting.environmentIntensity < day.lighting.environmentIntensity, 'Night environment is dimmer than day');
    assert.ok(night.lighting.backgroundIntensity < day.lighting.backgroundIntensity, 'Night sky is dimmer than day');
    assert.ok(night.lighting.lampEmissiveIntensity > day.lighting.lampEmissiveIntensity, 'Night lantern emission exceeds its daytime state');
    cachedShadows(night);
    const dayRestored = await click('button[data-light="day"]');
    assert.deepEqual(lightState(dayRestored), lightState(day), 'Day restores all light parameters after golden and night');
    sameCamera(dayRestored, day, 'Day restoration');
    report.dayAfter = await shot('04-day-restored');
    assert.deepEqual(lightState(report.dayAfter), lightState(day));
    check('All three light buttons work; complete day and night light states restore after switching modes');

    await click('button[data-light="night"]');
    const detailed = await snap();
    const plain = await click('[data-detail="false"]');
    assert.equal(plain.detailed, false);
    assert.equal(plain.materials.detailed, false);
    assert.deepEqual(plain.model, detailed.model, 'Material comparison preserves geometry');
    assert.deepEqual(lightState(plain), lightState(detailed), 'Material comparison preserves every light parameter');
    sameCamera(plain, detailed, 'Material comparison');
    await shot('05-courtyard-night-plain');
    const detailedRestored = await click('[data-detail="true"]');
    assert.equal(detailedRestored.detailed, true);
    assert.equal(detailedRestored.materials.detailed, true);
    sameCamera(detailedRestored, detailed, 'Detailed material restoration');
    assert.deepEqual(lightState(detailedRestored), lightState(detailed));
    check('Night detailed/plain comparison preserves geometry, light and camera and restores authored PBR maps');

    await debug('draw');
    const warm = await snap();
    cachedShadows(warm);
    assert.equal(warm.lighting.ao, true);
    assert.equal(warm.render.frameCalls, 6, 'Warm AO scene has no repeated shadow passes');
    await page.waitForTimeout(2000);
    const afterIdle = await snap();
    assert.equal(afterIdle.submitted, warm.submitted, 'Idle does not submit scene frames');
    assert.equal(afterIdle.lighting.shadowInvalidations, warm.lighting.shadowInvalidations);
    const frames = [];
    for (let i = 0; i < 3; i++) {
      await debug('draw');
      const snapshot = await snap();
      noErrors(snapshot);
      cachedShadows(snapshot);
      assert.equal(snapshot.lighting.shadowInvalidations, warm.lighting.shadowInvalidations, 'Measuring does not rebuild shadows');
      if (snapshot.gpuMs !== null) assert.equal(snapshot.gpuSampleFrame, snapshot.submitted, 'GPU sample belongs to the measured frame');
      assert.equal(snapshot.viewport.width, 1440);
      assert.equal(snapshot.viewport.height, 900);
      frames.push({ frame: snapshot.submitted, gpuSampleFrame: snapshot.gpuSampleFrame, cpu: snapshot.cpuSubmitMs, gpu: snapshot.gpuMs, render: snapshot.render, memory: snapshot.memory, adapter: snapshot.adapter });
    }
    report.profile.push({ ao: warm.lighting.ao, camera: warm.camera, light: warm.lighting.mode, detailed: warm.detailed, viewport: warm.viewport, frames });
    check('Night idle submits no frames; three exact warmed 1440x900 samples reuse cached shadows and environments');

    for (const view of [{ name: '06-side-night', eye: [-8, 5, 10], target: [-.5, 1, 0] }, { name: '07-rear-night', eye: [9, 5, -9], target: [-.5, 1, 0] }]) {
      await debug('orbit', view.eye, view.target);
      const snapshot = await shot(view.name);
      assert.equal(snapshot.lighting.mode, 'night');
      cachedShadows(snapshot);
    }
    check('Side and rear nighttime captures are recorded for manual shadow-leak inspection');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await debug('view', 'courtyard');
    const desktop = await shot('08-courtyard-night-1080');
    assert.equal(desktop.viewport.width, 1920);
    assert.equal(desktop.viewport.height, 1080);
    assert.equal(desktop.lighting.mode, 'night');
    await debug('capture', true);
    assert.equal(await page.locator('body').evaluate(node => node.classList.contains('capture')), true);
    report.final = await shot('09-clean-courtyard-night-1080');
    noErrors(report.final);
    check('1920x1080 desktop output and UI-hidden nighttime image are captured without runtime or GPU errors');
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
