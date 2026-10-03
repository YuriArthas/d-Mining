import { CELL, sampleXYZ, WORLD_GENERATION, type WorldGeneration, type EditSnapshot, type Coord } from './SparseWorld.ts';
export type MeshData = { positions: Float32Array; normals: Float32Array; uvs: Float32Array; tiles: Float32Array; indices: Uint32Array };


// Slice masks merge coplanar faces only when their material and orientation match.
// Physics ignores color, so ore boundaries do not inflate its mesh.
export function greedyMesh(get: (x: number, y: number, z: number) => number, size: number, physics = false): MeshData {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], tiles: number[] = [], indices: number[] = [];
  const mask = new Int32Array(size * size);
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3;
    for (let plane = 0; plane <= size; plane++) {
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        const a = [0, 0, 0]; a[d] = plane - 1; a[u] = i; a[v] = j;
        const b = [...a]; b[d]++;
        const left = get(a[0], a[1], a[2]), right = get(b[0], b[1], b[2]);
        // A chunk owns only faces on its own solids, never its neighbor's faces.
        mask[i + j * size] = left && !right && plane > 0 ? (physics ? 1 : left)
          : right && !left && plane < size ? -(physics ? 1 : right) : 0;
      }
      for (let j = 0; j < size; j++) for (let i = 0; i < size;) {
        const material = mask[i + j * size];
        if (!material) { i++; continue; }
        let w = 1, h = 1;
        while (i + w < size && mask[i + w + j * size] === material) w++;
        outer: while (j + h < size) {
          for (let k = 0; k < w; k++) if (mask[i + k + (j + h) * size] !== material) break outer;
          h++;
        }
        const start = positions.length / 3, normal = [0, 0, 0]; normal[d] = Math.sign(material);
        for (const [du, dv] of [[0, 0], [w, 0], [w, h], [0, h]]) {
          const p = [0, 0, 0]; p[d] = plane * CELL; p[u] = (i + du) * CELL; p[v] = (j + dv) * CELL;
          positions.push(...p);
          if (!physics) { normals.push(...normal); uvs.push(p[u] / CELL, p[v] / CELL); tiles.push(Math.abs(material) - 1); }
        }
        const order = material > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        indices.push(...order.map(n => start + n));
        for (let y = 0; y < h; y++) mask.fill(0, i + (j + y) * size, i + w + (j + y) * size);
        i += w;
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), tiles: new Float32Array(tiles), indices: new Uint32Array(indices) };
}

export type LayerKind = 'render' | 'collision';
export type RegionData = { coord: Coord; mesh: MeshData; buildMs: number };
export function buildRegion(kind: LayerKind, coord: Coord, size: number, snapshot: EditSnapshot, generation: WorldGeneration = WORLD_GENERATION): RegionData {
  const start = performance.now(), edits = new Map(snapshot);
  const ox = coord[0] * size, oy = coord[1] * size, oz = coord[2] * size;
  // Sample the procedural/sparse source directly. Only the 2D face mask is dense.
  const mesh = greedyMesh((x, y, z) => sampleXYZ(ox + x, oy + y, oz + z, edits, generation), size, kind === 'collision');
  return { coord, mesh, buildMs: performance.now() - start };
}
export type RegionJob = { coord: Coord; version: number; edits: EditSnapshot };
export type BuildJob = { generation: WorldGeneration; id: number; epoch: number; transaction: number; kind: LayerKind; size: number; regions: RegionJob[] };
export type BuildReply = { id: number; epoch: number; transaction: number; results?: { version: number; data: RegionData }[]; error?: string };
