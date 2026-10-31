const localTools = require('./local-tools.cjs');
// Public phone-landscape check (2026-10-31): selling throws the sale's coins into the money counter. The user asked
// for coins to pop out on a sale. A bag of ore, then 出售 on the HUD (a trip to the sell ring): "+N" over the miner,
// the coins burst out of the miner and fly one after another into the counter, which holds the old money until the
// first lands and reaches the new money with the last. Then once more at real speed: nothing is left behind.
// Timings are stretched (overlayTimeScale) so the screenshots on SwiftShader, about a frame a second, catch each phase.
// node tools/check-sale-coins-mobile.cjs
const { chromium } = localTools.playwright();
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = localTools.gameUrl();
const dir = path.resolve(process.env.ARTIFACT_DIR || 'output/sale-coins');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SLOW = 8;
(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Not a physical phone.', checks: [], errors: [], screenshots: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const check = async text => { report.checks.push(text); console.log('PASS', text); await save(); };
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('crash', () => report.errors.push('the page crashed'));
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const ready = async () => {
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.hud-debug-tools{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  };
  const shot = async (name, label) => { await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 }); report.screenshots.push({ name, label }); console.log('SHOT', name, label); await save(); };
  const tap = async locator => { const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const counter = () => page.locator('[data-testid=coins]').innerText();
  /** Notes, in the page, when the coins appear, when each one lands (leaves) and when the counter changes. */
  const probe = () => page.evaluate(() => {
    const p = window.__saleProbe = { start: null, landings: [], counter: [] }, value = document.querySelector('[data-testid=coins]');
    new MutationObserver(records => {
      const now = performance.now();
      for (const r of records) {
        if ([...r.addedNodes].some(n => n.classList?.contains('sale-coin')) && p.start === null) p.start = now;
        for (const n of r.removedNodes) if (n.classList?.contains('sale-coin')) p.landings.push(now);
      }
    }).observe(document.querySelector('.mining-overlay'), { childList: true });
    new MutationObserver(() => p.counter.push([performance.now(), value.textContent])).observe(value, { childList: true, subtree: true, characterData: true });
  });
  /** What the probe saw, in ms from the coins' appearance. */
  const timings = () => page.evaluate(() => {
    const p = window.__saleProbe, at = t => Math.round(t - p.start), final = p.counter.at(-1)?.[1];
    return { landed: p.landings.length, firstLanding: at(p.landings[0]), lastLanding: at(p.landings.at(-1)),
      counterMoved: at(p.counter[0][0]), counterDone: at(p.counter.find(([, v]) => v === final)[0]) };
  });
  /** Fills the bag in the saved game, then reloads it. */
  const fill = async (url, namespace) => {
    await page.evaluate(() => window.__miningSave.flush());
    await page.goto(localTools.publicRoot(), { waitUntil: 'domcontentloaded' });
    await page.evaluate(async name => {
      const db = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
      await new Promise((resolve, reject) => {
        const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
        q.onsuccess = () => { const v = q.result; v.data.inventory.items = { 'journey.copper': 18, 'journey.rock.0': 12 }; s.put(v, 'main'); };
        t.oncomplete = resolve; t.onabort = () => reject(t.error);
      });
      db.close();
    }, namespace);
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    await page.evaluate(() => { window.__miningValidation.teleport([6, .1, 40]); window.__miningValidation.look(Math.PI, .3); });
    await page.waitForTimeout(2500);
  };
  try {
    const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=sale-coins-${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
    const namespace = await page.evaluate(() => window.__miningSave.namespace);
    const again = url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split('store-')[1] ?? namespace.split(':').pop()}`);
    await fill(again, namespace);
    const bag = (await snap()).economy.inventory;
    assert.equal(bag.used, 30, 'thirty ore in the bag');
    const quote = (await snap()).economy.sale.coins, before = await counter();
    await shot('01-full-bag', `a bag of ore, ${before} in the counter, about to sell for ${quote}`);

    // Slowed eight times, first only timed: a screenshot takes seconds here and holds the page, so this run takes none
    // and the page itself notes when the coins appear, when each lands and when the counter changes.
    await page.evaluate(scale => window.__miningValidation.overlayTimeScale(scale), SLOW);
    await probe();
    await tap(page.getByRole('button', { name: '传送到售卖圈出售' }));
    await page.waitForFunction(() => document.querySelectorAll('.sale-coin').length > 0, null, { timeout: 60000, polling: 50 });
    const burst = await page.evaluate(() => ({ coins: document.querySelectorAll('.sale-coin').length, gain: document.querySelector('.sale-gain')?.innerText }));
    const sold = (await snap()).economy.coins;
    assert.equal(sold, quote, 'the bag sold for its quote');
    assert.ok(burst.coins >= 6 && burst.coins <= 14, `six to fourteen coins (${burst.coins})`);
    assert.equal(burst.gain.replace(/\s/g, ''), `+${quote}`, '"+N" over the miner');
    await page.waitForFunction(() => !document.querySelector('.sale-coin'), null, { timeout: 90000, polling: 100 });
    await page.waitForTimeout(1500);
    assert.equal(await counter(), String(sold), 'the counter reaches the new money with the last coin');
    const slow = await timings();
    report.sale = { quote, before, sold, coins: burst.coins, gain: burst.gain, slowedTimes: SLOW, ...slow };
    // Planned, from the sale: the first lands at 0.88 s and the last 0.62 s later, each times eight (7.0 s and 12.0 s).
    // On SwiftShader a frame takes about a second, so a change shows up to a frame or two late.
    assert.equal(slow.landed, burst.coins, 'every coin lands');
    assert.ok(slow.firstLanding > 880 * SLOW * .85, `the first lands about 7 s after the burst (${slow.firstLanding} ms)`);
    assert.ok(slow.lastLanding - slow.firstLanding > 620 * SLOW * .6, `one after another over about 5 s (${slow.firstLanding} to ${slow.lastLanding} ms)`);
    assert.ok(slow.counterMoved >= slow.firstLanding - 1200, `the counter holds the old money until the first lands (moved ${slow.counterMoved} ms, first landed ${slow.firstLanding} ms)`);
    assert.ok(Math.abs(slow.counterDone - slow.lastLanding) < 2500, `and reaches the new money with the last (${slow.counterDone} ms, last landed ${slow.lastLanding} ms)`);
    await check(`Selling a bag of 30 ore (${quote}): "+${quote}" over the miner, ${burst.coins} coins burst out of it and fly into the counter. Slowed ${SLOW}× (planned 7.0 s and 12.0 s): the first landed at ${(slow.firstLanding / 1000).toFixed(1)} s and the last at ${(slow.lastLanding / 1000).toFixed(1)} s; the counter held ${before} until ${(slow.counterMoved / 1000).toFixed(1)} s and read ${sold} at ${(slow.counterDone / 1000).toFixed(1)} s.`);

    // The same, slowed, for the pictures.
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 46]));
    await page.waitForTimeout(2000);
    await fill(again, namespace);
    await page.evaluate(scale => window.__miningValidation.overlayTimeScale(scale), SLOW);
    await probe();
    await tap(page.getByRole('button', { name: '传送到售卖圈出售' }));
    await page.waitForFunction(() => document.querySelectorAll('.sale-coin').length > 0, null, { timeout: 60000, polling: 50 });
    await shot('02-burst', `${burst.coins} coins burst out of the miner, "+${quote}" over the head`);
    await shot('03-hanging', `they hang round the miner; the counter still reads ${sold}`);
    // Slowed, the coins leave from 3.2 s and land from 7.0 s to 12.0 s.
    await page.waitForFunction(() => performance.now() - window.__saleProbe.start > 6500, null, { timeout: 60000, polling: 100 });
    await shot('04-flying', 'one after another along a curve into the counter');
    await page.waitForFunction(() => !document.querySelector('.sale-coin'), null, { timeout: 90000, polling: 100 });
    await page.waitForTimeout(1500);
    await shot('05-landed', `all landed: ${(await snap()).economy.coins} in the counter`);

    // At real speed: the whole flourish is over in about a second and a half and leaves nothing behind.
    await page.evaluate(() => window.__miningValidation.overlayTimeScale(1));
    await page.evaluate(() => window.__miningValidation.teleport([0, .1, 46]));
    await page.waitForTimeout(2000);
    await fill(again, namespace);
    const quote2 = (await snap()).economy.sale.coins, money = (await snap()).economy.coins;
    await probe();
    await tap(page.getByRole('button', { name: '传送到售卖圈出售' }));
    await page.waitForFunction(() => window.__saleProbe.start !== null, null, { timeout: 60000, polling: 50 });
    await page.waitForFunction(() => !document.querySelector('.sale-coin'), null, { timeout: 30000, polling: 50 });
    await page.waitForTimeout(1500);
    const real = await timings(), ms = real.lastLanding;
    report.realSpeed = real;
    assert.ok(ms < 1500 + 2500, `all in within a frame or two of 1.5 s (${ms} ms)`);
    assert.equal((await snap()).economy.coins, money + quote2);
    assert.ok(real.counterMoved >= real.firstLanding - 1200, `the counter waits for the first coin at real speed too (${real.counterMoved} ms, first landed ${real.firstLanding} ms)`);
    assert.equal(await counter(), String(money + quote2));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sale-gain')).opacity), '0', 'the "+N" is gone');
    await check(`At real speed the last coin landed ${(ms / 1000).toFixed(1)} s after they appeared (1.5 s planned, on a renderer at about a frame a second), the counter read ${money + quote2}, and nothing is left on screen.`);
    assert.deepEqual(report.errors, []);
    report.finishedAt = new Date().toISOString(); await save();
    console.log('PASS Selling throws the coins into the counter.');
  } catch (error) {
    report.failure = String(error?.stack || error); await save();
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
