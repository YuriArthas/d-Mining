// Offline ray queries for the light bake: a flat bounding volume hierarchy over world-space triangles.
// Arrays only (no objects per node or triangle), so the same buffers can be shared with worker threads.
const LEAF = 4, BINS = 12;

/** positions: Float32Array, 9 floats (three corners) per triangle, world space; kinds: optional Uint8Array
 *  tag per triangle, reported for the hit triangle. */
export function buildBvh(positions, kinds = new Uint8Array(positions.length / 9)) {
  const count = positions.length / 9;
  const lo = new Float32Array(count * 3), hi = new Float32Array(count * 3), mid = new Float32Array(count * 3);
  for (let t = 0; t < count; t++) for (let a = 0; a < 3; a++) {
    const p0 = positions[t * 9 + a], p1 = positions[t * 9 + 3 + a], p2 = positions[t * 9 + 6 + a];
    lo[t * 3 + a] = Math.min(p0, p1, p2); hi[t * 3 + a] = Math.max(p0, p1, p2); mid[t * 3 + a] = (p0 + p1 + p2) / 3;
  }
  const order = new Uint32Array(count); for (let i = 0; i < count; i++) order[i] = i;
  const capacity = Math.max(1, count * 2);
  let bounds = new Float32Array(capacity * 6), data = new Int32Array(capacity * 2), nodes = 1;
  const binLo = new Float32Array(BINS * 3), binHi = new Float32Array(BINS * 3), binCount = new Int32Array(BINS);
  const leftArea = new Float64Array(BINS), leftCount = new Int32Array(BINS);
  const area = (b, o) => { const x = b[o + 3] - b[o], y = b[o + 4] - b[o + 1], z = b[o + 5] - b[o + 2]; return x * y + y * z + z * x; };
  const stack = [[0, 0, count]];
  while (stack.length) {
    const [node, start, n] = stack.pop(), o = node * 6;
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    bounds[o] = bounds[o + 1] = bounds[o + 2] = Infinity; bounds[o + 3] = bounds[o + 4] = bounds[o + 5] = -Infinity;
    for (let i = start; i < start + n; i++) {
      const t = order[i] * 3;
      for (let a = 0; a < 3; a++) { if (lo[t + a] < bounds[o + a]) bounds[o + a] = lo[t + a]; if (hi[t + a] > bounds[o + 3 + a]) bounds[o + 3 + a] = hi[t + a]; }
      const x = mid[t], y = mid[t + 1], z = mid[t + 2];
      if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; if (z < cz0) cz0 = z; if (z > cz1) cz1 = z;
    }
    const extent = [cx1 - cx0, cy1 - cy0, cz1 - cz0], axis = extent[0] >= extent[1] && extent[0] >= extent[2] ? 0 : extent[1] >= extent[2] ? 1 : 2;
    const c0 = [cx0, cy0, cz0][axis], span = extent[axis];
    if (n <= LEAF || span <= 1e-9) { data[node * 2] = start; data[node * 2 + 1] = n; continue; }
    // Binned surface-area heuristic along the widest centroid axis.
    binCount.fill(0); binLo.fill(Infinity); binHi.fill(-Infinity);
    const scale = BINS / span;
    for (let i = start; i < start + n; i++) {
      const t = order[i] * 3, b = Math.min(BINS - 1, Math.floor((mid[t + axis] - c0) * scale));
      binCount[b]++;
      for (let a = 0; a < 3; a++) { if (lo[t + a] < binLo[b * 3 + a]) binLo[b * 3 + a] = lo[t + a]; if (hi[t + a] > binHi[b * 3 + a]) binHi[b * 3 + a] = hi[t + a]; }
    }
    const box = new Float32Array(6);
    box.fill(Infinity, 0, 3); box.fill(-Infinity, 3, 6);
    let running = 0;
    for (let b = 0; b < BINS - 1; b++) {
      running += binCount[b];
      if (binCount[b]) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], binLo[b * 3 + a]); box[3 + a] = Math.max(box[3 + a], binHi[b * 3 + a]); }
      leftArea[b] = running ? area(box, 0) : 0; leftCount[b] = running;
    }
    box.fill(Infinity, 0, 3); box.fill(-Infinity, 3, 6);
    let best = Infinity, split = -1, rightN = 0;
    for (let b = BINS - 1; b > 0; b--) {
      rightN += binCount[b];
      if (binCount[b]) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], binLo[b * 3 + a]); box[3 + a] = Math.max(box[3 + a], binHi[b * 3 + a]); }
      const cost = leftArea[b - 1] * leftCount[b - 1] + (rightN ? area(box, 0) * rightN : 0);
      if (leftCount[b - 1] && rightN && cost < best) { best = cost; split = b; }
    }
    let m = start;
    if (split > 0) {
      for (let i = start; i < start + n; i++) {
        const t = order[i] * 3;
        if (Math.min(BINS - 1, Math.floor((mid[t + axis] - c0) * scale)) < split) { const s = order[m]; order[m] = order[i]; order[i] = s; m++; }
      }
    }
    if (m === start || m === start + n) m = start + (n >> 1); // degenerate distribution: median of the current order
    const left = nodes; nodes += 2;
    if (nodes > capacity) throw Error('BVH capacity exceeded');
    data[node * 2] = left; data[node * 2 + 1] = 0;
    stack.push([left, start, m - start], [left + 1, m, start + n - m]);
  }
  // Triangles in leaf order as v0, edge1, edge2 and the unit face normal.
  const tris = new Float32Array(count * 12), tags = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const s = order[i] * 9, d = i * 12;
    tags[i] = kinds[order[i]];
    const ax = positions[s], ay = positions[s + 1], az = positions[s + 2];
    const e1x = positions[s + 3] - ax, e1y = positions[s + 4] - ay, e1z = positions[s + 5] - az;
    const e2x = positions[s + 6] - ax, e2y = positions[s + 7] - ay, e2z = positions[s + 8] - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    tris.set([ax, ay, az, e1x, e1y, e1z, e2x, e2y, e2z, nx, ny, nz], d);
  }
  return { bounds: bounds.slice(0, nodes * 6), data: data.slice(0, nodes * 2), tris, kinds: tags, triangles: count, nodes };
}

