const { chromium } = require('playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const localTools = require('../local-tools.cjs');
const base = new URL('games/mining-test/index.html', localTools.publicRoot()).href;
const renderQuery = 'submission=fenced&framesInFlight=1';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/delivery-20261031/browser');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, environment: 'Chromium Android landscape emulation; SwiftShader; fenced submission with one GPU frame in flight for the screenshot harness; no physical-phone or default-scheduler performance evidence', externalBlockingEnabled: process.env.MINING_BLOCK_EXTERNAL === '1', blockedExternalRequests: [], checks: [], errors: [], requests: [], coverage: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async (text, details) => { report.checks.push({ text, details }); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: UA });
  if (report.externalBlockingEnabled) await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(base).origin) {
      report.blockedExternalRequests.push({ url: request.url(), method: request.method() });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await context.addInitScript(() => {
    const audit = { observerTypes: [], warn: console.warn, error: console.error, intervals: new Set() };
    window.__deliveryAudit = audit;
    const OriginalObserver = window.PerformanceObserver;
    window.PerformanceObserver = new Proxy(OriginalObserver, { construct(Target, args) {
      const observer = new Target(...args), observe = observer.observe.bind(observer);
      observer.observe = options => { audit.observerTypes.push(options); return observe(options); };
      return observer;
    } });
    const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    window.setInterval = (...args) => { const id = interval(...args); audit.intervals.add(id); return id; };
    window.clearInterval = id => { audit.intervals.delete(id); return clear(id); };
  });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('request', r => { if (/^https?:/.test(r.url())) report.requests.push({ method: r.method(), url: r.url(), type: r.resourceType() }); });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const cdp = await context.newCDPSession(page);
  let mainScriptId = null;
  cdp.on('Debugger.scriptParsed', event => { if (/\/assets\/main-.*\.js$/.test(event.url)) mainScriptId = event.scriptId; });
  await cdp.send('Debugger.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const ready = async debug => {
    await page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('.joystick') && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    if (debug) await page.waitForFunction(() => window.__miningValidation?.snapshot().ready, null, { timeout: 180000 });
    await page.evaluate(() => document.fonts.ready);
  };
  const tap = async locator => { await locator.waitFor({ state: 'visible' }); const r = await locator.boundingBox(); assert.ok(r); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const shot = async name => {
    // Capture the already-composited phone frame directly; do not wait for two extra animation frames.
    for (let frame = 0; frame < 3; frame++) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { document.querySelector('canvas').getContext('webgl2')?.finish(); resolve(); })));
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await fs.writeFile(path.join(dir, name + '.png'), Buffer.from(result.data, 'base64'));
    report.screenshots.push(name + '.png'); await save();
  };
  const layout = async (label, inset = 0) => {
    const value = await page.evaluate(() => {
      const box = s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      return { width: innerWidth, height: innerHeight, left: box('.hud-left'), where: box('.hud-where'), menu: box('.hud-system'), rail: box('.hud-rail'), jump: box('.jump-button'), stick: box('.joystick'), selected: getSelection().toString(), userSelect: getComputedStyle(document.querySelector('canvas')).userSelect };
    });
    for (const key of ['left', 'where', 'menu', 'rail', 'jump', 'stick']) {
      const b = value[key]; assert.ok(b?.w && b.x >= inset - 1 && b.y >= 0 && b.r <= value.width - inset + 1 && b.b <= value.height + 1, `${label}: ${key} outside viewport ${JSON.stringify(value)}`);
    }
    const overlap = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
    for (const [a, b] of [['left', 'where'], ['where', 'menu'], ['where', 'rail'], ['left', 'stick'], ['rail', 'jump'], ['menu', 'rail']]) assert.ok(!overlap(value[a], value[b]), `${label}: ${a} overlaps ${b}`);
    assert.ok(value.jump.w >= 44 && value.jump.h >= 44); assert.equal(value.userSelect, 'none');
    await check(label + ': controls fit, remain separated and disable selection', value);
  };
  const defaultState = async () => {
    const value = await page.evaluate(() => ({ debug: !!window.__miningValidation || !!window.__mining || !!window.__miningSave, panel: !!document.querySelector('.hud-debug-tools'), logging: !!window.__MINING_LOG__ || !!window.__MINING_LOG_CONFIG__, observers: window.__deliveryAudit.observerTypes, consoleUnchanged: console.warn === window.__deliveryAudit.warn && console.error === window.__deliveryAudit.error }));
    assert.equal(value.debug, false); assert.equal(value.panel, false); assert.equal(value.logging, false); assert.deepEqual(value.observers, []); assert.equal(value.consoleUnchanged, true);
    return value;
  };
  const coverage = async expected => {
    const result = await cdp.send('Profiler.takePreciseCoverage');
    const matches = [];
    for (const script of result.result.filter(s => s.scriptId === mainScriptId)) {
      const { scriptSource: code } = await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId });
      for (const [marker, kind] of [['recordRaf(', 'PerformanceMeter constructor'], ['beginFrame(){this.start=performance.now()', 'RenderProfiler constructor']]) {
        const method = code.indexOf(marker), boundary = code.lastIndexOf('=class', method);
        assert.ok(method >= 0 && boundary >= 0, `Identify ${kind}`);
        const className = code.slice(0, boundary).match(/[$\w]+$/)[0], call = code.indexOf('new ' + className, method);
        assert.ok(call > method, `Identify ${kind} call site`);
        const ranges = script.functions.flatMap(f => f.ranges).filter(r => r.startOffset <= call && r.endOffset > call).sort((a, b) => (a.endOffset - a.startOffset) - (b.endOffset - b.startOffset));
        assert.ok(ranges.length);
        const range = ranges[0];
        matches.push({ kind, count: range.count, callSite: code.slice(call - 20, call + 75), range });
        assert.ok(expected ? range.count > 0 : range.count === 0, `${kind} call count ${range.count}`);
      }
      for (const f of script.functions) {
        const range = f.ranges[0], source = code.slice(range.startOffset, range.endOffset);
        const kind = source.startsWith('recordRaf(') ? 'PerformanceMeter.recordRaf' : source.startsWith('beginFrame(){this.start=performance.now()') ? 'RenderProfiler.beginFrame' : source.startsWith('add(') && source.includes('if(!this.enabled)return;') ? 'Measurements.add' : null;
        if (!kind) continue;
        const record = { kind, count: range.count, ranges: f.ranges, source: source.slice(0, 400) };
        if (kind !== 'Measurements.add') assert.ok(expected ? range.count > 0 : range.count === 0, `${kind} call count ${range.count}`);
        if (kind === 'Measurements.add' && !expected) assert.ok(f.ranges.some(r => r.count === 0 && r.startOffset > range.startOffset), 'timing samples are not collected');
        matches.push(record);
      }
    }
    assert.ok(matches.some(m => m.kind === 'PerformanceMeter constructor')); assert.ok(matches.some(m => m.kind === 'RenderProfiler constructor'));
    report.coverage.push({ debug: expected, functions: matches }); await check(expected ? 'Explicit debug mode executes local meters' : 'Ordinary mode does not execute frame meter or renderer profiler', matches);
  };
  try {
    await page.goto(base + '?' + renderQuery + '&lang=zh', { waitUntil: 'domcontentloaded', timeout: 120000 }); await ready(false);
    await defaultState(); await page.waitForTimeout(1800); await coverage(false);
    await layout('844x390'); await shot('01-ordinary-844x390');
    await tap(page.getByRole('button', { name: '菜单', exact: true }));
    const menu = page.locator('#hud-menu-panel'); await menu.waitFor();
    await tap(menu.getByRole('button', { name: '操作帮助', exact: true }));
    await page.getByRole('dialog').waitFor(); await tap(page.locator('.ui-sheet-close'));
    await page.waitForFunction(() => document.querySelector('.session-ui')?.getAttribute('data-panel') === 'none');
    await page.waitForTimeout(700); assert.equal(await page.locator('[role="dialog"]').count(), 0);
    await check('Touch opens help and closes its sheet without opening an underlying panel');
    for (const [width, height] of [[667, 375], [640, 320], [932, 430]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(800); await layout(`${width}x${height}`); await shot(`phone-${width}x${height}`);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    const safeStyle = await page.addStyleTag({ content: ':root{--safe-left:24px!important;--safe-right:24px!important;--safe-top:8px!important;--safe-bottom:8px!important}' });
    await page.waitForTimeout(500); await layout('844x390 with simulated 24px side safe areas', 24); await shot('02-simulated-safe-areas'); await safeStyle.evaluate(e => e.remove());
    for (const flag of ['0', 'true']) {
      await page.goto(`${base}?${renderQuery}&lang=zh&debug=${flag}`, { waitUntil: 'domcontentloaded' }); await ready(false); await defaultState(); await coverage(false); await check(`debug=${flag} keeps diagnostics disabled`);
    }
    const debugUrl = `${base}?${renderQuery}&lang=zh&debug=1&saveTest=delivery-${Date.now()}`;
    await page.goto(debugUrl, { waitUntil: 'domcontentloaded' }); await ready(true);
    await page.waitForFunction(() => !!window.__miningValidation.snapshot().renderer.performance, null, { timeout: 120000 });
    assert.equal(await page.locator('.hud-debug-tools').count(), 1);
    assert.equal(await page.locator('.hud-perf').count(), 0);
    assert.equal(await page.getByRole('button', { name: /上报性能/ }).count(), 0);
    await coverage(true); await check('Debug statistics are available locally with no report upload button');
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    const snapshot = () => page.evaluate(() => window.__miningValidation.snapshot());
    const start = await snapshot();
    const stick = await page.locator('.joystick').boundingBox(), x = stick.x + stick.width / 2, y = stick.y + stick.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y: y - 20, id: 1 }] });
    await page.waitForTimeout(1800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const moved = await snapshot(); assert.ok(Math.hypot(moved.position[0] - start.position[0], moved.position[2] - start.position[2]) > .25, 'touch joystick moves player');
    await page.waitForFunction(() => window.__miningValidation.snapshot().grounded, null, { timeout: 45000 });
    const beforeJump = (await snapshot()).jumps; await tap(page.getByRole('button', { name: '跳跃', exact: true }));
    await page.waitForFunction(n => window.__miningValidation.snapshot().jumps > n, beforeJump, { timeout: 30000 });
    const beforeLook = (await snapshot()).view;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 420, y: 220, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 500, y: 220, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(800); const afterLook = (await snapshot()).view;
    assert.ok(Math.abs(afterLook.yaw - beforeLook.yaw) > .01);
    await check('Actual touch joystick, jump and drag change movement, jump count and camera yaw', { from: start.position, to: moved.position, beforeJump, beforeLook, afterLook });
    const eggStation = (await snapshot()).content.eggStations[0];
    await page.evaluate(zone => window.__miningValidation.teleport([zone.x, zone.y, zone.z]), eggStation.zone);
    await page.waitForFunction(() => !!document.querySelector('.egg-world-prompt'), null, { timeout: 120000 });
    await tap(page.locator('.egg-world-prompt'));
    await page.locator('.egg-outcomes').waitFor();
    assert.ok((await page.locator('.egg-outcomes').innerText()).includes('%')); await shot('03-egg-probabilities');
    await tap(page.locator('.ui-sheet-close')); await page.waitForTimeout(700);
    assert.equal(await page.locator('[role="dialog"]').count(), 0); await check('Nearby egg opens real pet probabilities directly and closes with touch');
    const coins = (await snapshot()).economy.coins;
    assert.equal(await page.evaluate(() => window.__miningValidation.grantCoins(123)), true);
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(true);
    assert.equal((await snapshot()).economy.coins, coins + 123); assert.equal(await page.evaluate(() => window.__miningSave.namespace), namespace);
    await check('Isolated localStorage save retains exact coin balance across reload', { namespace, coins: coins + 123 });
    const external = report.requests.filter(r => new URL(r.url).origin !== new URL(base).origin);
    const writes = report.requests.filter(r => !['GET', 'HEAD'].includes(r.method));
    assert.deepEqual(external, []); assert.deepEqual(writes, []); assert.deepEqual(report.errors, []); assert.deepEqual(report.blockedExternalRequests, []);
    await check('All recorded HTTP requests stay on the game origin; no uploads, CDN requests or browser errors', { requests: report.requests.length });
    report.ok = true;
  } catch (error) {
    report.ok = false; report.failure = error.stack; console.error(error.stack);
    await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 30000 }).catch(() => {});
    process.exitCode = 1;
  } finally { await save(); await browser.close(); }
})();
