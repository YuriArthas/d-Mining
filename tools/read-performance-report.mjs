import localTools from './local-tools.cjs';
// Reads a report sent by the bottom-left "report performance" button (docs/phase-performance-report-20261028.md).
// node tools/read-performance-report.mjs [id prefix]   — without a prefix, the newest report.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = localTools.required('MINING_REPORT_DIR');
const names = readdirSync(dir).filter(n => n.endsWith('.json') && n.startsWith(process.argv[2] ?? ''))
  .sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
if (!names.length) { console.error('no report'); process.exit(1); }
const { id, receivedAt, report: r } = JSON.parse(readFileSync(join(dir, names[0]), 'utf8'));
const d = r.device, s = r.summary;
console.log(`report ${id}  received ${receivedAt}  page ${r.build.page}`);
console.log(`device  ${d.userAgent}`);
if (d.userAgentData) console.log(`        model "${d.userAgentData.model ?? ''}" ${d.userAgentData.platform} ${d.userAgentData.platformVersion ?? ''} mobile=${d.userAgentData.mobile}`);
console.log(`        GPU ${d.gpu.renderer} (${d.gpu.vendor})${d.gpu.webgpuAdapter ? ` · WebGPU ${JSON.stringify(d.gpu.webgpuAdapter)}` : ''}`);
console.log(`        ${d.cores} cores · ${d.memoryGB ?? '?'} GB · screen ${d.screen.width}×${d.screen.height} @${d.screen.dpr} · ${d.pointer}`);
console.log(`render  ${r.render.bufferWidth}×${r.render.bufferHeight} (ratio ${r.render.pixelRatio}, MSAA ${r.render.samples}) · ${r.render.calls} draws · ${r.render.triangles} tris · ${r.render.programs} programs · ${r.render.textures} textures`);
console.log(`game    ${r.game.place} world ${r.game.world} depth ${r.game.depth} at ${r.game.position?.map(v => v.toFixed(1))} · rate ${r.game.renderRate} · up ${r.game.uptimeSeconds}s · heap ${r.game.heapMB} MB`);
console.log(`summary ${s.seconds}s · ${s.fps} fps (display ${s.refreshHz} Hz) · frame p50 ${s.frameMs.p50} p95 ${s.frameMs.p95} p99 ${s.frameMs.p99} max ${s.frameMs.max} ms`);
console.log(`        slow >33 ${s.slowFrames.over33ms} · >50 ${s.slowFrames.over50ms} · >100 ${s.slowFrames.over100ms} · >250 ${s.slowFrames.over250ms} · update CPU p50 ${s.updateCpuMs.p50} p95 ${s.updateCpuMs.p95} max ${s.updateCpuMs.max} ms · GPU wait ${s.gpuWaitPercent}% · long tasks ${s.longTasks.count} (${s.longTasks.totalMs} ms)`);
console.log('seconds (oldest first): t fps worst missed cpu cpuMax gpuWait draws tris heap place position probe');
for (const x of r.seconds.slice(-60)) console.log(`  ${x.t}\t${x.fps}\t${x.worstMs}\t${x.slow ?? ''}\t${x.cpuMs}\t${x.cpuMaxMs}\t${x.gpuWait}\t${x.calls}\t${x.triangles}\t${x.heapMB ?? ''}\t${x.place}\t${x.position ?? ''}\t${x.probe ?? ''}`);
// The debug panel's A/B run: missed frames per second in each mode.
const modes = new Map();
for (const x of r.seconds) if (x.probe) { const m = modes.get(x.probe) ?? { seconds: 0, missed: 0, fps: 0 }; m.seconds++; m.missed += x.slow ?? 0; m.fps += x.fps; modes.set(x.probe, m); }
if (modes.size > 1) for (const [mode, m] of modes) console.log(`probe ${mode}: ${m.seconds}s · ${(m.missed / m.seconds).toFixed(2)} missed/s · ${(m.fps / m.seconds).toFixed(1)} fps`);
if (r.animationFrames.length) {
  console.log('slowest long animation frames:');
  for (const f of [...r.animationFrames].sort((a, b) => b.ms - a.ms).slice(0, 8))
    console.log(`  ${f.t} ${f.ms} ms (blocking ${f.blockingMs}) ${f.scripts.map(x => `${x.source} ${x.ms}ms [${x.invoker}]`).join(' | ')}`);
}
