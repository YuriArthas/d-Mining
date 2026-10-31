const localTools = require('./local-tools.cjs');
// Public phone-landscape check (2026-10-31): going down the mine compiles no shader. The user felt a one-time hitch on
// entering the mine and each layer below. The loading screen compiles every program on the surface, and the surface
// to underground switches changed every material's program: daylight off at 30 m (scene.environment dropped) and the
// cave fog from the first hall down; and each hall's materials compiled again on first sight underground.
// Steps: a pocket at 34 m (no daylight, no fog yet), then every hall of the three worlds, turning round at each; counts the
// renderer's programs before and after every step.
// node tools/check-descent-shaders-mobile.cjs   (BASELINE=1 only reports, without asserting)
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/descent-shaders');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', steps: [], errors: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('crash', () => report.errors.push('the page crashed'));
  const programs = () => page.evaluate(() => window.__miningValidation.snapshot().renderer.programs);
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2500); };
  const frames = async () => { for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  /** Go there, look round in four directions, and count the programs compiled on the way. */
  const step = async (name, go) => {
    let before = await programs();
    await go(); await settle();
    // A later world's first trip compiles its scene behind the travel notice: count only what came after that.
    const warmed = await page.evaluate(() => window.__miningValidation.snapshot().startup.worldWarmups);
    const warmup = warmed.find(w => !report.steps.some(s => s.warmup?.world === w.world));
    if (warmup) before = warmup.programs;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { await page.evaluate(yaw => window.__miningValidation.look(yaw, .25), yaw); await frames(); }
    // A picture facing the same way at every run, to compare the light before and after a change.
    await page.evaluate(() => window.__miningValidation.look(Math.PI, .25)); await frames(); await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(dir, `${String(report.steps.length + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`), timeout: 180000 });
    const after = await programs(), snap = await page.evaluate(() => { const s = window.__miningValidation.snapshot(); return { position: s.position.map(v => +v.toFixed(1)), ready: s.ready }; });
    report.steps.push({ name, before, after, compiled: after - before, ...snap, ...(warmup && { warmup }) }); await save();
    console.log(`${name}: ${after - before} programs compiled (${before} → ${after}) at ${snap.position}${warmup ? ` · on the way, behind the travel notice: ${warmup.newPrograms} programs for ${warmup.objects} objects in ${Math.round(warmup.ms)} ms` : ''}`);
    return after - before;
  };
  try {
    await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=descent-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    report.loading = await page.evaluate(() => window.__miningValidation.snapshot().startup ?? null);
    // The surface first, all the way round: what the loading screen compiled.
    const surface = await step('surface', async () => {});
    // A pocket dug at 32-36 m beside the mine (the first layer, past the daylight's fade at 30 m).
    const [cx, cz] = [-30, -30];
    const shaft = await step('34 m, no daylight', async () => {
      await page.evaluate(([cx, cz]) => window.__miningValidation.teleport([(cx + .5) * 2, -1.9, (cz + .5) * 2]), [cx, cz]);
      await settle();
      const pocket = [];
      for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) for (let y = -17; y <= -16; y++) pocket.push([x, y, z]);
      for (let i = 0; i < pocket.length; i += 20) await page.waitForFunction(cells => window.__miningValidation.excavate(cells), pocket.slice(i, i + 20), { timeout: 30000, polling: 250 });
      await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.pendingEdit && !s.inFlight && !s.queue; }, null, { timeout: 120000, polling: 250 });
      await page.evaluate(([cx, cz]) => window.__miningValidation.teleport([(cx + .5) * 2, -33.9, (cz + .5) * 2]), [cx, cz]);
    });
    // Every world open (the unlock page's 全部解锁); a later world's base and halls load on the first trip there.
    await page.locator('.dev-unlock-button').tap(); await page.getByRole('button', { name: '全部解锁' }).tap(); await page.getByRole('button', { name: '关闭' }).tap();
    /** A trip there: wait for the arrival (a later world loads first), once more if the player is not there. */
    const travel = async at => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.evaluate(at => window.__miningValidation.teleport(at), at);
        await page.waitForTimeout(500);
        await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.travelling && s.ready; }, null, { timeout: 300000 });
        const now = await page.evaluate(() => window.__miningValidation.snapshot().position);
        if (Math.hypot(now[0] - at[0], now[1] - at[1], now[2] - at[2]) < 3) return;
      }
      throw Error(`could not reach ${at}`);
    };
    const rooms = await page.evaluate(() => window.__miningValidation.snapshot().content.worldRooms);
    assert.equal(rooms.length, 18, 'six halls in each of the three worlds');
    const halls = [];
    for (const room of rooms) {
      // A later world: its base first, where the trip lands (the halls load with it).
      if (room.world > 1 && !halls.some(([id]) => id === `world ${room.world} base`))
        halls.push([`world ${room.world} base`, await step(`world ${room.world} base`, () => travel([0, .1, room.spawn[2] - 12 + 46]))]);
      halls.push([room.id, await step(`hall ${room.id}`, () => travel(room.spawn))]);
    }
    report.summary = { surface, shaft, halls: Object.fromEntries(halls) };
    report.finishedAt = new Date().toISOString(); await save();
    if (!process.env.BASELINE) {
      assert.equal(shaft, 0, 'no program compiled where the daylight ends');
      for (const [id, n] of halls) assert.equal(n, 0, `no program compiled arriving at ${id}`);
      assert.deepEqual(report.errors, []);
      console.log('PASS Going down past the daylight, to the other worlds\' bases and into every hall of the three worlds compiles no shader program.');
    }
  } catch (error) {
    report.failure = String(error?.stack || error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
