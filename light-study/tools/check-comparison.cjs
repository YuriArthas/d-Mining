const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

// Public-only, fixed-camera 2 x 2 study: light and material change independently.
// QUICK_ONLY=1 captures the four courtyard variants and the combined close/rear
// views. QUICK_FIRST=both (or another study name) changes capture order only.
// RUNTIME_ONLY=1 skips the view captures and checks restoration/cache/profiling.
// Use separate artifact directories when splitting a slow software-GPU run.
(async () => {
  const studies = ['baseline', 'light', 'material', 'both'];
  const entry = new URL(process.env.SCENE_URL || 'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html');
  assert.equal(entry.protocol, 'https:', 'Comparison checks require a published HTTPS entry');
  assert.ok(!['localhost', '127.0.0.1', '[::1]'].includes(entry.hostname), 'Private previews are not public validation');
  entry.searchParams.set('light', 'night');
  entry.searchParams.set('study', 'both');
  for (const key of ['view', 'detail', 'ao']) entry.searchParams.delete(key);
  const dir = path.resolve(__dirname, process.env.ARTIFACT_DIR || '../artifacts/comparison-public');
  const quick = process.env.QUICK_ONLY === '1';
  const runtimeOnly = process.env.RUNTIME_ONLY === '1';
  assert.ok(!(quick && runtimeOnly), 'Choose either quick views or runtime checks');
  const first = process.env.QUICK_FIRST || 'baseline';
  assert.ok(studies.includes(first), 'QUICK_FIRST must name a valid study');
  const order = [first, ...studies.filter(name => name !== first)];
  await fs.mkdir(dir, { recursive: true });
  const report = { url: entry.href, mode: runtimeOnly ? 'runtime' : quick ? 'quick' : 'full', startedAt: new Date().toISOString(), errors: [], checks: [], comparisons: {}, views: [], profile: [], bundles: [] };
  let browser, page;
  const bounded = async (promise, label, milliseconds = 180000) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms`)), milliseconds);
      })]);
    } finally { clearTimeout(timer); }
  };
  const check = text => {
    report.checks.push(text);
    // Preserve completed evidence even if the caller terminates a long run.
    // Only the final successful path adds completedAt.
    writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
    console.log('PASS', text);
  };
  const snap = () => bounded(page.evaluate(() => window.__lightStudy?.snapshot()), 'snapshot', 30000);
  const debug = (method, ...args) => bounded(page.evaluate(({ method, args }) => window.__lightStudy[method](...args), { method, args }), `debug.${method}`);
  const noErrors = snapshot => {
    assert.deepEqual(snapshot.errors, [], 'Scene collected no runtime or GPU errors');
    assert.deepEqual(report.errors, [], 'Browser collected no page or GPU errors');
  };
  const sameCamera = (actual, expected, label) => assert.deepEqual(actual.camera, expected.camera, `${label} preserves the camera and target`);
  const authoredGeometry = snapshot => ({ revision: snapshot.model.revision, triangles: snapshot.model.triangles, sourceMeshes: snapshot.model.sourceMeshes });
  const sameGeometry = (actual, expected, label) => assert.deepEqual(authoredGeometry(actual), authoredGeometry(expected), `${label} preserves authored geometry; runtime batch organization may differ`);
  const lightState = snapshot => {
    const value = structuredClone(snapshot.lighting);
    delete value.shadowInvalidations;
    return value;
  };
  const cachedShadows = snapshot => {
    assert.equal(snapshot.lighting.shadowNeedsUpdate, false, 'Directional shadow is cached after rendering');
    assert.equal(snapshot.lighting.lamp.shadowNeedsUpdate, false, 'Lantern shadow is cached after rendering');
    assert.equal(snapshot.lighting.environmentBuilds, report.environmentBuilds, 'Mode changes reuse the retained environments');
  };
  const variant = async (snapshot, name) => {
    assert.equal(snapshot.study, name);
    assert.equal(snapshot.lighting.mode, 'night');
    assert.equal(snapshot.lighting.variant, ['light', 'both'].includes(name) ? 'focused' : 'baseline');
    assert.equal(snapshot.materials.variant, ['material', 'both'].includes(name) ? 'crafted' : 'baseline');
    for (const value of studies) {
      assert.equal(await page.locator(`button[data-study="${value}"]`).getAttribute('aria-pressed'), String(value === name));
    }
    assert.equal(await page.locator('button[data-light="night"]').getAttribute('aria-pressed'), 'true');
    noErrors(snapshot);
    cachedShadows(snapshot);
  };
  const shot = async name => {
    await debug('draw');
    const snapshot = await snap();
    noErrors(snapshot);
    await page.screenshot({ path: path.join(dir, `${name}.png`), timeout: 120000 });
    if (name !== '11-clean-courtyard-both-1080') {
      await debug('capture', true);
      await page.screenshot({ path: path.join(dir, `${name}-clean.png`), timeout: 120000 });
      await debug('capture', false);
    }
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
    console.log('Opening', entry.href);
    await page.goto(entry.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.loading.error') ||
      (window.__lightStudy?.snapshot().ready && !document.querySelector('.loading:not([hidden])')),
    null, { timeout: 240000, polling: 500 });
    if (await page.locator('.loading.error').count()) throw new Error(await page.locator('.loading.error').innerText());
    await debug('draw');
    const initial = await snap();
    noErrors(initial);
    report.environmentBuilds = initial.lighting.environmentBuilds;
    assert.ok(report.environmentBuilds >= 2, 'Day and night environments are generated and retained');
    assert.equal(initial.renderer, 'WebGPU');
    assert.equal(initial.view, 'courtyard');
    assert.equal(initial.detailed, true);
    assert.equal(await page.locator('body').getAttribute('data-light'), 'night');
    assert.equal(await page.locator('button[data-study]').count(), 4);
    assert.equal(await page.locator('button[data-light]').count(), 3);
    await variant(initial, 'both');
    report.initial = initial;
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
    check('Direct public ?light=night&study=both initializes WebGPU and the combined study; public source hashes and adapter are recorded');

    for (const name of order) {
      const selected = await click(`button[data-study="${name}"]`);
      await variant(selected, name);
      sameCamera(selected, initial, `Study ${name}`);
      sameGeometry(selected, initial, `Study ${name}`);
      report.comparisons[name] = runtimeOnly ? selected : await shot(`0${studies.indexOf(name) + 1}-courtyard-${name}`);
    }
    const { baseline, light, material, both } = report.comparisons;
    assert.deepEqual(lightState(baseline), lightState(material), 'The material-only study preserves the complete baseline light state');
    assert.deepEqual(lightState(light), lightState(both), 'The combined study uses exactly the light-only state');
    assert.deepEqual(baseline.materials, light.materials, 'The light-only study preserves the complete baseline material state');
    assert.deepEqual(material.materials, both.materials, 'The combined study uses exactly the material-only state');
    check('Four UI-selected study states render from one camera and preserve authored geometry; light and material axes are independent');

    if (!runtimeOnly) {
    await click('button[data-study="both"]');
    for (const [view, name] of [['wall', '05-wall-both'], ['ground', '06-ground-both']]) {
      const selected = await click(`button[data-view="${view}"]`);
      assert.equal(selected.view, view);
      assert.equal(await page.locator(`button[data-view="${view}"]`).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(lightState(selected), lightState(both), 'Changing the camera preserves focused light');
      sameGeometry(selected, initial, 'Close view');
      await variant(selected, 'both');
      await shot(name);
    }
    await debug('orbit', [9, 5, -9], [-.5, 1, 0]);
    const rear = await shot('07-rear-both');
    await variant(rear, 'both');
    sameGeometry(rear, initial, 'Rear view');
    check('Combined study wall, ground and rear captures are recorded for visual material and light-leak review');
    await click('button[data-study="material"]');
    for (const view of ['wall', 'ground']) {
      await click(`button[data-view="${view}"]`);
      const selected = await shot(`close-${view}-material`);
      const combined = report.views.find(value => value.name === (view === 'wall' ? '05-wall-both' : '06-ground-both'));
      sameCamera(selected, combined, 'Material-only close comparison');
      assert.deepEqual(selected.materials, combined.materials);
    }
    await click('button[data-study="both"]');
    check('Material-only and combined close views use identical cameras and material state');
    if (quick) {
      report.final = await snap();
      report.completedAt = new Date().toISOString();
      return;
    }
    }

    await click('button[data-study="both"]');
    await click('button[data-view="courtyard"]');
    const day = await click('button[data-light="day"]');
    assert.equal(day.lighting.mode, 'day');
    assert.equal(await page.locator('body').getAttribute('data-light'), 'day');
    assert.equal(await page.locator('button[data-light="day"]').getAttribute('aria-pressed'), 'true');
    sameCamera(day, both, 'Day mode');
    cachedShadows(day);
    report.dayBefore = day;
    const golden = await click('button[data-light="golden"]');
    assert.equal(golden.lighting.mode, 'golden');
    assert.equal(await page.locator('body').getAttribute('data-light'), 'golden');
    assert.equal(await page.locator('button[data-light="golden"]').getAttribute('aria-pressed'), 'true');
    assert.notDeepEqual(golden.lighting.sun, day.lighting.sun, 'Golden mode retains distinct illumination');
    sameCamera(golden, day, 'Golden mode');
    report.golden = golden;
    const restoredNight = await click('button[data-light="night"]');
    await variant(restoredNight, 'both');
    assert.deepEqual(lightState(restoredNight), lightState(both), 'Night restores all focused light parameters');
    assert.deepEqual(restoredNight.materials, both.materials, 'Night restores the selected crafted materials');
    sameCamera(restoredNight, day, 'Night restoration');
    sameGeometry(restoredNight, day, 'Day/night switching');
    const dayRestored = await click('button[data-light="day"]');
    assert.deepEqual(lightState(dayRestored), lightState(day), 'Day fully restores after golden and focused night');
    report.dayAfter = await shot('08-day-restored');
    assert.deepEqual(lightState(report.dayAfter), lightState(day));
    // Study selection itself must enter night, even after the user selects day.
    const fromDay = await click('button[data-study="material"]');
    await variant(fromDay, 'material');
    assert.deepEqual(lightState(fromDay), lightState(material));
    sameCamera(fromDay, day, 'Study selection from day');
    await debug('study', 'both');
    await variant(await snap(), 'both');
    check('Day, golden and night controls restore complete light states; study buttons and the debug API reliably enter night');

    const detailed = await snap();
    const plain = await click('button[data-detail="false"]');
    assert.equal(plain.detailed, false);
    assert.equal(plain.materials.detailed, false);
    assert.equal(plain.materials.variant, 'crafted');
    sameGeometry(plain, detailed, 'Plain material toggle');
    sameCamera(plain, detailed, 'Plain material toggle');
    assert.deepEqual(lightState(plain), lightState(detailed));
    await shot('09-courtyard-both-plain');
    const detailRestored = await click('button[data-detail="true"]');
    assert.deepEqual(detailRestored.materials, detailed.materials, 'Detailed toggle restores all authored material state');
    assert.deepEqual(lightState(detailRestored), lightState(detailed));
    check('Detailed/plain controls retain the crafted variant and restore its PBR maps without changing light, camera or geometry');

    for (const name of ['baseline', 'both']) {
      await debug('study', name);
      await debug('draw');
      const warm = await snap();
      await variant(warm, name);
      assert.equal(warm.lighting.ao, true);
      assert.equal(warm.render.frameCalls, name === 'both' ? 8 : 6, 'Focused light adds only two halo blur passes; shadows remain cached');
      await page.waitForTimeout(2000);
      const afterIdle = await snap();
      assert.equal(afterIdle.submitted, warm.submitted, 'Idle submits no scene frames');
      assert.equal(afterIdle.lighting.shadowInvalidations, warm.lighting.shadowInvalidations);
      const frames = [];
      for (let i = 0; i < 3; i++) {
        await debug('draw');
        const snapshot = await snap();
        noErrors(snapshot);
        cachedShadows(snapshot);
        assert.equal(snapshot.lighting.shadowInvalidations, warm.lighting.shadowInvalidations, 'Measuring reuses cached shadow maps');
        assert.equal(snapshot.render.frameCalls, warm.render.frameCalls, 'Warmed pass count is stable');
        assert.equal(snapshot.render.drawCalls, warm.render.drawCalls, 'Warmed draw count is stable');
        assert.equal(snapshot.render.triangles, warm.render.triangles, 'Warmed rendered triangle count is stable');
        if (snapshot.gpuMs !== null) assert.equal(snapshot.gpuSampleFrame, snapshot.submitted, 'GPU timing belongs to this measured frame');
        assert.equal(snapshot.viewport.width, 1440);
        assert.equal(snapshot.viewport.height, 900);
        frames.push({ frame: snapshot.submitted, gpuSampleFrame: snapshot.gpuSampleFrame, cpu: snapshot.cpuSubmitMs, gpu: snapshot.gpuMs, render: snapshot.render, memory: snapshot.memory, adapter: snapshot.adapter });
      }
      report.profile.push({ study: name, ao: warm.lighting.ao, camera: warm.camera, light: warm.lighting.mode, detailed: warm.detailed, viewport: warm.viewport, frames });
    }
    check('Baseline and combined idle submit no frames; three exact warmed frames each retain cached shadows and stable render costs');

    const beforeAO = await snap();
    await debug('ao', false);
    await debug('draw');
    const aoOff = await snap();
    noErrors(aoOff);
    assert.equal(aoOff.lighting.ao, false);
    assert.equal(aoOff.render.frameCalls, 4, 'AO-off focused study retains the scene/composite and two halo passes');
    assert.deepEqual(aoOff.lighting.halo, beforeAO.lighting.halo, 'Turning AO off preserves the light-source halo');
    sameCamera(aoOff, beforeAO, 'AO toggle');
    sameGeometry(aoOff, beforeAO, 'AO toggle');
    cachedShadows(aoOff);
    await debug('ao', true);
    await debug('draw');
    const aoOn = await snap();
    assert.deepEqual(lightState(aoOn), lightState(beforeAO));
    assert.equal(aoOn.render.frameCalls, 8);
    report.ao = { off: aoOff, restored: aoOn };
    check('AO can be disabled and restored without rebuilding shadows, moving the camera or changing the comparison state');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await debug('view', 'courtyard');
    const desktop = await shot('10-courtyard-both-1080');
    assert.equal(desktop.viewport.width, 1920);
    assert.equal(desktop.viewport.height, 1080);
    await variant(desktop, 'both');
    await debug('capture', true);
    assert.equal(await page.locator('body').evaluate(node => node.classList.contains('capture')), true);
    report.final = await shot('11-clean-courtyard-both-1080');
    noErrors(report.final);
    check('1920x1080 combined desktop and UI-hidden screenshots are recorded without runtime or GPU errors');
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
