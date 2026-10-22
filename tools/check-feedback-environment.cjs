// Public desktop acceptance module. The parent owns the browser, error capture,
// screenshots and isolated IndexedDB stores. This file never launches a browser.
// Clock advances and teleportation are constructed fixtures, not a natural 15m run.
const assert = require('node:assert/strict');

const coverageGaps = Object.freeze([
  'Run tools/check-surface-light-fade.cjs separately for real grounded samples on an excavated 2/3/8/14/15/16-block staircase, returning to shallow samples, and manual debug day/night below 30m. These samples use teleportation and do not prove continuous walking through the cutoff.',
  'Screenshots and shader-error capture require the parent public runner; inspect the surface transition, 400m/800m rooms and challenge-board images. Numeric light diagnostics alone are not visual acceptance.',
  'Clock advancement and room teleportation are debug fixtures. Transition captures pause the browser clock and finish real GPU work between controlled frames; this is not a natural full-cycle duration, mining progression, performance, physical GPU, mobile, or Safari acceptance run.',
]);

module.exports = async function checkFeedbackEnvironment({ page, snap, travel, frames: liveFrames, screenshot: capture, check, seed, go, base, id }) {
  const publicEntry = new URL(base);
  assert.equal(publicEntry.protocol, 'https:');
  assert.equal(publicEntry.hostname, 'w-sunjun-public.dev.clock-p.com');
  assert.equal(publicEntry.pathname, '/games/mining-test/index.html', 'Only the authorized public test entry is allowed');
  const name = id + '-environment';
  const address = `${base}?debug=1&submission=fenced&saveTest=store-${name}`;
  const samples = [];
  let controlledClock = false;
  async function frames() {
    if (!controlledClock) return liveFrames();
    const before = (await snap()).renderer.submission.submitted;
    // Keep game time independent from the seconds a SwiftShader draw takes.
    // Every sample still submits and completes real public-build GPU work.
    const deadline = Date.now() + 90000;
    for (let step = 0; step < 2000 && Date.now() < deadline; step++) {
      await page.clock.runFor(1);
      await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').finish());
      if ((await snap()).renderer.submission.submitted >= before + 2) return;
      // Chromium can report finish before its cross-process fence becomes
      // observable. Let the real GPU/process loop progress while time is held.
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Controlled transition frames did not submit through the runtime render gate');
  }
  async function screenshot(name) { await frames(); await capture(name, false); }
  await seed(name, progress => {
    progress.exploration = { version: 1, maxDepth: 0, unlockedDestinationIds: [] };
    progress.inventory.items = {};
    progress.onboarding = { ...progress.onboarding, version: 1, status: 'skipped', minedOnce: false, soldOnce: false, equippedOnce: false, longTaskIntroduced: false, minedCount: 0 };
    if (progress.rewards) progress.rewards.timed = { speed: 0, luck: 0 };
  });
  await go(address);
  const initial = await snap();
  assert.ok(initial.dayNight && Number.isFinite(initial.dayNight.phaseElapsed), 'Public build must expose snapshot.dayNight; publish the current diagnostics first');
  assert.equal(initial.dayNight.phase, 'night');
  assert.ok(initial.dayNight.phaseElapsed >= 0 && initial.dayNight.phaseElapsed < 438);
  assert.equal(initial.dayNight.daylight, 0);
  assert.equal(initial.startup.sky.daylightBlend, 0);
  assert.equal(initial.startup.sky.submittedDaylightBlend, 0);
  assert.equal(initial.startup.sky.submittedSurface, true);
  assert.equal(await page.getByRole('button', { name: '恢复自动昼夜', exact: true }).count(), 0, 'The new page must still be in automatic mode');

  const resident = initial.facilities.visuals;
  const geometry = initial.facilities.geometryMemory;
  for (const layer of initial.content.layers) assert.ok(resident.includes(layer.id), `Ordinary scene ${layer.id} must already be resident`);
  const opponents = state => state.economy.challengeBoard.filter(row => row.id !== 'self').sort((a, b) => a.id.localeCompare(b.id));
  const originalOpponents = opponents(initial);
  assert.equal(originalOpponents.length, 7);
  assert.equal(new Set(originalOpponents.map(row => row.id)).size, 7);
  const initialSelf = initial.economy.challengeBoard.find(row => row.id === 'self');
  assert.equal(initialSelf.depth, 0);

  function assertResident(state) {
    assert.deepEqual(state.facilities.visuals, resident, 'Moving between depths must not unload ordinary scenery');
    assert.deepEqual(state.facilities.geometryMemory, geometry, 'Resident scenery geometry must remain intact');
    // Nearby ordinary colliders and voxel chunks intentionally have their own
    // lifetime; their counts are not required to match this visual list.
  }
  function assertBoard(state, minimumDepth) {
    const rows = state.economy.challengeBoard;
    assert.equal(rows.length, 8);
    assert.deepEqual(opponents(state), originalOpponents);
    assert.equal(rows.filter(row => row.id === 'self').length, 1);
    const self = rows.find(row => row.id === 'self');
    assert.equal(self.depth, Math.floor(state.economy.maxDepth));
    assert.ok(self.depth >= minimumDepth);
    rows.slice(1).forEach((row, i) => assert.ok(rows[i].depth >= row.depth, 'Challenge board must remain sorted by depth'));
    return self;
  }
  function record(label, state) {
    samples.push({ label, dayNight: state.dayNight, position: state.position, sky: state.startup.sky, lighting: state.lighting,
      resident: state.facilities.visuals, board: state.economy.challengeBoard,
      textures: state.renderer.textures, programs: state.renderer.programs, submitted: state.renderer.submission.submitted });
  }
  async function clockAt(seconds) {
    // Read the exact active clock and advance it in the same browser turn.
    // A target behind the current point advances through a full 900s cycle;
    // the clock never rewinds and no wall-clock sleep or timing guess is used.
    await page.evaluate(target => {
      const debug = window.__miningValidation, state = debug.snapshot().dayNight;
      if (!state) throw Error('Missing public dayNight diagnostics');
      const now = (state.phase === 'day' ? 450 : 0) + state.phaseElapsed;
      debug.advanceDayNight((target - now + 900) % 900);
    }, seconds);
    await frames();
    return snap();
  }
  function assertAutoSurface(state) {
    const cycle = state.dayNight;
    const t = Math.max(0, Math.min(1, (cycle.phaseElapsed - 438) / 12));
    const transition = t * t * (3 - 2 * t);
    const expected = cycle.phase === 'day' ? 1 - transition : transition;
    assert.ok(Math.abs(cycle.daylight - expected) < 1e-8, 'Automatic cycle must use the specified 450s period and 12s smooth transition');
    assert.ok(Math.abs(state.startup.sky.daylightBlend - expected) < 1e-8, 'Sky must render the live automatic clock, not a manual override');
    assert.ok(Math.abs(state.lighting.surfaceArea.daylightBlend - expected) < 1e-8);
    assert.ok(Math.abs(state.lighting.keyLight.intensity - (2.25 + .25 * expected)) < 1e-8);
    assert.ok(Math.abs(state.lighting.surfaceArea.intensity - 850 * (1 - expected)) < 1e-6);
    assert.ok(Math.abs(state.lighting.surfaceArea.localPointGrid.strength - (1 - expected)) < 1e-8);
    assert.equal(state.lighting.surfaceArea.strength, 1);
    assert.equal(state.lighting.surfaceFog, false);
    assert.equal(state.lighting.surfaceReflections, true);
    assert.equal(state.lighting.shadowEnabled, false);
    assertResident(state);
  }

  await travel([10.8, .1, 22]);
  await page.evaluate(() => window.__miningValidation.look(0, .1));
  await frames();
  let state = await snap();
  assert.ok(state.dayNight.phaseElapsed > initial.dayNight.phaseElapsed, 'Normal foreground frames must advance the automatic clock without a debug jump');
  assertAutoSurface(state);assertBoard(state, 0);record('surface-initial-night-board', state);
  await screenshot('30-surface-night-board');
  check('Public fresh environment starts in automatic night; all ordinary rooms are resident and seven challenge rivals are present');

  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  controlledClock = true;
  state = await clockAt(438);assertAutoSurface(state);
  assert.equal(state.dayNight.phase, 'night');assert.ok(state.dayNight.daylight < .95);record('dawn-start-438', state);
  state = await clockAt(444);assertAutoSurface(state);
  assert.ok(state.dayNight.daylight > .3 && state.dayNight.daylight < .95, 'Two rendered frames near dawn midpoint must show a genuine intermediate blend');
  assert.ok(state.startup.sky.submittedDaylightBlend > 0 && state.startup.sky.submittedDaylightBlend < 1, 'A real submitted frame must contain the dawn blend');
  record('dawn-midpoint-444', state);await screenshot('31-surface-auto-dawn');
  const warmedTextures = (await snap()).renderer.textures;
  state = await clockAt(450);assertAutoSurface(state);
  assert.equal(state.dayNight.phase, 'day');assert.equal(state.dayNight.daylight, 1);record('day-boundary-450', state);
  await screenshot('32-surface-auto-day');
  state = await clockAt(894);assertAutoSurface(state);
  assert.ok(state.dayNight.daylight > 0 && state.dayNight.daylight < .7, 'Dusk must also render an intermediate blend');
  assert.ok(state.startup.sky.submittedDaylightBlend > 0 && state.startup.sky.submittedDaylightBlend < 1, 'A real submitted frame must contain the dusk blend');
  assert.ok(state.renderer.textures <= warmedTextures, 'The second transition must reuse the warmed cube and PMREM targets');
  record('dusk-midpoint-894', state);await screenshot('33-surface-auto-dusk');
  state = await clockAt(0);assertAutoSurface(state);assert.equal(state.dayNight.phase, 'night');assert.equal(state.dayNight.daylight, 0);
  record('night-boundary-900', state);
  await page.clock.resume(); controlledClock = false;
  check('Auto mode with controlled browser frames crosses 438/444/450s dawn and 894/900s dusk boundaries; real submitted sky blends match the lighting and PMREM textures are reused');

  for (const [roomId, depth, screenshotPrefix] of [['old_mine', 400, '34-old-mine'], ['fungal', 800, '35-fungal']]) {
    const room = initial.content.rooms.find(item => item.id === roomId);
    assert.ok(room, `Missing ${roomId} content`);
    await travel(room.spawn);
    await page.evaluate(() => window.__miningValidation.look(0, .18));
    let baseline, baselineGrade;
    for (const [time, point] of [['night', 30], ['day', 480]]) {
      const underground = await clockAt(point);
      assert.equal(underground.startup.sky.daylightBlend, time === 'day' ? 1 : 0, 'Surface clock must keep advancing while underground');
      assert.ok(Math.abs(underground.position[1] + depth) < .15, `Expected grounded ${depth}m room floor: ${underground.position}`);
      assert.equal(underground.lighting.surfaceReflections, false);
      assert.equal(underground.lighting.surfaceFog, true);
      assert.equal(underground.lighting.surfaceArea.strength, 0);
      assert.equal(underground.lighting.surfaceArea.activeLights, 0);
      assert.equal(underground.lighting.keyLight.intensity, 2.5, 'Underground base light must remain on');
      assert.equal(underground.lighting.keyLight.position[1], 42 - depth);
      assert.equal(underground.lighting.cameraDaylightBlend, 0);
      assert.equal(underground.startup.sky.environmentLightingStrength, 0);
      assert.equal(underground.startup.sky.environmentLightingActive, false);
      assert.ok(underground.renderer.submission.submitted > 0);
      const grade = underground.renderer.cameraGrade;
      assert.equal(grade.enabled, true);assert.ok(grade.frames > 0);
      const gradeShape = { version: grade.version, enabled: grade.enabled, width: grade.width, height: grade.height, allocations: grade.allocations };
      if (baselineGrade) assert.deepEqual(gradeShape, baselineGrade, 'The underground postprocessing path must remain active and reuse its framebuffer');
      else baselineGrade = gradeShape;
      const fixedLighting = {key:underground.lighting.keyLight,ambient:underground.lighting.ambient,camera:underground.lighting.cameraDaylightBlend};
      if (baseline) assert.deepEqual(fixedLighting, baseline, 'Day/night must not change the underground key, ambient light or grade');
      else baseline = fixedLighting;
      assertResident(underground);assertBoard(underground, depth);
      record(`${roomId}-${time}`, underground);await screenshot(`${screenshotPrefix}-${time}`);
    }
    check(`${depth}m ${roomId}: rendered night and day retain the same nonzero underground key light; scenery stays resident and only the player's challenge depth changes`);
  }

  await travel([10.8, .1, 22]);await page.evaluate(() => window.__miningValidation.look(0, .1));await frames();
  const beforeReload = await snap();
  assertResident(beforeReload);assertBoard(beforeReload, 800);
  assert.ok(beforeReload.economy.challengeBoard.findIndex(row => row.id === 'self') < initial.economy.challengeBoard.findIndex(row => row.id === 'self'), 'The real depth increase must improve the player rank');
  record('board-after-800m', beforeReload);await screenshot('36-board-after-800m');
  await page.evaluate(() => window.__miningSave.flush());
  await go(address);
  const restored = await snap();
  assertBoard(restored, 800);assertResident(restored);
  assert.deepEqual(restored.economy.challengeBoard, beforeReload.economy.challengeBoard, 'Reload must preserve rivals and the player record');
  assert.equal(restored.dayNight.phase, 'night');assert.equal(restored.dayNight.daylight, 0);
  await travel([10.8, .1, 22]);await page.evaluate(() => window.__miningValidation.look(0, .1));await frames();
  record('board-after-reload', await snap());await screenshot('37-board-reloaded');
  check('Challenge rivals and the player 800m record survive a real save flush and reload; returning to the surface does not lower the player record');
  return { samples, coverageGaps };
};

module.exports.coverageGaps = coverageGaps;
