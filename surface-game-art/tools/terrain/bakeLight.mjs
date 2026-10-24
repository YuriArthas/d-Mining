// Offline light bake for the Pinewind surface: sun visibility (soft shadow from the daytime sun) and sky
// occlusion, ray traced against every static model. Three receivers:
//  - ground: one top-down texture over the whole valley floor (and the creek water);
//  - buildings: a lightmap atlas on their second UV set (TEXCOORD_1, unwrapped in Blender);
//  - nature props (trees, rocks, bushes, flowers, curbs): one value per vertex.
// Stored values: red = sky occlusion, green = sun visibility. The game multiplies the daytime sun by the
// green value and the sky/ground fill by the red one (src/game/presentation/bakedLight.ts); nothing is
// traced or rendered for shadows while playing.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import * as THREE from 'three';
import { buildBvh, shareBvh } from './rayBvh.mjs';

export const LIGHT_BAKE = {
  version: 'pinewind-baked-light-v1',
  /** The daytime key light's position (PINEWIND_DAY.moonPosition); the light shines toward the origin. */
  sun: [-35, 60, 35],
  /** Angular radius of the sun's disc: sets how soft shadow edges are (wider further from the caster). */
  sunRadiusDeg: 0.8, sunSamples: 32,
  aoSamples: 24, aoRadius: 8, floorContact: .5,
  // 1536 texels: a compressed texture with mipmaps stays within the game's 4 MiB per-texture upload budget
  // (src/game/presentation/uploadSurfaceTexture.ts); 0.13 m on the ground, ~0.09 m on the buildings.
  ground: { x0: -96, z0: -96, size: 200, resolution: 1536 },
  lightmapSize: 1536,
  /** Characters: sun visibility 1 m above the floor on a coarse grid, read on the CPU while playing; green
   *  holds the floor height in `heightStep` metres so terraces and the bridge deck are told apart. */
  standing: { resolution: 512, height: 1, heightStep: .1 },
};
/** Triangle tags: walls, props and banks occlude the sky fully; the open floor only at contact. */
export const OCCLUDER = { solid: 0, floor: 1 };

const shared = (Type, n) => new Type(new SharedArrayBuffer(Math.max(1, n) * Type.BYTES_PER_ELEMENT));
const ign = (x, y) => { const f = .06711056 * x + .00583715 * y; return (52.9829189 * (f - Math.floor(f))) % 1; };

async function run(job, bvhs, points, seeds, out, settings) {
  const counter = shared(Int32Array, 1), workers = Math.max(1, Math.min(availableParallelism(), 6));
  await Promise.all(Array.from({ length: workers }, () => new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bakeLightWorker.mjs', import.meta.url), { workerData: { job, bvhs, points, seeds, out, counter, settings } });
    worker.once('message', () => { worker.terminate().then(resolve); });
    worker.once('error', reject);
  })));
}

function trianglesOf(entries) {
  let count = 0;
  for (const { mesh } of entries) { const g = mesh.geometry; count += (g.index ? g.index.count : g.attributes.position.count) / 3; }
  const positions = new Float32Array(count * 9), kinds = new Uint8Array(count), v = new THREE.Vector3();
  let t = 0;
  for (const { mesh, kind } of entries) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry, p = g.attributes.position, index = g.index, n = index ? index.count : p.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      positions[t * 9 + (i % 3) * 3] = v.x; positions[t * 9 + (i % 3) * 3 + 1] = v.y; positions[t * 9 + (i % 3) * 3 + 2] = v.z;
      if (i % 3 === 2) kinds[t++] = kind;
    }
  }
  return { positions, kinds, count };
}

const settingsFor = (overrides) => {
  const sun = new THREE.Vector3(...LIGHT_BAKE.sun).normalize();
  return { sun: sun.toArray(), sunRadiusDeg: LIGHT_BAKE.sunRadiusDeg, sunSamples: LIGHT_BAKE.sunSamples, aoSamples: LIGHT_BAKE.aoSamples, aoRadius: LIGHT_BAKE.aoRadius, floorContact: LIGHT_BAKE.floorContact, insideDistance: .3, ...overrides };
};

/** 3x3 tent filter over an RGBA-like float field (2 channels used), restricted by `same(i, j)`. */
function smooth(values, width, height, stride, valid, same) {
  const out = values.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x; if (valid && !valid[i]) continue;
    let ao = 0, sun = 0, w = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const j = yy * width + xx; if (valid && !valid[j]) continue; if (same && !same(i, j)) continue;
      const k = (2 - Math.abs(dx)) * (2 - Math.abs(dy));
      ao += values[j * stride] * k; sun += values[j * stride + 1] * k; w += k;
    }
    out[i * stride] = ao / w; out[i * stride + 1] = sun / w;
  }
  return out;
}

