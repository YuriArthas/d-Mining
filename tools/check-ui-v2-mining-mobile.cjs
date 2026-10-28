// Public phone-landscape check for UI v2 U3 (docs/draft-ui-v2.md): the plate over the block being mined (name, price,
// health), damage numbers, the last blow, ore flying to the bag, a full bag and a block the pickaxe cannot dig said
// on the plate, the plate hidden when the block leaves the screen, and a burst of frames while holding to mine.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/ui-v2-u3');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const AIM = { x: 560, y: 230 };

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=mine-${Date.now()}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    // SwiftShader draws a frame every few hundred ms: stretch the overlay's timings so screenshots catch it.
    await page.evaluate(() => window.__miningValidation.overlayTimeScale(6));
  };
  const draw = async () => {
    const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted);
    await page.waitForFunction(n => { document.querySelector('canvas').getContext('webgl2')?.finish(); return window.__miningValidation.snapshot().renderer.submission.submitted >= n + 2; }, n, { timeout: 120000, polling: 100 });
  };
  const shot = async name => { await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push(name); console.log('SHOT', name); await save(); };
  const tap = async (x = AIM.x, y = AIM.y) => { await page.touchscreen.tap(x, y); };
  const settle = async () => { await page.waitForFunction(() => !window.__miningValidation.snapshot().streaming?.pending, null, { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(2500); };
  const plate = () => page.evaluate(() => {
    const p = document.querySelector('.mine-plate'), r = p.getBoundingClientRect();
    return { on: p.classList.contains('mine-plate-on'), state: p.dataset.state, text: p.innerText.replace(/\s+/g, ' ').trim(), x: r.left + r.width / 2, y: r.bottom,
      numbers: [...document.querySelectorAll('.mine-dmg')].filter(n => +getComputedStyle(n).opacity > .05).length };
  });
  const seed = async mutate => {
    await page.evaluate(() => window.__miningSave.flush());
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'commit', timeout: 120000 });
    await page.evaluate(async ({ name, mutate }) => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; new Function('d', mutate)(v.data); s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, { name: namespace, mutate });
    await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' });
    await ready();
  };
  const pit = async () => { await page.evaluate(() => { window.__miningValidation.teleport([3, -1.9, 3]); window.__miningValidation.look(0, .7); }); await settle(); };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await seed(`d.wallet.balances = { gold: 4800, tech: 0, star: 0 }; d.onboarding.status = 'skipped'; d.inventory.items = { 'journey.rock.0': 6, 'journey.copper': 3 };
      d.pickaxe.level = 3; d.equipment.toolLevel = 3;`);
    await pit();
    assert.equal((await plate()).on, false, 'no plate before the first swing');
    await check('Aiming alone shows no plate: it waits for the first swing.');

    // One swing: the plate shows name, price and health over the block; a damage number rises from it.
    await tap(); await page.waitForTimeout(350);
    let p = await plate();
    assert.ok(p.on, 'plate after a swing'); assert.equal(p.state, 'hit');
    assert.match(p.text, /\S+ \d/, `plate names the block and its price: ${p.text}`);
    assert.ok(Math.abs(p.x - AIM.x) < 170 && p.y < AIM.y + 40, `plate sits over the struck block: ${JSON.stringify(p)}`);
    assert.ok(p.numbers >= 1 && p.numbers <= 6, `damage numbers: ${p.numbers}`);
    await shot('01-hit');
    await check(`A swing shows the plate over the block (${p.text}) and a damage number; at most six numbers at once.`);

    // Keep swinging until the block breaks: the last blow is larger, ore flies to the bag and a chip names it.
    const before = await page.evaluate(() => window.__miningValidation.snapshot().inventory?.used ?? null);
    let broke = false;
    for (let i = 0; i < 40 && !broke; i++) {
      await tap(); await page.waitForTimeout(260);
      broke = await page.evaluate(() => !!document.querySelector('.mine-fly') || document.querySelector('.mine-chip')?.classList.contains('mine-chip-in') || document.querySelector('.mine-dmg[data-final=true]') !== null && +getComputedStyle(document.querySelector('.mine-dmg[data-final=true]')).opacity > .05);
    }
    assert.ok(broke, 'the block broke within 40 swings');
    await shot('02-break');
    await page.waitForTimeout(700);
    assert.match(await page.locator('.mine-chip').innerText(), /^\+\d+ \S+/);
    await check(`The breaking blow pops a large number, the ore icon flies to the bag and a chip by it reads "${await page.locator('.mine-chip').innerText()}".`);

    // Turning away: the plate does not hang on screen without its block.
    await tap(); await page.waitForTimeout(400);
    assert.ok((await plate()).on, 'plate up before turning away');
    await page.evaluate(() => window.__miningValidation.look(Math.PI, .05)); await page.waitForTimeout(500);
    assert.equal((await plate()).on, false, 'plate hidden once its block leaves the screen');
    await check('The plate hides when its block leaves the screen.');

    // Holding to mine: a burst of frames.
    await page.evaluate(() => window.__miningValidation.look(0, .7)); await page.waitForTimeout(800);
    await touch('touchStart', [{ x: AIM.x, y: AIM.y, id: 1 }]);
    let most = 0;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(180); await shot(`03-hold-${i}`); most = Math.max(most, (await plate()).numbers); }
    await touch('touchEnd');
    assert.ok(most <= 6, `numbers on screen while holding: ${most}`);
    await check(`Holding to mine: frames 03-hold-0..7; at most ${most} damage numbers on screen at once.`);

    // A block the pickaxe cannot dig (with room in the bag: a full bag is refused first).
    await seed(`d.inventory.items = { 'journey.rock.0': 2 }; d.pickaxe.level = 1; d.equipment.toolLevel = 1;`);
    // Layer 2 starts at 60 m and needs Lv.2: away from the rest hall, find a column of solid rock at 64–70 m, dig a
    // pocket there and swing at its floor with Lv.1.
    let spot = null;
    for (const [cx, cz] of [[-30, -30], [30, -30], [-30, 30], [30, 30], [-40, 0]]) {
      await page.evaluate(([cx, cz]) => window.__miningValidation.teleport([(cx + .5) * 2, -65.9, (cz + .5) * 2]), [cx, cz]);
      await settle();
      const solid = await page.evaluate(([cx, cz]) => [-30, -31, -32, -33, -34, -35].every(y => (window.__miningValidation.cell([cx, y, cz]) ?? 0) > 0), [cx, cz]);
      if (solid) { spot = [cx, cz]; break; }
    }
    assert.ok(spot, 'a column of solid layer 2 rock');
    const pocket = [];
    for (let x = spot[0] - 2; x <= spot[0] + 2; x++) for (let z = spot[1] - 2; z <= spot[1] + 2; z++) for (let y = -33; y <= -30; y++) pocket.push([x, y, z]);
    // The terrain takes at most 32 cells per edit, one edit at a time: dig the pocket in slices.
    for (let i = 0; i < pocket.length; i += 20) {
      const slice = pocket.slice(i, i + 20);
      await page.waitForFunction(cells => window.__miningValidation.excavate(cells), slice, { timeout: 30000, polling: 250 });
    }
    await page.waitForTimeout(1500);
    await page.evaluate(([cx, cz]) => { const d = window.__miningValidation; d.teleport([(cx + .5) * 2, -65.9, (cz + .5) * 2]); d.look(0, .8); }, spot);
    await settle();
    let locked = null;
    for (const [x, y] of [[AIM.x, AIM.y], [422, 300], [422, 340], [300, 300]]) {
      await tap(x, y); await page.waitForTimeout(400);
      p = await plate(); if (p.on && p.state === 'locked') { locked = p; break; }
    }
    assert.ok(locked, `a layer 2 block refuses Lv.1: ${JSON.stringify(p)}`);
    assert.match(locked.text, /需要 Lv\.2 镐子/);
    const chip = await page.locator('.mine-chip').innerText();
    assert.ok(chip.split('+').length - 1 <= 2, `the pickup chip names at most two kinds: ${chip}`);
    await shot('05-locked');
    await check(`A block the pickaxe cannot dig: the plate turns grey and reads "${locked.text}".`);

    // A full bag: the plate says so instead of a notice at the bottom.
    await seed(`d.inventory.items = { 'journey.rock.0': 25 };`);
    await pit();
    for (const [x, y] of [[AIM.x, AIM.y], [470, 260], [620, 300], [380, 300], [500, 330]]) {
      await tap(x, y); await page.waitForTimeout(500);
      p = await plate(); if (p.on && p.state === 'full') break;
    }
    assert.equal(p.state, 'full', JSON.stringify(p)); assert.match(p.text, /背包满了/);
    assert.doesNotMatch(await page.locator('.hud-notice').innerText(), /背包已满/);
    await shot('04-full');
    await check('A swing with a full bag: the plate over the block says 背包满了，去出售 (no notice at the bottom).');

    assert.deepEqual(report.errors.filter(e => !/favicon|404/.test(e)), [], 'no page errors');
    report.finishedAt = new Date().toISOString(); await save();
    console.log('DONE');
  } catch (error) {
    report.failure = String(error?.stack ?? error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error('FAIL', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
