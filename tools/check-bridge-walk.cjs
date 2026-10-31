const localTools = require('./local-tools.cjs');
// Public desktop check of the creek bridge: walk the character across with the keyboard on several lanes in
// both directions, sample the feet every few frames and compare them with the deck profile (the raised-cosine
// arch in surface-game-art/layout.json `bridge`). Saves a screenshot at the south end of the deck, where the
// old bridge let the feet sink into its slab. Seeds only an isolated acceptance save.
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/bridge-walk');
const bridge = require('../surface-game-art/layout.json').bridge;
// Board tops follow chords of this curve (within 7 mm) 0.012 m above the path at the ends.
const deck = z => { const u = Math.max(-1, Math.min(1, (z - bridge.z) / bridge.halfSpan)); return .047 + bridge.rise * (1 + Math.cos(Math.PI * u)) / 2; };
const LANES = JSON.parse(process.env.LANES || '[-1.8,-0.9,0,0.9,1.8]');

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public desktop Chromium (1600×900, DPR 1, SwiftShader).', bridge, walks: [], errors: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const snap = () => page.evaluate(() => { const s = window.__miningValidation.snapshot(); return { feet: s.position, grounded: s.grounded }; });
  try {
    await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=bridge-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen')) || document.body.innerText.includes('暂时没能进入矿场'), null, { timeout: 300000 });
    const failed = await page.evaluate(() => document.body.innerText.includes('暂时没能进入矿场') ? document.body.innerText.slice(0, 300) : null);
    if (failed) throw new Error('load failed: ' + failed);
    await page.mouse.click(1100, 260); await page.waitForTimeout(500);
    for (const heading of [-1, 1]) for (const x of LANES) {
      const start = bridge.z - heading * (bridge.halfSpan + 3.5), goal = bridge.z + heading * (bridge.halfSpan + 1.5);
      // Trips are animated: wait until the character stands at the start, then free the keyboard from any
      // focused button (the game ignores keys aimed at buttons).
      await page.evaluate(([at, yaw]) => { window.__miningValidation.teleport(at); window.__miningValidation.look(yaw, .42); }, [[x, .3, start], heading < 0 ? 0 : Math.PI]);
      await page.waitForFunction(([x, z]) => { const s = window.__miningValidation.snapshot(); return s.ready && s.grounded && Math.hypot(s.position[0] - x, s.position[2] - z) < .5; }, [x, start], { timeout: 60000, polling: 100 });
      await page.evaluate(yaw => { window.__miningValidation.look(yaw, .42); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }, heading < 0 ? 0 : Math.PI);
      await page.waitForTimeout(500);
      const walk = { lane: x, heading: heading < 0 ? 'north' : 'south', samples: 0, onDeck: 0, airborne: 0, lowest: Infinity, worst: null, reached: false };
      await page.keyboard.down('KeyW');
      let shotAt = heading < 0 && x === LANES[0] ? bridge.z + bridge.halfSpan - .3 : null;
      for (let t = Date.now(); Date.now() - t < 40000;) {
        const { feet, grounded } = await snap();
        walk.samples++;
        if (Math.abs(feet[2] - bridge.z) < bridge.halfSpan && Math.abs(feet[0] - bridge.x) < 2.2) {
          walk.onDeck++; if (!grounded) walk.airborne++;
          const gap = feet[1] - deck(feet[2]);
          if (gap < walk.lowest) { walk.lowest = gap; walk.worst = feet; }
        }
        if (shotAt !== null && feet[2] < shotAt) {
          await page.keyboard.up('KeyW'); await page.waitForTimeout(900);
          await page.addStyleTag({ content: '.ui-hud,.hud-debug-tools,.joystick,.jump-button{display:none!important}' });
          await page.screenshot({ path: path.join(dir, 'south-end.png'), timeout: 120000 });
          const rest = await snap(); walk.shot = { feet: rest.feet, deck: deck(rest.feet[2]) };
          await page.keyboard.down('KeyW');
          shotAt = null;
        }
        if ((goal - feet[2]) * heading <= 0) { walk.reached = true; break; }
        await page.waitForTimeout(40);
      }
      await page.keyboard.up('KeyW');
      report.walks.push(walk); await save();
      console.log(`lane ${x} ${walk.heading}: reached ${walk.reached}, ${walk.onDeck} deck samples, lowest feet ${(walk.lowest * 100).toFixed(1)} cm from the deck, airborne ${walk.airborne}`);
    }
    for (const w of report.walks) {
      assert.ok(w.reached, `lane ${w.lane} ${w.heading} did not cross`);
      assert.ok(w.onDeck > 5, `lane ${w.lane} ${w.heading}: too few samples on the deck`);
      assert.ok(w.lowest > -.01, `lane ${w.lane} ${w.heading}: feet ${(w.lowest * 100).toFixed(1)} cm below the deck at ${w.worst}`);
    }
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
    await page.screenshot({ path: path.join(dir, 'failure.png'), timeout: 120000 }).catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
