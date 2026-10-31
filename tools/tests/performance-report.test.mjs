import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceRecorder } from '../../src/game/presentation/PerformanceRecorder.ts';

// The browser bits the report reads (the device and the page).
Object.assign(globalThis, {
  location: { href: 'https://mining.example/games/mining-surface-play/index.html' },
  screen: { width: 1920, height: 1080 }, devicePixelRatio: 2, innerWidth: 1600, innerHeight: 900,
  matchMedia: () => ({ matches: false }),
});
const gl = {
  VENDOR: 1, RENDERER: 2, VERSION: 3, MAX_TEXTURE_SIZE: 4, SAMPLES: 5, drawingBufferWidth: 3200, drawingBufferHeight: 1800,
  getExtension: () => null, getSupportedExtensions: () => ['WEBGL_compressed_texture_astc', 'KHR_parallel_shader_compile'],
  getParameter: p => ({ 1: 'WebKit', 2: 'Apple GPU', 3: 'WebGL 2.0', 4: 16384, 5: 4 })[p], getContextAttributes: () => ({ antialias: true }),
};
const renderer = {
  getContext: () => gl, domElement: { clientWidth: 1600, clientHeight: 900 }, getPixelRatio: () => 2, toneMapping: 5, shadowMap: { enabled: false },
  info: { render: { calls: 140, triangles: 420000 }, memory: { geometries: 300, textures: 40 }, programs: [1, 2, 3] },
};
const attach = recorder => recorder.attach({ renderer, where: () => ({ place: 'surface', position: [1.234, 2, 3] }), game: () => ({ world: 1 }) });

test('性能报告：一次 120ms 卡顿算慢帧，切后台的长停顿不算；每秒一行带位置', async () => {
  const recorder = new PerformanceRecorder(), detach = attach(recorder);
  let t = 1000;
  for (let i = 0; i < 180; i++) { t += i === 60 ? 120 : 1000 / 60; recorder.record(t, true, 3, true, 140, 420000); }
  t += 5000; // tab hidden
  for (let i = 0; i < 60; i++) { t += 1000 / 60; recorder.record(t, true, 3, true, 140, 420000); }
  const report = await recorder.report();
  detach();
  assert.equal(report.schemaVersion, 1); assert.equal(report.project, 'mining');
  assert.match(report.sessionId, /^[0-9a-f-]{36}$/);
  assert.equal(report.summary.slowFrames.over100ms, 1, 'the hitch, not the 5 s gap');
  assert.equal(report.summary.slowFrames.over250ms, 0);
  assert.equal(report.summary.frameMs.max, 120);
  assert.ok(report.summary.fps > 55 && report.summary.fps < 60, `fps ${report.summary.fps}`);
  assert.equal(report.summary.refreshHz, 60);
  assert.equal(report.frames.rows.length, 240);
  assert.ok(report.frames.rows.every(r => r.length === report.frames.columns.length && r.every(Number.isFinite)));
  assert.ok(report.seconds.length >= 2);
  assert.deepEqual(report.seconds[0].position, [1.2, 2, 3]);
  assert.equal(report.seconds[0].slow, 1, 'the 120 ms frame missed refreshes'); assert.equal(report.seconds[1].slow, 0);
  assert.equal(report.seconds[0].probe, 'normal');
  assert.equal(report.seconds[0].place, 'surface');
  assert.equal(report.device.gpu.renderer, 'Apple GPU');
  assert.deepEqual(report.device.gpu.compressedTextures, ['astc']);
  assert.equal(report.render.bufferWidth, 3200); assert.equal(report.render.programs, 3);
  assert.equal(report.game.world, 1);
});

test('性能报告：只留最近 1800 帧、按时间顺序；GPU 没跟上而跳过的帧单独计数', async () => {
  const recorder = new PerformanceRecorder(), detach = attach(recorder);
  let t = 1000;
  for (let i = 0; i < 2000; i++) { t += 1000 / 60; recorder.record(t, true, 2, i % 4 !== 0, 100, 1000); }
  const report = await recorder.report();
  detach();
  const times = report.frames.rows.map(r => r[0]);
  assert.equal(times.length, 1800);
  assert.ok(times.every((v, i) => !i || v > times[i - 1]));
  assert.ok(Math.abs(report.summary.gpuWaitPercent - 25) < 0.5, `${report.summary.gpuWaitPercent}`);
  await assert.rejects(() => recorder.report(), /not running/);
});
