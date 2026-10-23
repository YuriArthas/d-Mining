// One light-bake worker: evaluates receiver points pulled from a shared counter (see bakeLight.mjs).
import { parentPort, workerData } from 'node:worker_threads';
import { createTracer } from './rayBvh.mjs';

const { job, bvhs, points, seeds, out, counter, settings } = workerData;
const tracers = Object.fromEntries(Object.entries(bvhs).map(([name, bvh]) => [name, createTracer(bvh)]));
const CHUNK = 1024, TAU = Math.PI * 2, GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Sample tables. Sun: points on the sun's disc (Vogel spiral, radius 1); sky: cosine-weighted hemisphere
// directions about +Z. Each receiver turns the table by its own angle, so the remaining noise is spatially
// spread rather than banded.
const sunDisc = new Float32Array(settings.sunSamples * 2), sky = new Float32Array(settings.aoSamples * 3);
for (let i = 0; i < settings.sunSamples; i++) {
  const r = Math.sqrt((i + .5) / settings.sunSamples), a = i * GOLDEN;
  sunDisc[i * 2] = r * Math.cos(a); sunDisc[i * 2 + 1] = r * Math.sin(a);
}
for (let i = 0; i < settings.aoSamples; i++) {
  const r = Math.sqrt((i + .5) / settings.aoSamples), a = i * GOLDEN;
  sky[i * 3] = r * Math.cos(a); sky[i * 3 + 1] = r * Math.sin(a); sky[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - r * r));
}
const [Lx, Ly, Lz] = settings.sun;
// Basis across the sun direction.
let Tx = -Lz, Ty = 0, Tz = Lx; { const l = Math.hypot(Tx, Ty, Tz); Tx /= l; Ty /= l; Tz /= l; }
const Bx = Ly * Tz - Lz * Ty, By = Lz * Tx - Lx * Tz, Bz = Lx * Ty - Ly * Tx;
const spread = Math.tan(settings.sunRadiusDeg * Math.PI / 180);

function groundLookup(i) {
  const { resolution, x0, z0, size } = settings.grid, ground = tracers.ground;
  const col = i % resolution, row = Math.floor(i / resolution);
  const x = x0 + (col + .5) * size / resolution, z = z0 + (row + .5) * size / resolution;
  const t = ground.cast(x, 120, z, 0, -1, 0, Infinity, false);
  let y = 0, nx = 0, ny = 1, nz = 0;
  if (t < Infinity) {
    y = 120 - t; const d = ground.hit * 12;
    nx = ground.tris[d + 9]; ny = ground.tris[d + 10]; nz = ground.tris[d + 11];
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  }
  points.set([x, y, z, nx, ny, nz], i * 6);
}

function evaluate(i) {
  const o = i * 6, nx = points[o + 3], ny = points[o + 4], nz = points[o + 5];
  const px = points[o] + nx * settings.offset, py = points[o + 1] + ny * settings.offset, pz = points[o + 2] + nz * settings.offset;
  const angle = seeds[i] * TAU, c = Math.cos(angle), s = Math.sin(angle);
  // Sun visibility: fraction of rays toward the sun's disc that escape. Faces turned away from the sun
  // get no sunlight in the game whatever is stored, so they store 1: smoother maps and no dark seam where
  // filtering reaches across to a lit neighbour.
  const facing = nx * Lx + ny * Ly + nz * Lz;
  let sun = 1;
  if (facing > 0) {
    const sunTracer = tracers[settings.sunScene];
    if (settings.sunMode === 'hard') sun = sunTracer.cast(px, py, pz, Lx, Ly, Lz, Infinity, true) === Infinity ? 1 : 0;
    else {
      let open = 0;
      for (let k = 0; k < settings.sunSamples; k++) {
        const u = (sunDisc[k * 2] * c - sunDisc[k * 2 + 1] * s) * spread, v = (sunDisc[k * 2] * s + sunDisc[k * 2 + 1] * c) * spread;
        let dx = Lx + Tx * u + Bx * v, dy = Ly + Ty * u + By * v, dz = Lz + Tz * u + Bz * v;
        const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
        if (sunTracer.cast(px, py, pz, dx, dy, dz, Infinity, true) === Infinity) open++;
      }
      sun = open / settings.sunSamples;
    }
  }
  out[i * 3 + 1] = sun;
  if (settings.aoSamples === 0) return;
  // Sky occlusion within aoRadius. Hits fade linearly with distance; floor hits (tag 1) only count as
  // contact within floorContact, since the hemisphere light already treats the ground below as a source.
  let ux = Math.abs(nx) < .9 ? 1 : 0, uy = ux ? 0 : 1, uz = 0;
  let tx = uy * nz - uz * ny, ty = uz * nx - ux * nz, tz = ux * ny - uy * nx;
  { const l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l; }
  const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
  const aoTracer = tracers[settings.aoScene], R = settings.aoRadius, F = settings.floorContact;
  let occluded = 0, back = 0;
  for (let k = 0; k < settings.aoSamples; k++) {
    const lx = sky[k * 3] * c - sky[k * 3 + 1] * s, ly = sky[k * 3] * s + sky[k * 3 + 1] * c, lz = sky[k * 3 + 2];
    const dx = tx * lx + bx * ly + nx * lz, dy = ty * lx + by * ly + ny * lz, dz = tz * lx + bz * ly + nz * lz;
    const t = aoTracer.cast(px, py, pz, dx, dy, dz, R, false);
    if (t === Infinity) continue;
    if (aoTracer.hitFacing > 0 && t < settings.insideDistance) back++;
    occluded += aoTracer.hitKind === 1 ? Math.max(0, 1 - t / F) : 1 - t / R;
  }
  out[i * 3] = 1 - occluded / settings.aoSamples;
  out[i * 3 + 2] = back / settings.aoSamples;
}

const total = job === 'ground-lookup' ? settings.grid.resolution ** 2 : points.length / 6;
const work = job === 'ground-lookup' ? groundLookup : evaluate;
const list = settings.list; // optional subset of point indices
for (;;) {
  const start = Atomics.add(counter, 0, CHUNK), end = Math.min(list ? list.length : total, start + CHUNK);
  if (start >= end) break;
  for (let k = start; k < end; k++) work(list ? list[k] : k);
}
parentPort.postMessage('done');
