// Public phone-landscape comparison of surface lighting tones. Renders the same daytime views with
// several light settings (applied live through the debug hook, no reload) and writes one image per
// view and variant plus colour statistics. Seeds only an isolated acceptance save.
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/lighting-tone');
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// Desktop by default (the current art checks are desktop only); DEVICE=mobile keeps the phone emulation.
const MOBILE = process.env.DEVICE === 'mobile';
const SUN = [-35, 60, 35];
// null keeps the game's own values. Each variant may set day light values and exposure.
const VARIANTS = JSON.parse(process.env.VARIANTS || 'null') ?? {
  current: null,
  sample: { exposure: 1, day: { moonPosition: SUN, moonColor: '#fff5de', moonIntensity: 3, skyColor: '#b5daff', groundColor: '#667b93', ambientIntensity: 0.55, environmentIntensity: 0.35 } },
  matte: { exposure: 1, day: { moonPosition: SUN, moonColor: '#fff5de', moonIntensity: 3, skyColor: '#b5daff', groundColor: '#667b93', ambientIntensity: 0.85, environmentIntensity: 0.1 } },
  warm: { exposure: 1, day: { moonPosition: SUN, moonColor: '#fff0d6', moonIntensity: 3.1, skyColor: '#d6e6f0', groundColor: '#8f8a68', ambientIntensity: 0.6, environmentIntensity: 0.25 } },
};
const VIEWS = JSON.parse(process.env.VIEWS || 'null') ?? [
  { name: 'spawn', label: '出生点看矿井', at: [0, 0.1, 47], yaw: 0, pitch: 0.34 },
  { name: 'services', label: '广场看出售和商店', at: [0, 0.1, 20], yaw: Math.PI / 2, pitch: 0.3 },
  { name: 'eggs', label: '广场看蛋台', at: [8, 0.1, 20], yaw: -Math.PI / 2, pitch: 0.3 },
  { name: 'reverse', label: '广场反向看出生点', at: [0, 0.1, 18], yaw: Math.PI, pitch: 0.3 },
];

(async () => {
  await fs.mkdir(dir, { recursive: true });
  const report = { url: base, startedAt: new Date().toISOString(), tier: MOBILE ? 'Public mobile Chromium emulation (Android UA, touch, landscape 844×390, DPR 2, SwiftShader). Colour judgement needs a real screen.' : 'Public desktop Chromium (1600×900, DPR 1, SwiftShader). Colour judgement needs a real screen.', variants: VARIANTS, views: VIEWS, shots: [], errors: [] };
  const save = () => fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext(MOBILE ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: UA } : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  const snap = () => page.evaluate(() => window.__miningValidation.snapshot());
  const draw = async (frames = 4) => {
    const n = (await snap()).renderer.submission.submitted;
    await page.waitForFunction(([n, f]) => window.__miningValidation.snapshot().renderer.submission.submitted >= n + f, [n, frames], { timeout: 120000, polling: 250 });
  };
  const press = (x, y) => MOBILE ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  const tap = async locator => { await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox(); assert.ok(r, 'tap target visible'); await press(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(400); };
  try {
    await page.goto(`${base}?debug=1&submission=fenced&framesInFlight=1&saveTest=tone-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    // A failed load shows the retry screen: stop at once with its message instead of waiting it out.
    await page.waitForFunction(() => (window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen')) || document.body.innerText.includes('暂时没能进入矿场'), null, { timeout: 300000 });
    const failed = await page.evaluate(() => document.body.innerText.includes('暂时没能进入矿场') ? document.body.innerText.slice(0, 300) : null);
    if (failed) throw new Error('load failed: ' + failed);
    await press(MOBILE ? 600 : 1100, MOBILE ? 120 : 260); await page.waitForTimeout(500);
    // Fixed time of day through the debug setting (auto → day → night).
    const time = process.env.TIME === 'night' ? '夜晚' : '白天';
    await tap(page.getByRole('button', { name: '设置', exact: true }).first());
    await tap(page.getByRole('button', { name: /^昼夜：/ }).first());
    if (time === '夜晚') await tap(page.getByRole('button', { name: /^昼夜：/ }).first());
    await page.getByRole('button', { name: `昼夜：${time}` }).waitFor();
    await press(MOBILE ? 420 : 800, MOBILE ? 200 : 450); await page.waitForTimeout(400);
    await page.addStyleTag({ content: '.ui-hud,.hud-debug-tools,.joystick,.jump-button{display:none!important}' });
    for (const view of VIEWS) {
      await page.evaluate(v => { window.__miningValidation.teleport(v.at); window.__miningValidation.look(v.yaw, v.pitch); }, view);
      await page.waitForTimeout(2500); await draw(6);
      for (const [name, look] of Object.entries(VARIANTS)) {
        await page.evaluate(look => window.__miningValidation.lightingLook(look), look);
        await page.evaluate(v => window.__miningValidation.look(v.yaw, v.pitch), view);
        await page.waitForTimeout(700); await draw(5);
        const file = `${view.name}-${name}.png`;
        await page.screenshot({ path: path.join(dir, file), timeout: 120000 });
        report.shots.push({ view: view.name, variant: name, file }); await save();
        console.log('SHOT', file);
      }
    }
    await page.evaluate(() => window.__miningValidation.lightingLook(null));
  } catch (error) {
    report.errors.push(`script: ${error.stack || error.message}`); console.error(error); process.exitCode = 1;
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString(); await save(); await browser.close();
  }
})();
