const localTools = require('./local-tools.cjs');
// Public check for the bottom-left "report performance" button (docs/phase-performance-report-20261028.md): on the
// public build, press it and read the file the public host saved; the saved report is exactly what the browser sent.
// Pressing again while sending saves nothing extra; a failed send says so and a second press succeeds. Desktop
// 1600×900 in Chinese, then a touch phone in landscape in English: a round icon beside the thumbstick's foot.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const reports = localTools.required('MINING_REPORT_DIR');
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/performance-report');
const saved = async () => (await fs.readdir(reports).catch(() => [])).filter(n => n.endsWith('.json'));

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const result = { url: base, startedAt: new Date().toISOString(), checks: [], reports: [] };
  const pass = async text => { result.checks.push(text); console.log('PASS', text); await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(result, null, 2)); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (name, options, lang) => {
    const context = await browser.newContext(options), page = await context.newPage();
    const sent = [];
    page.on('request', r => { if (r.url().endsWith('/api/mining/performance-reports') && r.method() === 'POST') sent.push(r.postData()); });
    await page.goto(`${base}?lang=${lang}&debug=1&submission=fenced&framesInFlight=1&saveTest=perf-${name}-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    return { page, sent };
  };
  /** Press, wait for the outcome, and return the saved file next to what the browser sent. */
  const report = async (page, sent, press) => {
    const before = new Set(await saved()), count = sent.length;
    await press();
    await page.waitForFunction(() => ['sent', 'failed'].includes(document.querySelector('.hud-perf')?.dataset.state), null, { timeout: 60000 });
    const state = await page.$eval('.hud-perf', b => ({ state: b.dataset.state, text: b.textContent }));
    const fresh = (await saved()).filter(n => !before.has(n));
    return { state, fresh, bodies: sent.slice(count) };
  };

  try {
    // Desktop: walk a few seconds so the report has movement, then press.
    const desk = await open('desk', { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, 'zh');
    await desk.page.keyboard.down('w'); await desk.page.waitForTimeout(3000); await desk.page.keyboard.up('w');
    await desk.page.waitForTimeout(1500);
    const box = await desk.page.$eval('.hud-perf', b => b.getBoundingClientRect().toJSON());
    assert.ok(box.left < 40 && innerBottom(box, 900) < 40, `bottom-left corner: ${JSON.stringify(box)}`);
    await desk.page.screenshot({ path: path.join(dir, 'desktop.png'), timeout: 180000 });
    await pass(`desktop button in the bottom-left corner (${Math.round(box.left)}, ${Math.round(box.top)}, ${Math.round(box.width)}×${Math.round(box.height)})`);

    // A double press while sending saves one report; the file is exactly the request.
    // Two clicks in the same moment, before React re-renders or the request returns: one report.
    let r = await report(desk.page, desk.sent, () => desk.page.evaluate(() => { const b = document.querySelector('.hud-perf'); b.click(); b.click(); }));
    assert.equal(r.state.state, 'sent', r.state.text);
    assert.equal(r.fresh.length, 1, `one file, got ${r.fresh}`); assert.equal(r.bodies.length, 1);
    const file = JSON.parse(await fs.readFile(path.join(reports, r.fresh[0]), 'utf8'));
    assert.deepEqual(file.report, JSON.parse(r.bodies[0]));
    assert.ok(r.state.text.includes(file.id.slice(0, 8)), `the button shows the id: ${r.state.text}`);
    const rep = file.report;
    assert.ok(rep.frames.rows.length > 300 && rep.seconds.length >= 5, `${rep.frames.rows.length} frames, ${rep.seconds.length} seconds`);
    assert.ok(rep.device.gpu.renderer && rep.device.userAgent && rep.device.screen.dpr, 'device');
    assert.ok(Array.isArray(rep.game.position) && rep.game.place, 'where');
    result.reports.push({ id: file.id, summary: rep.summary, gpu: rep.device.gpu.renderer, hints: rep.device.userAgentData });
    await desk.page.screenshot({ path: path.join(dir, 'desktop-sent.png'), clip: { x: 0, y: 820, width: 400, height: 80 }, timeout: 180000 });
    await pass(`desktop report ${file.id.slice(0, 8)} saved once and equal to the request; ${rep.frames.rows.length} frames, ${rep.seconds.length} seconds, ${rep.summary.fps} fps, GPU ${rep.device.gpu.renderer}`);

    // A failure says so; the next press goes through.
    await desk.page.waitForFunction(() => document.querySelector('.hud-perf')?.dataset.state === 'idle', null, { timeout: 15000 });
    await desk.page.route('**/api/mining/performance-reports', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"test"}' }));
    r = await report(desk.page, desk.sent, () => desk.page.click('.hud-perf'));
    assert.equal(r.state.state, 'failed'); assert.equal(r.fresh.length, 0);
    await desk.page.screenshot({ path: path.join(dir, 'desktop-failed.png'), clip: { x: 0, y: 820, width: 400, height: 80 }, timeout: 180000 });
    await desk.page.unroute('**/api/mining/performance-reports');
    r = await report(desk.page, desk.sent, () => desk.page.click('.hud-perf'));
    assert.equal(r.state.state, 'sent'); assert.equal(r.fresh.length, 1);
    await pass(`a failed send shows "${'failed'}" and saves nothing; the next press saves ${r.fresh[0].slice(0, 8)}`);
    await desk.page.context().close();

    // Touch phone, landscape, English: a round icon right of the thumbstick, clear of the bottom prompts, a tap sends.
    const phone = await open('phone', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 'en');
    await phone.page.waitForTimeout(1500);
    const [button, stick, bottom] = await phone.page.evaluate(() => ['.hud-perf', '.joystick', '.hud-bottom'].map(s => document.querySelector(s).getBoundingClientRect().toJSON()));
    assert.ok(button.left >= stick.right + 4 && button.bottom <= 390 && button.right <= bottom.left, `beside the stick: ${JSON.stringify({ button, stick, bottom })}`);
    assert.ok(Math.abs(button.width - button.height) < 1, 'a round icon while idle');
    await phone.page.screenshot({ path: path.join(dir, 'phone.png'), timeout: 180000 });
    r = await report(phone.page, phone.sent, () => phone.page.tap('.hud-perf'));
    assert.equal(r.state.state, 'sent', r.state.text); assert.equal(r.fresh.length, 1);
    const touch = JSON.parse(await fs.readFile(path.join(reports, r.fresh[0]), 'utf8')).report;
    assert.equal(touch.device.pointer, 'coarse');
    result.reports.push({ id: r.fresh[0].slice(0, 36), summary: touch.summary, viewport: touch.device.viewport });
    await pass(`phone: a ${Math.round(button.width)} px round icon ${Math.round(button.left - stick.right)} px right of the thumbstick; a tap saved ${r.fresh[0].slice(0, 8)} (pointer coarse, "${r.state.text}")`);
    await phone.page.context().close();
  } catch (error) {
    result.error = String(error.stack || error); console.error(error); process.exitCode = 1;
  } finally {
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(result, null, 2));
    await browser.close();
  }
})();

function innerBottom(box, height) { return height - box.bottom; }
