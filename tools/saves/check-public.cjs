const { digCells } = require("../combat-browser.cjs");
// Run only after publish:preview. All data lives in this run's isolated public save namespace.
const {
  chromium,
} = require("/root/threejs_space/d-Block-Blast/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const run = `save-${Date.now()}`;
const url = `https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1&saveTest=${run}`;
const report = {
  url,
  run,
  errors: [],
  checks: [],
  environment: "Desktop Chromium SwiftShader; not phone performance acceptance",
};
(async () => {
  await fs.mkdir("artifacts/saves", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-quic",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(90000);
  let page = await context.newPage();
  const observe = (p) => {
    p.on("pageerror", (e) => {
      report.errors.push(e.message);
      console.log("pageerror", e.message);
    });
    p.setDefaultTimeout(60000);
  };
  observe(page);
  const recordCheck = report.checks.push.bind(report.checks);
  report.checks.push = (...items) => {
    console.log("Checked:", ...items);
    return recordCheck(...items);
  };
  const ready = async () => {
    await page.waitForFunction(
      () =>
        window.__miningSave &&
        window.__miningValidation?.snapshot().ready &&
        !document.querySelector(".loading-screen"),
      undefined,
      { timeout: 180000, polling: 500 },
    );
    await page.evaluate(() => {
      window.__miningValidation.performance({
        submission: "fenced",
        framesInFlight: 1,
      });
      const gl = document.querySelector("canvas").getContext("webgl2");
      setInterval(() => gl.flush(), 100);
    });
  };
  const progress = () => page.evaluate(() => window.__miningSave.progress());
  const flush = () => page.evaluate(() => window.__miningSave.flush());
  const travel = async (p) => {
    await page.evaluate((p) => window.__miningValidation.teleport(p), p);
    await page.waitForFunction(
      () =>
        window.__miningValidation.snapshot().ready &&
        window.__miningValidation.snapshot().grounded,
      undefined,
      { timeout: 60000 },
    );
  };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready();
    console.log("ready", await progress());
    assert.equal((await progress()).wallet.coins, 200);
    assert.deepEqual((await progress()).exploration.unlockedDestinationIds, []);
    const other = await context.newPage();
    await other.goto(url, { waitUntil: "domcontentloaded" });
    try {
      await other.getByText(/游戏已在其他标签页打开/).waitFor();
    } catch (error) {
      report.secondTabBody = await other.locator("body").innerText();
      report.locks = await page.evaluate(() => navigator.locks.query());
      throw error;
    }
    assert.equal(await other.locator("canvas").count(), 0);
    await other.close();
    report.checks.push("second tab cannot open a writable session");
    report.database = await page.evaluate(async (id) => {
      const s = await window.__miningSave.openTestStore(id),
        p = window.__miningSave.progress();
      p.wallet.coins = 100;
      const h = {
        formatVersion: 1,
        revision: 1,
        savedAt: Date.now(),
        world: { generationVersion: 8, seed: 0, regionEncoding: 1 },
        regionCount: 1,
      };
      const region = { region: [0, -3, 0], removed: new Uint16Array([0, 0]) };
      await s.commit({
        expectedRevision: null,
        head: h,
        progress: p,
        regions: [region],
      });
      const before = await s.read();
      const put = IDBObjectStore.prototype.put;
      let requestSucceeded = false,
        aborted = false;
      IDBObjectStore.prototype.put = function (...args) {
        const req = put.apply(this, args);
        if (
          this.transaction.db.name === `mining:acceptance:store-${id}` &&
          this.name === "progress"
        )
          req.addEventListener(
            "success",
            () => {
              requestSucceeded = true;
              this.transaction.abort();
            },
            { once: true },
          );
        return req;
      };
      try {
        await s.commit({
          expectedRevision: 1,
          head: { ...h, revision: 2, regionCount: 2 },
          progress: { ...p, wallet: { version: 1, coins: 999 } },
          regions: [{ region: [1, -3, 0], removed: new Uint16Array([1, 1]) }],
        });
      } catch {
        aborted = true;
      } finally {
        IDBObjectStore.prototype.put = put;
      }
      const after = await s.read();
      const next = {
        expectedRevision: 1,
        head: { ...h, revision: 2 },
        progress: p,
        regions: [],
      };
      const racing = await Promise.allSettled([s.commit(next), s.commit(next)]);
      s.close();
      return {
        requestSucceeded,
        aborted,
        before,
        after,
        racing: racing.map((r) => r.status),
        durability: s.durability,
      };
    }, run);
    assert.ok(report.database.requestSucceeded && report.database.aborted);
    assert.deepEqual(report.database.after, report.database.before);
    assert.deepEqual(report.database.racing, ["fulfilled", "rejected"]);
    report.checks.push(
      "actual IndexedDB abort after request success rolls back all stores; competing revision rejected",
    );
    const mined = await page.evaluate(() => {
      const cells = [];
      for (let y = -1; y >= -8 && cells.length < 6; y--)
        for (let x = -4; x < 4 && cells.length < 6; x++)
          for (let z = -4; z < 4 && cells.length < 6; z++)
            if (
              window.__miningValidation.canMine([x, y, z]) &&
              window.__miningValidation.cell([x, y, z]) === 8
            )
              cells.push([x, y, z]);
      if (cells.length !== 6) throw Error("mining setup failed");
      return cells;
    });
    await page.bringToFront();
    await digCells(page, mined);
    await page.waitForFunction(
      () =>
        window.__miningValidation.snapshot().economy.inventory.totalCount === 6,
    );
    await flush();
    const withOre = await progress();
    assert.equal(withOre.inventory.items["ore.soil"], 6);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready();
    assert.equal((await progress()).inventory.items["ore.soil"], 6);
    assert.ok(
      await page.evaluate(
        (cells) => cells.every((c) => window.__miningValidation.cell(c) === 0),
        mined,
      ),
    );
    report.checks.push(
      "six real terrain removals and drops survive refresh together",
    );
    await travel([26, 0.45, 20]);
    await page.evaluate(() =>
      window.__miningValidation.look(-Math.PI / 2, 0.2),
    );
    await page.getByRole("button", { name: "查看宠物蛋", exact: true }).click();
    await page
      .getByRole("button", { name: "10 金币 · 开一个", exact: true })
      .click();
    await page.getByRole("button", { name: "去装备", exact: true }).click();
    await page.getByRole("button", { name: "装备宠物", exact: true }).click();
    await page
      .getByRole("button", { name: "关闭我的宠物", exact: true })
      .click();
    await page.waitForFunction(
      () => window.__miningSave.status().state === "idle",
    );
    const owned = await progress();
    assert.equal(owned.wallet.coins, 190);
    assert.equal(owned.pets.inventory.pets.length, 1);
    assert.equal(owned.pets.equipment.slots.filter(Boolean).length, 1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready();
    const restored = await progress();
    assert.equal(restored.wallet.coins, 190);
    assert.deepEqual(restored.pets, owned.pets);
    report.checks.push(
      "visible egg purchase/equipment automatically save and survive reload, no duplicate initial coins",
    );
    await travel([-12, 0.45, 49.3]);
    await page.waitForFunction(
      () =>
        window.__miningValidation.snapshot().economy.inventory.totalCount === 0,
    );
    await flush();
    assert.equal((await progress()).wallet.coins, 196);
    await travel([0, 0.15, 46]);
    if (process.env.CAPTURE_SAVE_SCREENSHOT === "1")
      await page.screenshot({ path: "artifacts/saves/restored-game.png" });
    report.beforeExit = await progress();
    report.metrics = await page.evaluate(() => window.__miningSave.metrics());
    await page.evaluate(() => {
      window.__originalSavePut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.transaction.db.name === window.__miningSave.namespace)
          throw new DOMException("Injected full storage", "QuotaExceededError");
        return window.__originalSavePut.apply(this, args);
      };
    });
    await page.getByRole("button", { name: "宠物", exact: true }).click();
    await page.getByRole("button", { name: "全部卸下", exact: true }).click();
    await page
      .getByRole("button", { name: "关闭我的宠物", exact: true })
      .click();
    await page.locator(".save-warning").waitFor();
    assert.equal(
      await page.evaluate(() => window.__miningSave.status().state),
      "failed",
    );
    await page
      .getByRole("button", { name: "退出游戏，返回游戏列表", exact: true })
      .click();
    await page
      .getByRole("button", { name: "不保存退出", exact: true })
      .waitFor();
    assert.ok(page.url().includes("mining-test"));
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = window.__originalSavePut;
    });
    await page.getByRole("button", { name: "重试保存", exact: true }).click();
    await page.waitForURL("https://w-sunjun-public.dev.clock-p.com/");
    report.checks.push(
      "quota failure keeps live progress; exit failure offers choices; retry saves and then exits",
    );
    assert.ok(
      await page.locator('a[href*="games/mining-test/index.html"]').count(),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready();
    assert.equal((await progress()).wallet.coins, 196);
    assert.equal((await progress()).inventory.items["ore.soil"], undefined);
    assert.equal(
      (await progress()).pets.equipment.slots.filter(Boolean).length,
      0,
    );
    report.checks.push(
      "sale and explicit exit save before teardown; lock released for reentry; public launcher contains test entry",
    );
    await flush();
    const client = await context.newCDPSession(page);
    const crashed = page.waitForEvent("crash");
    void client.send("Page.crash").catch(() => {});
    await crashed;
    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready();
    assert.equal((await progress()).wallet.coins, 196);
    assert.ok(
      await page.evaluate(
        (cells) => cells.every((c) => window.__miningValidation.cell(c) === 0),
        mined,
      ),
    );
    report.checks.push(
      "renderer crash recovers the last completed transaction and releases ownership",
    );
    // Damage only this runner's save while its game page is closed; old progress must not be overwritten.
    await flush();
    const keeper = await context.newPage();
    await keeper.goto("https://w-sunjun-public.dev.clock-p.com/", {
      waitUntil: "domcontentloaded",
    });
    await page.close();
    await keeper.evaluate(async (name) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const t = db.transaction("head", "readwrite"),
          s = t.objectStore("head"),
          r = s.get("main");
        r.onsuccess = () => s.put({ ...r.result, formatVersion: 999 }, "main");
        t.oncomplete = resolve;
        t.onabort = () => reject(t.error);
      });
      db.close();
    }, `mining:acceptance:${run}`);
    page = await context.newPage();
    observe(page);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByText(/不支持的存档版本/).waitFor();
    assert.equal(await page.locator("canvas").count(), 0);
    report.badVersion = await keeper.evaluate(async (name) => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const value = await new Promise((resolve, reject) => {
        const t = db.transaction(["head", "progress"]),
          h = t.objectStore("head").get("main"),
          p = t.objectStore("progress").get("main");
        t.oncomplete = () =>
          resolve({
            version: h.result.formatVersion,
            coins: p.result.data.wallet.coins,
          });
        t.onabort = () => reject(t.error);
      });
      db.close();
      return value;
    }, `mining:acceptance:${run}`);
    assert.deepEqual(report.badVersion, { version: 999, coins: 196 });
    report.checks.push(
      "unsupported save remains untouched; no silent new-player reset",
    );
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) {
    report.failure = String(error.stack || error);
    console.error(report.failure);
    try {
      report.body = await page.locator("body").innerText();
    } catch {}
    process.exitCode = 1;
  } finally {
    await fs.writeFile(
      "artifacts/saves/public-report.json",
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        checks: report.checks,
        errors: report.errors,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
})();