function toImage(values, stride, count, valid) {
  const image = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const ok = !valid || valid[i];
    image[i * 4] = ok ? Math.round(Math.min(1, Math.max(0, values[i * stride])) * 255) : 255;
    image[i * 4 + 1] = ok ? Math.round(Math.min(1, Math.max(0, values[i * stride + 1])) * 255) : 255;
    image[i * 4 + 2] = 255; image[i * 4 + 3] = 255;
  }
  return image;
}

/** Fills texels outside every island from their filled neighbours (bilinear filtering and mip levels read
 *  across island borders). */
function dilate(image, width, height, valid, passes) {
  const filled = Uint8Array.from(valid);
  for (let pass = 0; pass < passes; pass++) {
    const next = filled.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x; if (filled[i]) continue;
      let r = 0, g = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx; if (!filled[j]) continue;
        r += image[j * 4]; g += image[j * 4 + 1]; n++;
      }
      if (n) { image[i * 4] = Math.round(r / n); image[i * 4 + 1] = Math.round(g / n); next[i] = 1; }
    }
    filled.set(next);
  }
}

/**
 * @param casters   [{mesh, kind}] every static model that blocks light (world matrices applied)
 * @param ground    meshes forming the valley floor (receivers looked up from above)
 * @param lightmap  meshes with a `uv1` lightmap unwrap
 * @param vertex    meshes in world space receiving one value per vertex
 */
