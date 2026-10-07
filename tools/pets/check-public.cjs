// Run after publish-preview. Setup mines real terrain with the existing debug hit
// hook and real cooldowns; purchases/equipment use visible desktop controls.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { digCells } = require('../combat-browser.cjs');
const url = 'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1&pets-review=1';
const output = 'artifacts/pets';
const layoutOnly = process.env.EGG_LAYOUT_ONLY === '1';
const uiOnly = process.env.PET_UI_ONLY === '1';
const report = { url, setup: 'Real mining via existing debug hit hook; no injected coins, pets, or clock.', errors: [] };
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-quic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('requestfailed', request => console.log('Request failed:', request.url(), request.failure()?.errorText));
  const snapshot = () => page.evaluate(() => window.__miningValidation.snapshot());
  const ready = () => page.waitForFunction(() => window.__miningValidation?.snapshot().ready && !document.querySelector('.loading-screen'), undefined, { timeout: 180000, polling: 500 });
  const travel = async position => {
    await page.evaluate(position => window.__miningValidation.teleport(position), position);
    await ready();
    await page.waitForFunction(() => window.__miningValidation.snapshot().grounded, undefined, { timeout: 30000 });
  };
  const viewEgg = async (keyboard = false) => {
    await page.evaluate(() => window.__miningValidation.look(-Math.PI / 2, .2));
    await page.getByRole('button', { name: '查看宠物蛋', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('dialog', { name: '原野蛋', exact: true }).count(), 0);
    if (keyboard) await page.keyboard.press('e');
    else await page.getByRole('button', { name: '查看宠物蛋', exact: true }).click();
    await page.getByRole('dialog', { name: '原野蛋', exact: true }).waitFor();
  };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); console.log('Public game ready');
    assert.equal((await snapshot()).economy.coins, 200);
    report.initialCoins = 200;
    // This runner has no hardware GPU. Bound the software renderer's queue using
    // the existing public debug scheduler; this is not device performance evidence.
    await page.evaluate(() => window.__miningValidation.performance({ submission: 'fenced', framesInFlight: 1 }));
    if (process.env.SWIFTSHADER_FLUSH === '1') await page.evaluate(() => {
      const gl = document.querySelector('canvas')?.getContext('webgl2');
      window.__testFlush = setInterval(() => gl?.flush(), 100);
    });
    report.renderEnvironment = 'Desktop Chromium SwiftShader, 960x540, existing fenced submission with one frame in flight; not performance acceptance';
    await page.evaluate(() => {
      window.__contextChecks = [];
      document.addEventListener('contextmenu', event => window.__contextChecks.push({ prevented: event.defaultPrevented }));
    });
    const rightClick = async locator => {
      const before = (await snapshot()).economy.coins;
      const count = await page.evaluate(() => window.__contextChecks.length);
      await locator.click({ button: 'right' });
      const checks = await page.evaluate(() => window.__contextChecks);
      assert.equal(checks.length, count + 1);
      assert.equal(checks.at(-1).prevented, true, 'native context menu must be suppressed');
      assert.equal((await snapshot()).economy.coins, before, 'right click must not purchase');
      report.contextMenuChecks = checks.length;
    };
    report.spawnLabels = (await snapshot()).eggLabels;
    assert.equal(report.spawnLabels.labelCount, 18);
    assert.equal(report.spawnLabels.draws, 1);
    await rightClick(page.getByRole('button', { name: '宠物', exact: true }));
    await page.getByRole('button', { name: '宠物', exact: true }).click();
    await page.getByRole('dialog', { name: '我的宠物', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '一键最佳', exact: true }).isDisabled(), true);

    await page.getByRole('button', { name: '关闭我的宠物', exact: true }).click();
    report.offers = (await snapshot()).pets.eggs;
    assert.equal(report.offers.length, 18);
    assert.equal(new Set(report.offers.map(egg => egg.price)).size, 18);
    await travel([26, .45, 24]);
    await page.evaluate(() => window.__miningValidation.look(-Math.PI / 2, .2));
    await page.getByRole('button', { name: '查看宠物蛋', exact: true }).waitFor({ state: 'visible' });
    await page.keyboard.press('e');
    await page.getByRole('dialog', { name: '卵石蛋', exact: true }).waitFor();
    await page.getByRole('button', { name: '35 金币 · 开一个', exact: true }).waitFor();
    assert.equal(await page.locator('.egg-preview-pet .pet-portrait').count(), 5);
    assert.equal(await page.getByText('磐岩熊', { exact: true }).count(), 1);
    await page.getByRole('button', { name: '关闭卵石蛋', exact: true }).click();
    await travel([26, .45, 20]);
    if (layoutOnly) {
      await page.evaluate(() => window.__miningValidation.look(-Math.PI / 2, .2));
      await page.getByRole('button', { name: '查看宠物蛋', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('dialog', { name: '原野蛋', exact: true }).count(), 0);
      const before = (await snapshot()).renderer.submission.submitted;
      if (!uiOnly) await page.waitForFunction(n => window.__miningValidation.snapshot().renderer.submission.submitted > n + 1, before);
      report.uiOnly = uiOnly;
      report.eggLabels = (await snapshot()).eggLabels;
      assert.equal(report.eggLabels.labelCount, 18);
      assert.equal(report.eggLabels.draws, 1);
      assert.ok(report.eggLabels.triangles > 0 && report.eggLabels.triangles < 100000);
      if (!uiOnly) await page.screenshot({ path: `${output}/egg-overhead.png` });
      await viewEgg(true);
      await rightClick(page.locator('.egg-preview-pet').first());
      await rightClick(page.getByRole('button', { name: '10 金币 · 开一个', exact: true }));
      const checkClose = async () => {
        const geometry = await page.locator('.pet-heading').evaluate(header => {
          const h = header.getBoundingClientRect(), b = header.querySelector('.pet-close').getBoundingClientRect();
          const icon = header.querySelector('svg').getBoundingClientRect();
          return { right: h.right - b.right, top: b.top - h.top, dx: icon.x + icon.width / 2 - b.x - b.width / 2, dy: icon.y + icon.height / 2 - b.y - b.height / 2, width: b.width, height: b.height };
        });
        for (const key of ['right', 'top', 'dx', 'dy']) assert.ok(Math.abs(geometry[key]) < .1, `close button ${key} drift`);
        assert.equal(geometry.width, 34);
        assert.equal(geometry.height, 32);
        return geometry;
      };
      report.closeButton = await checkClose();
      assert.equal(await page.getByText(/^持有 .*金币$/).count(), 0);
      assert.equal(await page.locator('.egg-message').count(), 0);
      const bounds = await page.getByRole('dialog', { name: '原野蛋', exact: true }).boundingBox();
      assert.ok(Math.abs(bounds.x + bounds.width / 2 - 480) < 2);
      assert.equal(await page.locator('.egg-probability').count(), 5);
      if (!uiOnly) await page.screenshot({ path: `${output}/egg-offer.png` });
      assert.equal(await page.locator('.egg-details-toggle').count(), 0);
      assert.deepEqual(await page.locator('.egg-probability').allTextContents(), ['40%', '30%', '20%', '8%', '2%']);
      await page.getByRole('button', { name: '10 金币 · 开一个', exact: true }).click();
      await page.getByRole('button', { name: '返回蛋台', exact: true }).waitFor();
      assert.equal((await snapshot()).economy.coins, 190);
      await page.getByRole('button', { name: '返回蛋台', exact: true }).click();
      assert.equal((await snapshot()).economy.coins, 190);
      await page.getByRole('button', { name: '关闭原野蛋', exact: true }).click();
      await page.getByRole('button', { name: '查看宠物蛋', exact: true }).waitFor({ state: 'visible' });
      await travel([23, .1, 20]);
      assert.equal(await page.getByRole('button', { name: '查看宠物蛋', exact: true }).count(), 0);
      await travel([26, .45, 20]);
      await viewEgg();
      assert.equal((await snapshot()).economy.coins, 190);
      assert.equal(await page.locator('.egg-probability').count(), 5);
      await page.getByRole('button', { name: '关闭原野蛋', exact: true }).click();
      await travel([23, .1, 20]);
      report.afterHatch = { coins: (await snapshot()).economy.coins, pets: (await snapshot()).pets.pets.length };
      report.awayLabels = (await snapshot()).eggLabels;
      assert.equal(report.awayLabels.draws, 1);
      assert.equal(report.awayLabels.labelCount, 18);
      assert.deepEqual(report.errors, []);
      report.passed = true;
      console.log('Public 200 starting coins, immediate probabilities, purchase, reopen, context menu and close button checks passed');
      return;
    }
    await viewEgg(true);
    assert.equal(await page.getByRole('button', { name: '10 金币 · 开一个', exact: true }).isDisabled(), false);
    report.emptyEgg = (await snapshot()).economy.eggId;
    console.log('Empty inventory and starting-balance purchase UI checked');
    await travel([0, .1, 10]);
    await page.getByRole('dialog', { name: '原野蛋', exact: true }).waitFor({ state: 'hidden' });
    const candidates = await page.evaluate(() => {
      const cells = [];
      for (let y = -1; y >= -5; y--) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
        const cell = [x, y, z];
        if (window.__miningValidation.cell(cell) === 8 && window.__miningValidation.canMine(cell)) cells.push(cell);
      }
      return cells.slice(0, 40);
    });
    assert.equal(candidates.length, 40);
    await digCells(page, candidates);
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.inventory.totalCount === 40);
    const sale = (await snapshot()).sellZone;
    await travel([sale.x, sale.y + .1, sale.z]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().economy.coins === 240);
    report.beforePurchase = (await snapshot()).pets;
    console.log('Mined and sold 40 dirt blocks: balance 240');
    await travel([26, .45, 20]);
    await page.evaluate(() => window.__miningValidation.look(-Math.PI / 2, .2));
    await page.getByRole('button', { name: '查看宠物蛋', exact: true }).waitFor({ state: 'visible' });
    const submitted = (await snapshot()).renderer.submission.submitted;
    await page.waitForFunction(before => window.__miningValidation.snapshot().renderer.submission.submitted > before + 1, submitted);
    report.eggLabels = (await snapshot()).eggLabels;
    assert.equal(report.eggLabels.labels.length, 18);
    assert.equal(report.eggLabels.draws, 1);
    if (!uiOnly) await page.screenshot({ path: `${output}/egg-overhead.png` });
    await viewEgg();
    const bounds = await page.getByRole('dialog', { name: '原野蛋', exact: true }).boundingBox();
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - 480) < 2, 'egg dialog must be centered');
    assert.equal(await page.locator('.egg-probability').count(), 5);
    assert.equal(await page.locator('.egg-probability').count(), 5);
    assert.equal(await page.locator('.egg-probability').count(), 5);
    if (!uiOnly) await page.screenshot({ path: `${output}/egg-offer.png` });
    await page.getByRole('button', { name: '10 金币 · 开一个', exact: true }).click();
    await page.getByRole('button', { name: '去装备', exact: true }).waitFor();
    assert.equal((await snapshot()).pets.pets.length, 1);

    // Dismiss an already-settled result, leave, return, and verify no lost/duplicate reward.
    await page.getByRole('button', { name: '关闭原野蛋', exact: true }).click();
    await travel([23, .1, 20]); await travel([26, .45, 20]);
    await viewEgg();
    assert.equal((await snapshot()).pets.pets.length, 1);
    for (let count = 2; count <= 4; count++) {
      await page.getByRole('button', { name: '10 金币 · 开一个', exact: true }).click();
      await page.getByRole('button', { name: '去装备', exact: true }).waitFor();
      assert.equal((await snapshot()).pets.pets.length, count);
      if (count < 4) await page.getByRole('button', { name: '返回蛋台', exact: true }).click();
    }
    assert.equal((await snapshot()).economy.coins, 200);
    await page.getByRole('button', { name: '去装备', exact: true }).click();
    await page.getByRole('dialog', { name: '我的宠物', exact: true }).waitFor();
    for (let index = 0; index < 3; index++) {
      await page.locator('.pet-card').nth(index).click();
      await page.getByRole('button', { name: '装备宠物', exact: true }).click();
    }
    await page.locator('.pet-card').nth(3).click();
    await page.getByRole('button', { name: '装备宠物', exact: true }).click();
    await page.getByText('装备位已满，先卸下一只，或使用一键最佳', { exact: true }).waitFor();
    await page.getByRole('button', { name: '一键最佳', exact: true }).click();
    report.equipped = (await snapshot()).pets;
    assert.equal(report.equipped.slots.filter(Boolean).length, 3);
    report.followers = (await snapshot()).petFollowers;
    assert.equal(report.followers.length, 3);
    assert.deepEqual(report.followers.map(pet => pet.id).sort(), report.equipped.slots.filter(Boolean).sort());
    assert.ok(report.equipped.effectiveStats.power > report.equipped.baseStats.power);
    assert.equal(report.equipped.effectiveStats.speed, report.equipped.baseStats.speed);
    const position = (await snapshot()).position;
    await page.keyboard.press('w');
    assert.ok(Math.hypot(...(await snapshot()).position.map((n, i) => n - position[i])) < .1, 'pet UI keyboard must not move player');
    if (!uiOnly) await page.screenshot({ path: `${output}/equipped.png` });
    await page.getByRole('button', { name: '全部卸下', exact: true }).click();
    assert.equal((await snapshot()).pets.effectiveStats.power, (await snapshot()).pets.baseStats.power);
    assert.equal((await snapshot()).petFollowers.length, 0);
    await page.getByRole('button', { name: '一键最佳', exact: true }).click();
    await page.getByRole('button', { name: '关闭我的宠物', exact: true }).click();
    await page.getByRole('button', { name: '宠物', exact: true }).click();
    assert.equal((await snapshot()).pets.pets.length, 4);
    assert.equal((await snapshot()).pets.slots.filter(Boolean).length, 3);
    report.reopened = (await snapshot()).pets;
    await page.getByRole('button', { name: '关闭我的宠物', exact: true }).click();
    await travel([0, .1, 10]);
    await page.waitForFunction(() => window.__miningValidation.snapshot().petFollowers.every(p => p.visible && Math.abs(p.position[0]) < 4 && Math.abs(p.position[2] - 10) < 4));
    report.followersAfterTravel = (await snapshot()).petFollowers;
    await page.evaluate(() => window.__miningValidation.look(0, .28));
    if (!uiOnly) {
      const drawn = (await snapshot()).renderer.submission.submitted;
      await page.waitForFunction(before => window.__miningValidation.snapshot().renderer.submission.submitted > before + 1, drawn);
      await page.screenshot({ path: `${output}/followers.png` });
    }
    const target = await page.evaluate(() => {
      for (let y = -1; y >= -5; y--) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
        const cell = [x, y, z];
        if (window.__miningValidation.cell(cell) > 0 && window.__miningValidation.canMine(cell)) return cell;
      }
    });
    assert.ok(target);
    const hp = await page.evaluate(cell => window.__miningValidation.health(cell), target);
    report.realHit = await page.evaluate(cell => window.__miningValidation.hit(cell), target);
    assert.equal(report.realHit.damage, Math.min(hp, report.equipped.effectiveStats.power));
    assert.deepEqual(report.errors, []);
    report.passed = true;
    console.log('Public hatch → equip → full slots → best → unequip → reopen passed');
  } finally {
    if (!report.passed) { report.last = await snapshot().catch(() => null); await page.screenshot({ path: `${output}/failure.png` }).catch(() => {}); }
    await fs.writeFile(`${output}/${layoutOnly ? 'egg-layout-report' : 'public-report'}.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
