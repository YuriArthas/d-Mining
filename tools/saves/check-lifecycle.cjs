// Public-only startup cancellation/back navigation check; no rendering acceptance claim.
const {
  chromium,
} = require("/root/threejs_space/d-Block-Blast/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-quic",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext(),
    page = await context.newPage();
  const url = `https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1&saveTest=lifecycle-${Date.now()}`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    window.__documentId = Math.random();
    window.addEventListener("pageshow", (e) => {
      window.__pageShowPersisted = e.persisted;
    });
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__miningSave, undefined, {
      timeout: 90000,
    });
    const first = await page.evaluate(() => ({
      id: window.__documentId,
      progress: window.__miningSave.progress(),
    }));
    await page.goto("https://w-sunjun-public.dev.clock-p.com/", {
      waitUntil: "domcontentloaded",
    });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__miningSave, undefined, {
      timeout: 90000,
    });
    const back = await page.evaluate(() => ({
      id: window.__documentId,
      progress: window.__miningSave.progress(),
      cached: window.__pageShowPersisted,
    }));
    assert.deepEqual(back.progress, first.progress);
    assert.equal(back.progress.wallet.coins, 200);
    // Exercise the cache restoration guard even if Chromium elects not to BFCache WebGL.
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await page.waitForFunction(
      (old) => window.__documentId !== old && window.__miningSave,
      back.id,
      { timeout: 90000 },
    );
    const final = await page.evaluate(() => window.__miningSave.progress());
    assert.deepEqual(final, first.progress);
    assert.deepEqual(errors, []);
    const report = {
      passed: true,
      url,
      checks: [
        "startup cancelled by navigation releases ownership",
        "browser Back reacquires and reads the same save",
        "synthetic persisted-pageshow guard reloads instead of reusing stale state",
      ],
      browserBackCached: back.cached,
      errors,
    };
    await fs.writeFile(
      "artifacts/saves/lifecycle-report.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