export async function bakeLight({ casters, ground, lightmap, vertex, log = console.log }) {
  const started = performance.now(), stats = { version: LIGHT_BAKE.version };
  const all = trianglesOf(casters), solid = trianglesOf(casters.filter(c => c.kind === OCCLUDER.solid)), floor = trianglesOf(ground.map(mesh => ({ mesh, kind: OCCLUDER.floor })));
  const bvhs = { all: shareBvh(buildBvh(all.positions, all.kinds)), solid: shareBvh(buildBvh(solid.positions, solid.kinds)), ground: shareBvh(buildBvh(floor.positions, floor.kinds)) };
  stats.casterTriangles = all.count; stats.groundTriangles = floor.count;
  log(`light bake: ${all.count} caster triangles, ${floor.count} ground triangles`);

  // Ground: receivers on the floor below each texel; sun from a single ray first, then the full disc
  // only near shadow edges (within the widest penumbra); sky occlusion from props and walls everywhere.
  const G = LIGHT_BAKE.ground, N = G.resolution, count = N * N;
  const groundPoints = shared(Float32Array, count * 6), groundSeeds = shared(Float32Array, count), groundOut = shared(Float32Array, count * 3);
  for (let i = 0; i < count; i++) groundSeeds[i] = ign(i % N, Math.floor(i / N));
  await run('ground-lookup', bvhs, groundPoints, groundSeeds, groundOut, settingsFor({ grid: G }));
  await run('evaluate', bvhs, groundPoints, groundSeeds, groundOut, settingsFor({ sunMode: 'hard', sunScene: 'solid', aoScene: 'solid', offset: .02 }));
  const texel = G.size / N, reach = Math.ceil(30 * Math.tan(LIGHT_BAKE.sunRadiusDeg * Math.PI / 180) / texel) + 1;
  const edge = new Uint8Array(count);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, s = groundOut[i * 3 + 1];
    if ((x + 1 < N && groundOut[(i + 1) * 3 + 1] !== s) || (y + 1 < N && groundOut[(i + N) * 3 + 1] !== s)) edge[i] = 1;
  }
  // Separable max filter: every texel within `reach` of an edge gets the full disc.
  const rows = new Uint8Array(count);
  for (let y = 0; y < N; y++) { let last = -Infinity; for (let x = 0; x < N; x++) { if (edge[y * N + x]) last = x; if (x - last <= reach) rows[y * N + x] = 1; } last = Infinity; for (let x = N - 1; x >= 0; x--) { if (edge[y * N + x]) last = x; if (last - x <= reach) rows[y * N + x] = 1; } }
  const near = new Uint8Array(count);
  for (let x = 0; x < N; x++) { let last = -Infinity; for (let y = 0; y < N; y++) { if (rows[y * N + x]) last = y; if (y - last <= reach) near[y * N + x] = 1; } last = Infinity; for (let y = N - 1; y >= 0; y--) { if (rows[y * N + x]) last = y; if (last - y <= reach) near[y * N + x] = 1; } }
  let flagged = 0; for (let i = 0; i < count; i++) flagged += near[i];
  const list = shared(Int32Array, flagged); for (let i = 0, k = 0; i < count; i++) if (near[i]) list[k++] = i;
  await run('evaluate', bvhs, groundPoints, groundSeeds, groundOut, settingsFor({ sunMode: 'soft', sunScene: 'solid', aoSamples: 0, offset: .02, list }));
  stats.ground = { resolution: N, texelCm: +(texel * 100).toFixed(2), softSunTexels: flagged, penumbraReachTexels: reach };
  // Only the sky occlusion is smoothed; shadow edges keep the traced penumbra.
  const groundSmooth = smooth(groundOut, N, N, 3);
  for (let i = 0; i < count; i++) groundSmooth[i * 3 + 1] = groundOut[i * 3 + 1];
  const groundImage = toImage(groundSmooth, 3, count);

  // Standing light for characters (see LIGHT_BAKE.standing).
  const SN = LIGHT_BAKE.standing.resolution, standCount = SN * SN;
  const standPoints = shared(Float32Array, standCount * 6), standSeeds = shared(Float32Array, standCount), standOut = shared(Float32Array, standCount * 3);
  for (let i = 0; i < standCount; i++) standSeeds[i] = ign(i % SN, Math.floor(i / SN));
  await run('ground-lookup', bvhs, standPoints, standSeeds, standOut, settingsFor({ grid: { ...G, resolution: SN } }));
  const floorHeight = new Float32Array(standCount);
  for (let i = 0; i < standCount; i++) {
    floorHeight[i] = standPoints[i * 6 + 1];
    standPoints[i * 6 + 1] += LIGHT_BAKE.standing.height;
    standPoints[i * 6 + 3] = 0; standPoints[i * 6 + 4] = 1; standPoints[i * 6 + 5] = 0;
  }
  await run('evaluate', bvhs, standPoints, standSeeds, standOut, settingsFor({ sunMode: 'soft', sunScene: 'solid', aoSamples: 0, offset: 0 }));
  const standingImage = new Uint8Array(standCount * 4);
  for (let i = 0; i < standCount; i++) {
    standingImage[i * 4] = Math.round(standOut[i * 3 + 1] * 255);
    standingImage[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(floorHeight[i] / LIGHT_BAKE.standing.heightStep)));
    standingImage[i * 4 + 2] = 0; standingImage[i * 4 + 3] = 255;
  }
  stats.standing = { resolution: SN, texelCm: +(G.size / SN * 100).toFixed(1) };
  log(`light bake: ground ${N}x${N}, ${flagged} texels near shadow edges (${Math.round(performance.now() - started)} ms)`);

  // Building lightmap: rasterize every triangle in its lightmap UVs, then trace from each texel centre.
  const S = LIGHT_BAKE.lightmapSize, owner = new Int32Array(S * S).fill(-1), distance = new Float32Array(S * S).fill(Infinity);
  const texelPoints = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  let uvTriangles = 0;
  for (const mesh of lightmap) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry, p = g.attributes.position, uv = g.attributes.uv1, index = g.index;
    if (!uv) throw Error(`Lightmap mesh ${mesh.name} has no uv1`);
    for (let t = 0; t < index.count; t += 3) {
      const ia = index.getX(t), ib = index.getX(t + 1), ic = index.getX(t + 2);
      const u0 = uv.getX(ia) * S, v0 = uv.getY(ia) * S, u1 = uv.getX(ib) * S, v1 = uv.getY(ib) * S, u2 = uv.getX(ic) * S, v2 = uv.getY(ic) * S;
      const area = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
      if (Math.abs(area) < 1e-6) continue; // parked faces (never visible)
      uvTriangles++;
      a.fromBufferAttribute(p, ia).applyMatrix4(mesh.matrixWorld); b.fromBufferAttribute(p, ib).applyMatrix4(mesh.matrixWorld); c.fromBufferAttribute(p, ic).applyMatrix4(mesh.matrixWorld);
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const x0 = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 1)), x1 = Math.min(S - 1, Math.ceil(Math.max(u0, u1, u2) + 1));
      const y0 = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 1)), y1 = Math.min(S - 1, Math.ceil(Math.max(v0, v1, v2) + 1));
      const edges = [[u1, v1, u2, v2], [u2, v2, u0, v0], [u0, v0, u1, v1]].map(([ax, ay, bx, by]) => ({ ax, ay, bx, by, length: Math.hypot(bx - ax, by - ay) }));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + .5, py = y + .5;
        // Signed distance (in texels) outside each edge; centres up to 0.75 texel outside still sample the
        // triangle (clamped), so island borders are covered for bilinear filtering.
        let outside = 0; const w = [0, 0, 0];
        for (let e = 0; e < 3; e++) {
          const E = edges[e], cross = ((E.bx - E.ax) * (py - E.ay) - (E.by - E.ay) * (px - E.ax)) * Math.sign(area);
          w[e] = cross / Math.abs(area);
          outside = Math.max(outside, -cross / E.length);
        }
        if (outside > .75) continue;
        const i = y * S + x;
        if (outside >= distance[i]) continue;
        let w0 = Math.max(0, w[0]), w1 = Math.max(0, w[1]), w2 = Math.max(0, w[2]); const sum = w0 + w1 + w2; w0 /= sum; w1 /= sum; w2 /= sum;
        const point = [a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2, n.x, n.y, n.z];
        if (owner[i] < 0) { owner[i] = texelPoints.length; texelPoints.push({ i, point }); } else texelPoints[owner[i]].point = point;
        distance[i] = outside;
      }
    }
  }
  const L = texelPoints.length, lightPoints = shared(Float32Array, L * 6), lightSeeds = shared(Float32Array, L), lightOut = shared(Float32Array, L * 3);
  texelPoints.forEach(({ i, point }, k) => { lightPoints.set(point, k * 6); lightSeeds[k] = ign(i % S, Math.floor(i / S)); });
  await run('evaluate', bvhs, lightPoints, lightSeeds, lightOut, settingsFor({ sunMode: 'soft', sunScene: 'all', aoScene: 'all', offset: .015 }));
  // Texels whose rays mostly start inside another solid are discarded and refilled from neighbours.
  const field = new Float32Array(S * S * 2), valid = new Uint8Array(S * S), normals = new Float32Array(S * S * 3), places = new Float32Array(S * S * 3);
  let inside = 0;
  texelPoints.forEach(({ i }, k) => {
    if (lightOut[k * 3 + 2] > .25) { inside++; return; }
    valid[i] = 1; field[i * 2] = lightOut[k * 3]; field[i * 2 + 1] = lightOut[k * 3 + 1];
    normals.set(lightPoints.subarray(k * 6 + 3, k * 6 + 6), i * 3); places.set(lightPoints.subarray(k * 6, k * 6 + 3), i * 3);
  });
  // Neighbouring texels of one island lie ~0.07 m apart on the same face; other islands are elsewhere.
  const sameSurface = (i, j) => normals[i * 3] * normals[j * 3] + normals[i * 3 + 1] * normals[j * 3 + 1] + normals[i * 3 + 2] * normals[j * 3 + 2] > .95
    && Math.hypot(places[i * 3] - places[j * 3], places[i * 3 + 1] - places[j * 3 + 1], places[i * 3 + 2] - places[j * 3 + 2]) < .3;
  const lightImage = toImage(smooth(field, S, S, 2, valid, sameSurface), 2, S * S, valid);
  dilate(lightImage, S, S, valid, 12);
  stats.lightmap = { size: S, triangles: uvTriangles, texels: L, discardedInside: inside };
  log(`light bake: lightmap ${S}x${S}, ${L} texels, ${inside} inside solids (${Math.round(performance.now() - started)} ms)`);

  // Nature props: one value per vertex, sampled slightly inside its faces (not on the exact corner, which
  // touches the neighbouring faces).
  let vertexCount = 0;
  for (const mesh of vertex) vertexCount += mesh.geometry.attributes.position.count;
  const vertexPoints = shared(Float32Array, vertexCount * 6), vertexSeeds = shared(Float32Array, vertexCount), vertexOut = shared(Float32Array, vertexCount * 3);
  let base = 0;
  for (const mesh of vertex) {
    const g = mesh.geometry, p = g.attributes.position, nrm = g.attributes.normal, index = g.index, V = p.count;
    const centroid = new Float32Array(V * 3), uses = new Uint32Array(V);
    for (let t = 0; t < (index ? index.count : V); t += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(t + k) : t + k);
      const cx = (p.getX(ids[0]) + p.getX(ids[1]) + p.getX(ids[2])) / 3, cy = (p.getY(ids[0]) + p.getY(ids[1]) + p.getY(ids[2])) / 3, cz = (p.getZ(ids[0]) + p.getZ(ids[1]) + p.getZ(ids[2])) / 3;
      for (const id of ids) { centroid[id * 3] += cx; centroid[id * 3 + 1] += cy; centroid[id * 3 + 2] += cz; uses[id]++; }
    }
    for (let i = 0; i < V; i++) {
      const k = uses[i] || 1, x = p.getX(i), y = p.getY(i), z = p.getZ(i), inset = uses[i] ? .12 : 0, j = base + i;
      vertexPoints.set([x + (centroid[i * 3] / k - x) * inset, y + (centroid[i * 3 + 1] / k - y) * inset, z + (centroid[i * 3 + 2] / k - z) * inset, nrm.getX(i), nrm.getY(i), nrm.getZ(i)], j * 6);
      vertexSeeds[j] = ign(j % 4093, Math.floor(j / 4093));
    }
    base += V;
  }
  await run('evaluate', bvhs, vertexPoints, vertexSeeds, vertexOut, settingsFor({ sunMode: 'soft', sunScene: 'all', aoScene: 'all', offset: .02 }));
  const vertexBakes = new Map(); base = 0;
  for (const mesh of vertex) {
    const V = mesh.geometry.attributes.position.count, bake = new Uint8Array(V * 4);
    for (let i = 0; i < V; i++) { const j = base + i; bake[i * 4] = Math.round(Math.min(1, Math.max(0, vertexOut[j * 3])) * 255); bake[i * 4 + 1] = Math.round(vertexOut[j * 3 + 1] * 255); bake[i * 4 + 3] = 255; }
    vertexBakes.set(mesh, bake); base += V;
  }
  stats.vertices = vertexCount;
  stats.milliseconds = Math.round(performance.now() - started);
  log(`light bake: ${vertexCount} prop vertices; total ${stats.milliseconds} ms`);
  return { groundImage, lightImage, standingImage, vertexBakes, stats };
}