/** Copies the BVH into shared memory for worker threads. */
export function shareBvh(bvh) {
  const share = array => { const out = new array.constructor(new SharedArrayBuffer(array.byteLength)); out.set(array); return out; };
  return { bounds: share(bvh.bounds), data: share(bvh.data), tris: share(bvh.tris), kinds: share(bvh.kinds), triangles: bvh.triangles, nodes: bvh.nodes };
}

/** Ray queries over one BVH. `cast` returns the nearest hit distance below tMax (Infinity if none);
 *  with any=true it returns the first hit found. After a hit: `hit` is the triangle (leaf order), `hitKind`
 *  its tag and `hitFacing` the dot product of the ray direction and the face normal (positive: the ray hit
 *  the back of a face). */
export function createTracer({ bounds, data, tris, kinds }) {
  const stack = new Int32Array(256);
  const tracer = {
    hit: -1, hitKind: 0, hitFacing: 0, tris,
    cast(ox, oy, oz, dx, dy, dz, tMax, any) {
      const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
      let best = tMax, hit = -1, top = 0;
      stack[top++] = 0;
      while (top) {
        const node = stack[--top], o = node * 6;
        let t0 = (bounds[o] - ox) * ix, t1 = (bounds[o + 3] - ox) * ix;
        let near = t0 < t1 ? t0 : t1, far = t0 < t1 ? t1 : t0;
        t0 = (bounds[o + 1] - oy) * iy; t1 = (bounds[o + 4] - oy) * iy;
        near = Math.max(near, t0 < t1 ? t0 : t1); far = Math.min(far, t0 < t1 ? t1 : t0);
        t0 = (bounds[o + 2] - oz) * iz; t1 = (bounds[o + 5] - oz) * iz;
        near = Math.max(near, t0 < t1 ? t0 : t1); far = Math.min(far, t0 < t1 ? t1 : t0);
        if (far < near || far < 0 || near > best) continue;
        const count = data[node * 2 + 1];
        if (count === 0) { const left = data[node * 2]; stack[top++] = left + 1; stack[top++] = left; continue; }
        for (let i = data[node * 2], end = i + count; i < end; i++) {
          const d = i * 12;
          const e1x = tris[d + 3], e1y = tris[d + 4], e1z = tris[d + 5], e2x = tris[d + 6], e2y = tris[d + 7], e2z = tris[d + 8];
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det, tx = ox - tris[d], ty = oy - tris[d + 1], tz = oz - tris[d + 2];
          const u = (tx * px + ty * py + tz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > 1e-5 && t < best) { best = t; hit = i; if (any) { top = 0; break; } }
        }
      }
      tracer.hit = hit;
      if (hit < 0) return Infinity;
      tracer.hitKind = kinds[hit];
      tracer.hitFacing = dx * tris[hit * 12 + 9] + dy * tris[hit * 12 + 10] + dz * tris[hit * 12 + 11];
      return best;
    },
  };
  return tracer;
}
