// How bright the player and the pets read from every side, on the public build (characterFill.ts, 2026-10-29).
// The player with two pets stands on open sand at the spawn; the camera goes round in 8 steps (135° looks straight
// into the sun). Each view is shot three times: as is, the player's material black, the pets' black; the pixels
// that change are the figure's, and their mean value (max RGB) is its brightness. FILLS=off,default,strong picks
// the fill settings to compare (debug hook characterFill).
// node tools/check-character-light.cjs <outdir>
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const { createCanvas, loadImage } = require('../surface-game-art/node_modules/@napi-rs/canvas');
const fs = require('node:fs'), path = require('node:path');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const out = path.resolve(process.argv[2] || 'artifacts/character-light'); fs.mkdirSync(out, { recursive: true });
const FILLS = { off: { bounce: 1, view: 0 }, default: null, strong: { bounce: 3.6, view: 1.8 } };
const pick = (process.env.FILLS || 'off,default').split(',');
const FEET = process.env.FEET ? JSON.parse(process.env.FEET) : [0, .1, 44];

async function pixels(file) {
  const img = await loadImage(file), c = createCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, img.width, img.height).data;
}
function figure(a, black) {
  let sum = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) {
    const va = Math.max(a[i], a[i + 1], a[i + 2]), vb = Math.max(black[i], black[i + 1], black[i + 2]);
    if (va - vb > 20) { sum += va; n++; }
  }
  return n > 200 ? +(sum / n / 255).toFixed(3) : null;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  const url = `${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=light-${Date.now()}`;
  const ready = () => page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready();
  // Two pets out (saved in the browser's store, then a reload).
  await page.evaluate(() => window.__miningSave.flush());
  const namespace = await page.evaluate(() => window.__miningSave.namespace);
  await page.goto('https://w-sunjun-public.dev.clock-p.com/', { waitUntil: 'commit' });
  await page.evaluate(async name => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res, rej) => { const t = db.transaction('progress', 'readwrite'), s = t.objectStore('progress'), q = s.get('main');
      q.onsuccess = () => { const v = q.result, d = v.data; d.onboarding.status = 'skipped';
        d.pets.inventory.pets = [['a', 'amber-fox'], ['b', 'crystal-owl']].map(([id, speciesId]) => ({ id, speciesId, level: 1 })); d.pets.equipment.slots = ['a', 'b', null]; s.put(v, 'main'); };
      t.oncomplete = res; t.onabort = () => rej(t.error); });
    db.close();
  }, namespace);
  await page.goto(url.replace(/saveTest=[^&]+/, `saveTest=${namespace.split(':').pop()}`), { waitUntil: 'domcontentloaded' }); await ready();
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
  await page.evaluate(f => { const v = window.__miningValidation; v.teleport(f); v.cameraDistance(4.6); }, FEET);
  await page.waitForTimeout(4000);
  const frame = async () => { const n = await page.evaluate(() => window.__miningValidation.snapshot().renderer.submission.submitted); await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted >= n + 2, n, { timeout: 120000 }); };
  const result = {};
  for (const fill of pick) {
    await page.evaluate(f => window.__miningValidation.characterFill(f), FILLS[fill]);
    result[fill] = [];
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4 - Math.PI / 4, deg = Math.round(yaw * 180 / Math.PI);
      await page.evaluate(y => window.__miningValidation.look(y, .12), yaw); await page.waitForTimeout(1200); await frame();
      const shots = {};
      for (const [tag, rule] of [['as-is', null], ['player-black', '^tripo_material'], ['pets-black', '^Pet (body|face)$']]) {
        await page.evaluate(r => window.__miningValidation.materialTint(r ? [{ match: r, color: [0, 0, 0] }] : null), rule); await frame();
        const file = path.join(out, `${fill}-${deg}-${tag}.png`); await page.screenshot({ path: file, timeout: 180000 }); shots[tag] = await pixels(file);
      }
      await page.evaluate(() => window.__miningValidation.materialTint(null));
      const row = { yaw: deg, player: figure(shots['as-is'], shots['player-black']), pets: figure(shots['as-is'], shots['pets-black']) };
      result[fill].push(row); console.log(fill, JSON.stringify(row));
    }
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  for (const [fill, rows] of Object.entries(result)) for (const who of ['player', 'pets']) {
    const v = rows.map(r => r[who]).filter(x => x != null);
    console.log(`${fill} ${who}: min ${Math.min(...v)} max ${Math.max(...v)} ratio ${(Math.min(...v) / Math.max(...v)).toFixed(2)}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