/** Occlusion only, one value per vertex, for places without a sun (the underground halls): red = how open
 *  each vertex is within `aoRadius`, green fixed at full (no sun to hide). Same tracer and sampling as the
 *  surface props above. */
export async function bakeOcclusion({ casters, vertex, aoRadius = 4, aoSamples = 32, log = console.log }) {
  const started = performance.now();
  const all = trianglesOf(casters);
  const bvh = shareBvh(buildBvh(all.positions, all.kinds)), bvhs = { all: bvh, solid: bvh, ground: bvh };
  let vertexCount = 0;
  for (const mesh of vertex) vertexCount += mesh.geometry.attributes.position.count;
  const points = shared(Float32Array, vertexCount * 6), seeds = shared(Float32Array, vertexCount), out = shared(Float32Array, vertexCount * 3);
  let base = 0;
  for (const mesh of vertex) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry, p = g.attributes.position, nrm = g.attributes.normal, index = g.index, V = p.count, normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const centroid = new Float32Array(V * 3), uses = new Uint32Array(V), v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < (index ? index.count : V); t += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(t + k) : t + k);
      for (const id of ids) for (const other of ids) { centroid[id * 3] += p.getX(other) / 3; centroid[id * 3 + 1] += p.getY(other) / 3; centroid[id * 3 + 2] += p.getZ(other) / 3; }
      for (const id of ids) uses[id]++;
    }
    for (let i = 0; i < V; i++) {
      const k = uses[i] || 1, inset = uses[i] ? .12 : 0;
      v.set(p.getX(i) + (centroid[i * 3] / k - p.getX(i)) * inset, p.getY(i) + (centroid[i * 3 + 1] / k - p.getY(i)) * inset, p.getZ(i) + (centroid[i * 3 + 2] / k - p.getZ(i)) * inset).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
      points.set([v.x, v.y, v.z, n.x, n.y, n.z], (base + i) * 6);
      seeds[base + i] = ign((base + i) % 4093, Math.floor((base + i) / 4093));
    }
    base += V;
  }
  await run('evaluate', bvhs, points, seeds, out, settingsFor({ sunMode: 'hard', sunScene: 'all', aoScene: 'all', aoRadius, aoSamples, floorContact: .5, offset: .02 }));
  const bakes = new Map(); base = 0;
  for (const mesh of vertex) {
    const V = mesh.geometry.attributes.position.count, bake = new Uint8Array(V * 4);
    for (let i = 0; i < V; i++) { bake[i * 4] = Math.round(Math.min(1, Math.max(0, out[(base + i) * 3])) * 255); bake[i * 4 + 1] = 255; bake[i * 4 + 3] = 255; }
    bakes.set(mesh, bake); base += V;
  }
  log(`occlusion bake: ${all.count} caster triangles, ${vertexCount} vertices (${Math.round(performance.now() - started)} ms)`);
  return { vertexBakes: bakes, stats: { casterTriangles: all.count, vertices: vertexCount, aoRadius, aoSamples } };
}
