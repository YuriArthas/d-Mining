// Public check for worlds 2 and 3 (docs/phase-world-look-20261028.md): standing in each world's sell ring, shop ring,
// teleport station pad, world portal pad and before one of its eggs turns the matching service on, and nothing
// blocks the way to them (the player ends up standing there, not pushed off by a collider).
const { chromium } = require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html';
const dir = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/world-look/services');
fs.mkdirSync(dir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const result = { checks: [] };
  // The services' rings as the game places them (src/game/content/gameContent.ts).
  const { GAME_CONTENT } = await import(path.resolve(__dirname, '../src/game/content/gameContent.ts'));
  const session = GAME_CONTENT.session;
  const pass = text => { result.checks.push(text); console.log('PASS', text); fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(result, null, 2)); };
  try {
    await page.goto(`${base}?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=services-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), null, { timeout: 300000 });
    await page.click('.dev-unlock-button'); await page.getByRole('button', { name: '全部解锁' }).click(); await page.getByRole('button', { name: '关闭' }).click();
    const zones = await page.evaluate(() => { const c = window.__miningValidation.snapshot().content; return { portals: c.portals, stations: c.stations, eggs: c.eggStations }; });
    // Walk-in spots: the zone's centre; the session flags read after the arrival settles.
    const visit = async (feet, label, flag) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.evaluate(f => window.__miningValidation.teleport(f), feet);
        await page.waitForTimeout(500);
        await page.waitForFunction(() => { const s = window.__miningValidation.snapshot(); return !s.travelling && s.ready; }, null, { timeout: 180000 });
        await page.waitForTimeout(1500);
        const s = await page.evaluate(() => { const v = window.__miningValidation.snapshot(); return { at: v.position, e: v.economy }; });
        if (Math.hypot(s.at[0] - feet[0], s.at[2] - feet[2]) > 15) continue;
        assert.ok(Math.hypot(s.at[0] - feet[0], s.at[2] - feet[2]) < .6, `${label}: pushed away to ${s.at}`);
        assert.ok(flag(s.e), `${label}: service not on (${JSON.stringify({ inSellZone: s.e.inSellZone, atStation: s.e.atStation, atPortal: s.e.atPortal, egg: s.e.eggStation?.eggId, shop: s.e.shopId })})`);
        pass(`${label} at ${s.at.map(v => v.toFixed(1))}`);
        return;
      }
      throw Error(`${label}: never arrived at ${feet}`);
    };
    for (const world of [2, 3]) {
      const z0 = world === 2 ? 224 : 448;
      const portal = zones.portals.find(p => p.worldId === world).zone, station = zones.stations.find(p => p.worldId === world).zone;
      await visit([station.x, (station.y ?? 0) + .1, station.z], `world ${world}: the teleport station pad`, e => e.atStation);
      await visit([portal.x, (portal.y ?? 0) + .1, portal.z], `world ${world}: the world portal pad`, e => e.atPortal);
      const egg = zones.eggs.filter(s => Math.abs(s.zone.z - z0 - 50) < 30).sort((a, b) => a.zone.x - b.zone.x)[0];
      await visit([egg.zone.x, .1, egg.zone.z], `world ${world}: before the egg ${egg.eggId}`, e => e.eggStation?.eggId === egg.eggId);
      const near = z => Math.abs(z.z - z0 - 30) < 40;
      const sale = session.sales.find(near), shop = session.shops.map(s => s.zone).find(near);
      await visit([sale.x, .1, sale.z], `world ${world}: the sell ring`, e => e.inSellZone);
      await visit([shop.x, .1, shop.z], `world ${world}: the shop ring`, e => !!e.shopId);
    }
  } catch (error) { result.error = String(error.stack || error); console.error(error); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(result, null, 2)); await browser.close(); }
})();
