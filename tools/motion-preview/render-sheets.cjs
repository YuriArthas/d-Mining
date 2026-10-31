const localTools = require('../local-tools.cjs');
// Authoring aid for the code-authored miner motions (src/game/presentation/minerMotions.ts).
// Renders the real MinerAvatar frame by frame into contact sheets; final acceptance still happens on
// the public build (tools/check-miner-motion-mobile.cjs).
//   npx vite --port 5199 --strictPort --host 127.0.0.1      (from the repository root)
//   node tools/motion-preview/render-sheets.cjs artifacts/motion/v1 '[["swing",{"speed":2}],["jump",{"run":6}]]'
// swing options: speed, every, count, columns, viewNames (side/front/game/back), target, hold (frames of repeated hits)
// jump options: every, count, columns, viewNames, run (m/s)
const { chromium } = localTools.playwright();
(async () => {
  const [prefix, specJson] = process.argv.slice(2);
  const specs = JSON.parse(specJson);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5199/tools/motion-preview/preview.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 }).catch(e => { console.log(errors); throw e; });
  let i = 0;
  for (const [fn, args] of specs) {
    const diag = await page.evaluate(([fn, args]) => window[fn](args), [fn, args]);
    const out = `${prefix}-${i++}-${fn}.png`;
    await page.locator('#wrap').screenshot({ path: out });
    console.log(out, JSON.stringify({ mining: diag.mining, air: diag.air }));
  }
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})();
