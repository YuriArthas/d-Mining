import { buildLandscape } from '../src/landscape.ts';
import * as THREE from 'three/webgpu';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const names = new Set(), start = performance.now();
const landscape = buildLandscape(name => { names.add(name); return new THREE.Group(); });
const textures = new Map(), geometry = {}, bounds = new THREE.Box3(), mountainBounds = [];
let triangles = 0, vertices = 0, reversedFaces = 0, degenerateFaces = 0, collapsedUVFaces = 0;
const seamCandidates = [], lipEdges = new Map();
const pointKey = p => p.map(v => Math.round(v * 10000)).join(',');
function edge(a, b) {
  const ka = pointKey(a), kb = pointKey(b), key = ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`;
  const item = lipEdges.get(key); if (item) item.count++; else lipEdges.set(key, { a, b, count: 1 });
}
for (const model of [landscape.group, ...landscape.water]) model.traverse(object => {
  if (!object.isMesh) return;
  object.updateWorldMatrix(true, false);
  const p = object.geometry.attributes.position, n = object.geometry.attributes.normal, uv = object.geometry.attributes.uv, indices = object.geometry.index?.array;
  const count = indices?.length ?? p.count; triangles += count / 3; vertices += p.count;
  geometry[object.name] = (geometry[object.name] ?? 0) + count / 3;
  for (const attribute of [p, n, ...(uv ? [uv] : [])]) if (attribute.array.some(value => !Number.isFinite(value))) throw Error(`Non-finite geometry: ${object.name}`);
  if (object.material.map && !uv) throw Error(`Missing UVs: ${object.name}`);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3(), cross = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    const ia = indices?.[i] ?? i, ib = indices?.[i + 1] ?? i + 1, ic = indices?.[i + 2] ?? i + 2;
    a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); c.fromBufferAttribute(p, ic); normal.fromBufferAttribute(n, ia);
    cross.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.lengthSq() < 1e-16) degenerateFaces++;
    if (cross.dot(normal) < -1e-6) reversedFaces++;
    if (object.material.map) {
      const area = (uv.getX(ib) - uv.getX(ia)) * (uv.getY(ic) - uv.getY(ia)) - (uv.getY(ib) - uv.getY(ia)) * (uv.getX(ic) - uv.getX(ia));
      if (Math.abs(area) < 1e-16) collapsedUVFaces++;
    }
    if (['Flowing meadow surface', 'Inset polygon path', 'Continuous faceted creek banks', 'Shared bevelled turf lips'].includes(object.name)) {
      const points = [a, b, c].map(v => v.clone().applyMatrix4(object.matrixWorld).toArray());
      for (let e = 0; e < 3; e++) {
        const from = points[e], to = points[(e + 1) % 3];
        if (object.name === 'Shared bevelled turf lips') edge(from, to);
        else seamCandidates.push({ a: from, b: to, x0: Math.min(from[0], to[0]), x1: Math.max(from[0], to[0]), z0: Math.min(from[2], to[2]), z1: Math.max(from[2], to[2]) });
      }
    }
  }
  const box = new THREE.Box3().setFromObject(object); bounds.union(box);
  if (object.name === 'Angular distant mountain ridge') mountainBounds.push({ min: box.min.toArray(), max: box.max.toArray(), triangles: count / 3 });
  if (object.material.map) {
    const map = object.material.map;
    textures.set(map.name, { ...map.userData, sha256: createHash('sha256').update(map.image.data).digest('hex'), colorSpace: map.colorSpace, magFilter: map.magFilter, minFilter: map.minFilter });
  }
});
if (reversedFaces || degenerateFaces || collapsedUVFaces) throw Error(JSON.stringify({ reversedFaces, degenerateFaces, collapsedUVFaces }));

// Measure the actual Float32 source meshes, not just the shared authoring points.
// Meadow grid subdivisions produce T junctions on the long bank edge, so verify
// interval coverage and height agreement rather than requiring identical indices.
let checkedSeamEdges = 0, seamCoverageFailures = 0, maxSharedHeightError = 0;
const tolerance = 1.5e-4;
for (const { a, b, count } of lipEdges.values()) {
  if (count !== 1) continue;
  if ((Math.abs(a[0] + 90) < tolerance && Math.abs(b[0] + 90) < tolerance) || (Math.abs(a[0] - 90) < tolerance && Math.abs(b[0] - 90) < tolerance) || (Math.abs(a[2] + 75) < tolerance && Math.abs(b[2] + 75) < tolerance) || (Math.abs(a[2] - 87) < tolerance && Math.abs(b[2] - 87) < tolerance)) continue;
  const dx = b[0] - a[0], dz = b[2] - a[2], length2 = dx * dx + dz * dz, length = Math.sqrt(length2);
  if (length < tolerance) continue;
  checkedSeamEdges++;
  const ranges = [];
  for (const candidate of seamCandidates) {
    if (candidate.x1 < Math.min(a[0], b[0]) - tolerance || candidate.x0 > Math.max(a[0], b[0]) + tolerance || candidate.z1 < Math.min(a[2], b[2]) - tolerance || candidate.z0 > Math.max(a[2], b[2]) + tolerance) continue;
    const { a: c, b: d } = candidate;
    if (Math.abs(dx * (c[2] - a[2]) - dz * (c[0] - a[0])) / length > tolerance || Math.abs(dx * (d[2] - a[2]) - dz * (d[0] - a[0])) / length > tolerance) continue;
    const tc = ((c[0] - a[0]) * dx + (c[2] - a[2]) * dz) / length2, td = ((d[0] - a[0]) * dx + (d[2] - a[2]) * dz) / length2;
    const lo = Math.max(0, Math.min(tc, td)), hi = Math.min(1, Math.max(tc, td));
    if (hi - lo < 1e-8 || Math.abs(td - tc) < 1e-8) continue;
    let error = 0;
    for (const t of [lo, hi]) error = Math.max(error, Math.abs(a[1] + (b[1] - a[1]) * t - (c[1] + (d[1] - c[1]) * (t - tc) / (td - tc))));
    if (error > tolerance) continue;
    maxSharedHeightError = Math.max(maxSharedHeightError, error); ranges.push([lo, hi]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  let covered = 0;
  for (const [lo, hi] of ranges) { if ((lo - covered) * length > tolerance) break; covered = Math.max(covered, hi); }
  if ((1 - covered) * length > tolerance) seamCoverageFailures++;
}
if (seamCoverageFailures) throw Error(`Bank seam coverage failed: ${seamCoverageFailures}/${checkedSeamEdges}`);
const manifest = {
  method: 'New authored faceted creek with shared clipped meadow boundaries, inset polygon paths, broad polygon mine terraces and restrained deterministic pixel surface textures. Nature models supplied separately from the Blender library.',
  generatorSources: ['src/landscape.ts', 'src/terrainTexture.ts', 'tools/check-ground-assets.mjs'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') })),
  textures: [...textures].map(([name, texture]) => ({ name, ...texture })),
  terrainOnly: { triangles, vertices, geometry, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, mountainBounds },
  natureNames: [...names],
  checks: { finiteVertices: true, finiteNormals: true, texturedMeshesHaveUV: true, reversedFaces, degenerateFaces, collapsedUVFaces, bankSeams: { checkedEdges: checkedSeamEdges, coverageFailures: seamCoverageFailures, maxSharedHeightErrorMetres: maxSharedHeightError, toleranceMetres: tolerance }, elapsedMs: Math.round(performance.now() - start) },
};
writeFileSync(resolve(root, 'artifacts/ground-asset.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ terrainOnly: manifest.terrainOnly, checks: manifest.checks }, null, 2));
