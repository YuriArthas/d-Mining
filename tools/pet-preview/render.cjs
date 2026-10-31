const localTools = require('../local-tools.cjs');
// Authoring aid for the pet art: 3D model sheet and UI portrait sheet, one egg per row (progression order).
//   npx vite --port 5199 --strictPort --host 127.0.0.1      (from the repository root)
//   node tools/pet-preview/render.cjs artifacts/pets
const { chromium } = localTools.playwright();
const fs = require('node:fs'), path = require('node:path');
(async () => {
  const dir = path.resolve(process.argv[2] || 'artifacts/pets'); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5199/tools/pet-preview/index.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const models = await page.evaluate(() => window.modelSheet());
  fs.writeFileSync(path.join(dir, 'models.png'), Buffer.from(models.url.split(',')[1], 'base64'));
  const portraits = await page.evaluate(() => window.portraitSheet());
  fs.writeFileSync(path.join(dir, 'portraits.png'), Buffer.from(portraits.split(',')[1], 'base64'));
  console.log('rows', models.eggs.join(' '));
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})();
