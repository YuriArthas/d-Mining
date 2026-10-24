import * as THREE from 'three';
import { Kit, materials, rng, type V3 } from './kit.ts';
import { createGroundTexture, createStoneTexture, createPathTexture, groundTextureBounds } from './terrainTexture.ts';
import { readFileSync } from 'node:fs';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// The hub plan (tools/export-pinewind-layout.mjs) owns plazas, paths, paving pads and clearances.
type KeepClear = { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number } | { kind: 'circle'; x: number; z: number; radius: number };
type Grounds = { plazas: { x: number; z: number; radius: number }[]; paths: { width: number; points: [number, number][] }[]; pads: [number, number][]; keepClear: KeepClear[] };
const layout = JSON.parse(readFileSync(new URL('../../layout.json', import.meta.url), 'utf8'));
const grounds: Grounds = layout.grounds;
/** The next world's gate: it stands in the pass of the wooded ridge that closes the valley's south side. */
const gate: { x: number; z: number; opening: number; height: number; wallTo: number } = layout.gate;

// A single, authored valley. Geometry stays resident; the caller batches the
// static authoring graph. No transparent foliage cards or runtime scattering.
let random = rng(712044);
type NatureFactory = (name: string) => THREE.Object3D;
const cellSize = 1.5;
const groundBounds = { x0: -96, x1: 104, z0: -96, z1: 104 };
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mine = { x: 0, z: 0, rx: 8, rz: 8 };
const ellipse = (x: number, z: number) => (x / mine.rx) ** 2 + ((z - mine.z) / mine.rz) ** 2;

/** The creek (layout `creek`, from hubLayout.ts): the game cuts the voxel floor under the same corridor. */
const creek: { points: [number, number][]; width: { base: number; wave: number; waves: number }; bank: number; water: number } = layout.creek;
const stream = new THREE.CatmullRomCurve3(creek.points.map(([x,z])=>new THREE.Vector3(x,0,z)));
const streamPoints = stream.getPoints(220);
type RiverSample = { distance: number; halfWidth: number; t: number };
function riverAt(x: number, z: number): RiverSample {
  let distanceSquared = Infinity, t = 0;
  for (let i = 0; i < streamPoints.length - 1; i++) {
    const a = streamPoints[i], b = streamPoints[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const u = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = (x - a.x - u * dx) ** 2 + (z - a.z - u * dz) ** 2;
    if (d < distanceSquared) { distanceSquared = d; t = (i + u) / (streamPoints.length - 1); }
  }
  return { distance: Math.sqrt(distanceSquared), halfWidth: creek.width.base + creek.width.wave * Math.sin(t * creek.width.waves), t };
}

/** Behind the portal ring the ground rises into a ridge that closes the valley's south side, so the
 *  view back from the plaza ends in wooded hills instead of open land; the route to the next world
 *  keeps a flat canyon floor through the pass where the gate stands. */
function southRidge(x: number, z: number) {
  const rise = smooth(gate.z - 9, gate.z + 17, z), pass = smooth(gate.opening / 2 + 2.5, gate.wallTo + 4, Math.abs(x));
  return rise * pass * 13;
}
/** The broad valley supports a faceted creek, without a visible world voxel grid. */
function meadowHeight(x: number, z: number) {
  // The plaza, the portal ring and the route through the gate remain on the gameplay floor.
  if(Math.abs(x)<gate.opening/2+2.5 && z>50)return .035;
  const upland=smooth(53,92,Math.abs(x))*7.5+smooth(33,77,-z)*8+southRidge(x,z);
  return .035+upland*(1+.13*Math.sin(x*.115+z*.08)+.10*Math.cos(z*.17-x*.07));
}
type Point = { x: number; y: number; z: number };
type Polygon = { points: Point[]; x0: number; x1: number; z0: number; z1: number };
const cross2 = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
function polygon(points: Point[]): Polygon {
  const area = points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p.x * next.z - p.z * next.x; }, 0);
  return { points: area < 0 ? [...points].reverse() : points, x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)), z0: Math.min(...points.map(p => p.z)), z1: Math.max(...points.map(p => p.z)) };
}
const overlaps = (a: Polygon, b: Polygon) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
function halfPlane(points: Point[], a: Point, b: Point, inside: boolean) {
  const output: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length], dp = cross2(a, b, p), dq = cross2(a, b, q);
    const keepP = inside ? dp >= 0 : dp <= 0, keepQ = inside ? dq >= 0 : dq <= 0;
    if (keepP) output.push(p);
    if (keepP !== keepQ) {
      const t = dp / (dp - dq);
      output.push({ x: mix(p.x, q.x, t), y: mix(p.y, q.y, t), z: mix(p.z, q.z, t) });
    }
  }
  return output;
}
/** Subtract a convex region into disjoint pieces, retaining shared cut vertices. */
function cutPolygon(points: Point[], cutter: Polygon) {
  let remaining = points;
  const outside: Point[][] = [];
  for (let i = 0; i < cutter.points.length && remaining.length >= 3; i++) {
    const a = cutter.points[i], b = cutter.points[(i + 1) % cutter.points.length];
    const part = halfPlane(remaining, a, b, false);
    if (part.length >= 3) outside.push(part);
    remaining = halfPlane(remaining, a, b, true);
  }
  return { outside, inside: remaining.length >= 3 ? remaining : [] };
}
const worldPolygon = polygon([
  { x: groundBounds.x0, y: 0, z: groundBounds.z0 }, { x: groundBounds.x1, y: 0, z: groundBounds.z0 },
  { x: groundBounds.x1, y: 0, z: groundBounds.z1 }, { x: groundBounds.x0, y: 0, z: groundBounds.z1 },
]);
const minePolygon=polygon([[-8,-8],[8,-8],[8,8],[-8,8]].map(([x,z])=>({x,y:0,z})));
const mineRadius=(x:number,z:number)=>Math.max(Math.abs(x),Math.abs(z))/8;
// Arc-spaced sections give the bank a deliberate polygonal contour. All meadow
// cuts, bevels, slopes, creek-bed faces and water use these exact same vertices.
const riverCenters = stream.getSpacedPoints(90);
const upstream = riverCenters[0].clone().add(riverCenters[0].clone().sub(riverCenters[1]).normalize().multiplyScalar(45));
riverCenters.unshift(upstream);
// The creek is sunk into the valley (the game leaves the voxel floor under it out of the terrain meshes):
// across each section, from the meadow edge a turf lip rolls over to a steep earth bank (walkable, about 40
// degrees) that meets the water 0.4 m below the meadow, then the bank runs on under the water to a bed
// almost a metre down. Rows: meadow, lip, waterline, three bed rows to the centre, and back up.
export const CREEK_WATER_Y = creek.water;
const SECTION = [[1.05, 0], [.55, -.07], [.16, CREEK_WATER_Y], [-.25, -.66], [-.85, -.86]] as const;
const WATERLINE = 2, LAST_ROW = SECTION.length * 2;
const riverSections = riverCenters.map((center, index) => {
  const previous = riverCenters[Math.max(0, index - 1)], next = riverCenters[Math.min(riverCenters.length - 1, index + 1)];
  const tangent = next.clone().sub(previous).normalize(), width = riverAt(center.x, center.z).halfWidth;
  const rows = [...SECTION.map(([out, y]) => [-(width + out), y] as const), [0, -.95] as const, ...[...SECTION].reverse().map(([out, y]) => [width + out, y] as const)];
  return rows.map(([offset, depth], row) => {
    const x = center.x - tangent.z * offset, z = center.z + tangent.x * offset;
    return { x, y: row === 0 || row === LAST_ROW ? meadowHeight(x, z) : depth, z };
  });
});
const riverCorridor: Polygon[] = [], bankBoundary: Array<[Point, Point]> = [], bankFaces: Array<{ polygon: Polygon; row: number }> = [];
for (let i = 0; i < riverSections.length - 1; i++) {
  const a = riverSections[i], b = riverSections[i + 1];
  riverCorridor.push(polygon([a[0], a[LAST_ROW], b[LAST_ROW], b[0]]));
  bankBoundary.push([a[0], b[0]], [a[LAST_ROW], b[LAST_ROW]]);
  for (let row = 0; row < LAST_ROW; row++) bankFaces.push({ polygon: polygon([a[row], a[row + 1], b[row + 1], b[row]]), row });
}
function faceHeight(points: Point[], x: number, z: number): number | undefined {
  const p = { x, y: 0, z };
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[0], b = points[i], c = points[i + 1], area = cross2(a, b, c);
    if (Math.abs(area) < 1e-10) continue;
    const wa = cross2(b, c, p) / area, wb = cross2(c, a, p) / area, wc = 1 - wa - wb;
    if (wa >= -1e-7 && wb >= -1e-7 && wc >= -1e-7) return a.y * wa + b.y * wb + c.y * wc;
  }
}
export function landscapeHeight(x: number, z: number) {
  const radius = mineRadius(x, z);
  if (radius < 1) return 0; // Real voxel floor owns the entire square mine.
  for (const face of bankFaces) {
    const p = face.polygon;
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    const y = faceHeight(p.points, x, z); if (y !== undefined) return y;
  }
  return meadowHeight(x, z);
}

const paths = grounds.paths.map(path => ({ width: path.width, points: path.points }))
.map(path=>({width:path.width,curve:new THREE.CatmullRomCurve3(path.points.map(([x,z])=>new THREE.Vector3(x,0,z)))}));
const pathPoints = paths.map(path => ({ width: path.width, points: path.curve.getPoints(90) }));
function pathDistance(x: number, z: number) {
  let nearest = Infinity;
  for (const path of pathPoints) for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i], b = path.points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / Math.max(.0001, dx * dx + dz * dz), 0, 1);
    nearest = Math.min(nearest, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - path.width);
  }
  for (const plaza of grounds.plazas) nearest = Math.min(nearest, Math.hypot(x - plaza.x, z - plaza.z) - plaza.radius);
  return nearest;
}

type MeshData = { positions: number[]; normals: number[]; colors: number[]; uv: number[] };
const meshData = (): MeshData => ({ positions: [], normals: [], colors: [], uv: [] });
function meshFromData(data: MeshData, material: THREE.Material, name: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true;
  return mesh;
}
function surfaceUV(point: Point, normal: THREE.Vector3, mode: 'ground' | 'path' | 'bank' | 'water') {
  if (mode === 'ground') return [(point.x - groundTextureBounds.x) / groundTextureBounds.size, (point.z - groundTextureBounds.z) / groundTextureBounds.size];
  if (mode !== 'bank') return [point.x / 12, point.z / 12];
  // Dominant-axis projection keeps all horizontal terraces and vertical/sloping
  // faces non-degenerate; pixels remain attached to metres in the source mesh.
  const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z);
  return ny >= nx && ny >= nz ? [point.x / 4, point.z / 4] : nx >= nz ? [point.z / 4, point.y / 4] : [point.x / 4, point.y / 4];
}
function emitSurface(data: MeshData, points: Point[], color: THREE.Color, mode: 'ground' | 'path' | 'bank' | 'water', originX = 0, originZ = 0, smoothMeadow = false) {
  if (points.length < 3) return;
  const a = points[0];
  let flatNormal: THREE.Vector3 | undefined;
  for (let i = 1; i < points.length - 1; i++) {
    if (Math.abs(cross2(a, points[i], points[i + 1])) < 1e-8) continue;
    const b = points[i], c = points[i + 1];
    flatNormal = new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z).cross(new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)).normalize();
    break;
  }
  if (!flatNormal) return;
  for (let i = 1; i < points.length - 1; i++) {
    // Convex clipping can retain collinear boundary points. Such a fan triangle
    // has no terrain area and must not create a zero-normal or collapsed UV face.
    if (Math.abs(cross2(a, points[i], points[i + 1])) < 1e-8) continue;
    for (const point of [a, points[i + 1], points[i]]) {
      data.positions.push(point.x - originX, point.y, point.z - originZ);
      const e = .1, normal = smoothMeadow ? new THREE.Vector3(meadowHeight(point.x - e, point.z) - meadowHeight(point.x + e, point.z), e * 2, meadowHeight(point.x, point.z - e) - meadowHeight(point.x, point.z + e)).normalize() : flatNormal;
      data.normals.push(normal.x, normal.y, normal.z); data.colors.push(color.r, color.g, color.b);
      data.uv.push(...surfaceUV(point, flatNormal, mode));
    }
  }
}

function buildGround(kit: Kit) {
  const grassMaterial = new THREE.MeshLambertMaterial({ map: createGroundTexture(() => 'grass'), vertexColors: true });
  grassMaterial.name = 'Broad meadow with restrained world-attached pixel accents';
  const pathMaterial = new THREE.MeshLambertMaterial({ map: createPathTexture(), vertexColors: true });
  pathMaterial.name = 'Clean polygon path with sparse pixel-painted patches';
  const bankMaterial = new THREE.MeshLambertMaterial({ map: createStoneTexture(), vertexColors: true });
  bankMaterial.name = 'Broad bevelled earth banks and polygon quarry terraces';
  // Earth on the bank above the water; the bed under the water is darker.
  const white = new THREE.Color('#ffffff'), earth = new THREE.Color('#b48a5a'), bed = new THREE.Color('#6f7a5e');
  const roadRegions: Polygon[] = [];
  for (const path of paths) {
    const points = path.curve.getSpacedPoints(Math.ceil(path.curve.getLength() / 2.5));
    const sides = points.map((center, index) => {
      const tangent = points[Math.min(points.length - 1, index + 1)].clone().sub(points[Math.max(0, index - 1)]).normalize();
      return [-1, 1].map(sign => ({ x: center.x - tangent.z * path.width * sign, y: 0, z: center.z + tangent.x * path.width * sign }));
    });
    for (let i = 0; i < sides.length - 1; i++) roadRegions.push(polygon([sides[i][0], sides[i][1], sides[i + 1][1], sides[i + 1][0]]));
  }
  // Sandy plazas: convex polygons share the path material and partition the same ground cells.
  for (const plaza of grounds.plazas) {
    const sides = Math.max(24, Math.ceil(plaza.radius * 2.4));
    roadRegions.push(polygon(Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2;
      return { x: plaza.x + Math.cos(a) * plaza.radius, y: 0, z: plaza.z + Math.sin(a) * plaza.radius };
    })));
  }
  const holes = [...riverCorridor, minePolygon];
  // The meadow is physically cut to the shared river contour. No toothed bank
  // remains underneath, and paths partition the same surface without overlays.
  for (let ox = groundBounds.x0; ox < groundBounds.x1; ox += 15) for (let oz = groundBounds.z0; oz < groundBounds.z1; oz += 15) {
    const grass = meshData(), road = meshData(), px = ox + 7.5, pz = oz + 7.5;
    for (let x = ox; x < Math.min(ox + 15, groundBounds.x1); x += cellSize) for (let z = oz; z < Math.min(oz + 15, groundBounds.z1); z += cellSize) {
      const cell = polygon([[x, z], [x + cellSize, z], [x + cellSize, z + cellSize], [x, z + cellSize]].map(([xx, zz]) => ({ x: xx, y: meadowHeight(xx, zz), z: zz })));
      let pieces = [cell.points];
      const cutters = holes.filter(hole => overlaps(cell, hole));
      for (const hole of cutters) pieces = pieces.flatMap(part => cutPolygon(part, hole).outside);
      // Exact shared 3D edges: corner heights follow the bank's linear edge,
      // rather than a second independently sampled approximation of that edge.
      for (const part of pieces) for (const point of part) {
        for (const [a, b] of bankBoundary) {
          const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
          const t = ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2;
          if (t >= -1e-8 && t <= 1 + 1e-8 && Math.abs(cross2(a, b, point)) < 1e-7) { point.y = mix(a.y, b.y, t); break; }
        }
      }
      for (const region of roadRegions) {
        if (!overlaps(cell, region)) continue;
        const next: Point[][] = [];
        for (const piece of pieces) {
          const cut = cutPolygon(piece, region);
          if (cut.inside.length) emitSurface(road, cut.inside, white, 'path', px, pz, true);
          next.push(...cut.outside);
        }
        pieces = next;
      }
      for (const part of pieces) emitSurface(grass, part, white, 'ground', px, pz, true);
    }
    for (const [data, material, name] of [[grass, grassMaterial, 'Flowing meadow surface'], [road, pathMaterial, 'Inset polygon path']] as const) {
      if (!data.positions.length) continue;
      const mesh = meshFromData(data, material, name); mesh.position.set(px, 0, pz); kit.group.add(mesh);
    }
  }
  const lips = meshData(), banks = meshData();
  for (const face of bankFaces) {
    // Split quads on the same diagonal used by the height query. This preserves
    // exact placement on the sloping bank even where the valley itself rises.
    for (let i = 1; i < face.polygon.points.length - 1; i++) {
      const points = [face.polygon.points[0], face.polygon.points[i], face.polygon.points[i + 1]];
      const clipped = cutPolygon(points, worldPolygon).inside;
      if (face.row === 0 || face.row === LAST_ROW - 1) emitSurface(lips, clipped, white, 'ground');
      else emitSurface(banks, clipped, face.row === 1 || face.row === LAST_ROW - 2 ? earth : bed, 'bank');
    }
  }
  kit.group.add(meshFromData(lips, grassMaterial, 'Shared bevelled turf lips'));
  const bank = meshFromData(banks, bankMaterial, 'Continuous faceted creek banks'); bank.castShadow = true; kit.group.add(bank);
}

/** A thin darker rim where sand meets grass, as in the original game: it keeps the light sand and the light
 *  grass apart. The zero contour of `pathDistance` (marching squares on a 0.2 m grid over the paved area)
 *  becomes a 0.16 m band just above the ground, one quad per contour segment. */
function buildEdging(kit: Kit) {
  const step = .2, half = .08, lift = .01, x0 = -18, x1 = 32, z0 = 2, z1 = 104;
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), field = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) field[j * (nx + 1) + i] = pathDistance(x0 + i * step, z0 + j * step);
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], rim = new THREE.Color('#b99366');
  const edgePoint = (i: number, j: number, di: number, dj: number) => {
    const a = field[j * (nx + 1) + i], b = field[(j + dj) * (nx + 1) + i + di], t = a / (a - b);
    return [x0 + (i + di * t) * step, z0 + (j + dj * t) * step] as const;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const v = [field[j * (nx + 1) + i], field[j * (nx + 1) + i + 1], field[(j + 1) * (nx + 1) + i + 1], field[(j + 1) * (nx + 1) + i]];
    const crossings: (readonly [number, number])[] = [];
    // Cell edges in order: bottom, right, top, left; a sign change marks where the contour crosses.
    if ((v[0] < 0) !== (v[1] < 0)) crossings.push(edgePoint(i, j, 1, 0));
    if ((v[1] < 0) !== (v[2] < 0)) crossings.push(edgePoint(i + 1, j, 0, 1));
    if ((v[3] < 0) !== (v[2] < 0)) crossings.push(edgePoint(i, j + 1, 1, 0));
    if ((v[0] < 0) !== (v[3] < 0)) crossings.push(edgePoint(i, j, 0, 1));
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const [ax, az] = crossings[k], [bx, bz] = crossings[k + 1], length = Math.hypot(bx - ax, bz - az);
      if (length < 1e-4) continue;
      // No rim across the creek (the path stops at its banks; the bridge carries it) or in the mine opening.
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, river = riverAt(mx, mz);
      if (river.distance < river.halfWidth + 1.3 || (Math.abs(mx) < 8.6 && Math.abs(mz) < 8.6)) continue;
      // Extend each segment slightly along itself so neighbouring quads overlap instead of leaving cracks.
      const ux = (bx - ax) / length, uz = (bz - az) / length, ox = -uz * half, oz = ux * half, ex = ux * .02, ez = uz * .02;
      const quad = [[ax - ex + ox, az - ez + oz], [ax - ex - ox, az - ez - oz], [bx + ex - ox, bz + ez - oz], [bx + ex + ox, bz + ez + oz]];
      for (const index of [0, 1, 2, 0, 2, 3]) {
        const [x, z] = quad[index];
        positions.push(x, landscapeHeight(x, z) + lift, z); normals.push(0, 1, 0); colors.push(rim.r, rim.g, rim.b);
      }
    }
  }
  // Wind every triangle upward.
  for (let t = 0; t < positions.length; t += 9) {
    const ax = positions[t], az = positions[t + 2], bx = positions[t + 3], bz = positions[t + 5], cx = positions[t + 6], cz = positions[t + 8];
    if ((bx - ax) * (cz - az) - (bz - az) * (cx - ax) > 0) for (let k = 0; k < 3; k++) { const tmp = positions[t + 3 + k]; positions[t + 3 + k] = positions[t + 6 + k]; positions[t + 6 + k] = tmp; }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true }); material.name = 'Sand edging';
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Sand edging'; mesh.castShadow = false; mesh.receiveShadow = true;
  kit.group.add(mesh);
}
function placeNature(kit: Kit, getNature: NatureFactory, name: string, position: V3, scale: V3, yaw = 0) {
  const [x,,z]=position;
  for (const area of grounds.keepClear) {
    if (area.kind === 'rect' ? x > area.minX && x < area.maxX && z > area.minZ && z < area.maxZ : Math.hypot(x - area.x, z - area.z) < area.radius) return;
  }

  const object = getNature(name); object.name = `Blockcraft ${name}`;
  object.scale.set(...scale); kit.add(object, position, yaw); return object;
}
function placeRock(kit: Kit, getNature: NatureFactory, position: V3, size: V3, yaw: number, variant = 0) {
  return placeNature(kit, getNature, variant % 2 ? 'rock_b' : 'rock_a', position, size, yaw);
}
function buildQuarry(kit: Kit, getNature: NatureFactory) {
  for(const x of [-8.45,8.45])kit.box([x,.12,0],[.42,.24,16.7],'#e4d1a0',[0,0,0],.04);
  kit.box([0,.12,-8.45],[17.3,.24,.42],'#e4d1a0',[0,0,0],.04);
}
function buildPaths(kit: Kit) {
  // Deliberate square paving clusters, not a smooth overlay hiding painted edges.
  for (const [cx, cz] of grounds.pads) {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) continue;
      const x = cx + (col - 1) * .84, z = cz + (row - 1) * .85;
      kit.box([x, landscapeHeight(x, z) + .055, z], [.72, .11, .72], col % 2 ? '#a9bdbe' : '#dfd9bd', [0, 0, 0], 0);
    }
  }
}
function tree(kit: Kit, getNature: NatureFactory, x: number, z: number, height: number, seed: number, pine = false) {
  const yaw = Math.floor(rng(seed)() * 4) * Math.PI / 2;
  placeNature(kit, getNature, pine ? 'tree_pine' : 'tree_oak', [x>30?x+20:x, landscapeHeight(x>30?x+20:x, z), z], [height, height, height], yaw);
}
function plantings(kit: Kit, getNature: NatureFactory) {
  const trees: Array<[number, number, number, boolean]> = [
    [-31, -25, 12, true], [-36, -19, 10, false], [-33, -9, 11, false],
    [-38, 1, 13, true], [-32, 10, 10, false], [-37, 17, 12, true],
    [-30, 22, 10, false], [-37, 29, 12, true], [-40, 37, 11, false],
    [-25, -35, 11, true], [-34, -35, 13, true], [-13, -39, 11, false],
    [-5, -43, 14, true], [6, -43, 12, true], [18, -39, 11, false],
    [26, -42, 14, true], [36, -36, 11, true], [40, -28, 12, false],
    [36, -17, 11, true], [38, -5, 13, false], [35, 8, 11, true],
    [32, 17, 10, false], [38, 23, 13, true], [42, 35, 10, false],
    [-49, -13, 15, true], [-48, 12, 13, true], [-46, -31, 11, false],
    [49, -15, 15, true], [48, 7, 14, false], [49, 36, 12, true],
    [-54, 30, 12, false],
  ];
  for (let i = 0; i < trees.length; i++) { const [x, z, h, pine] = trees[i]; tree(kit, getNature, x, z, h, 100 + i * 19, pine); }
  for (const [x, z, h, seed] of [[-43, -34, 9, 98], [-14, -51, 11, 75], [27, -49, 10, 65], [48, -28, 9, 31]]) tree(kit, getNature, x, z, h, seed, true);
  const bushes: Array<[number, number, number]> = [
    [-25, 7, 1.4], [-27, 5, 1.1], [-24, 8.6, .9], [-27, 21, 1.3], [-28, 23, 1],
    [23, 8, 1.1], [23, 10, .8], [22, -4, 1.3], [20, -6, .9],
    [-11, -22, .9], [-12, -24, 1.3], [11, -25, 1.2], [13, -24, .8],
    [8, 32, 1.3], [10, 33, .9], [-14, 23, 1.1], [-15, 24, .8],
    [29, 21, 1.4], [31, 23, 1.1], [-35, -14, 1.5], [33, -3, 1.6],
  ];
  for (let i = 0; i < bushes.length; i++) {
    const [x, z, s] = bushes[i];
    placeNature(kit, getNature, 'bush', [x, landscapeHeight(x, z), z], [s, s, s], i % 4 * Math.PI / 2);
  }
  southernWoods(kit, getNature);
}
/** Woods on the south ridge: oaks along its foot behind the portal ring, pines higher up and on the
 *  canyon rims, leaving the pass and the gate clear. */
function southernWoods(kit: Kit, getNature: NatureFactory) {
  const trees: Array<[number, number, number, boolean]> = [
    [-16, 66, 10, false], [-22, 64, 11, true], [-28, 67, 12, true], [-35, 63, 10, false], [-42, 66, 13, true],
    [-49, 62, 11, false], [-57, 66, 12, true], [-64, 63, 11, true], [-71, 67, 12, false],
    [17, 66, 10, false], [23, 64, 12, true], [29, 67, 11, false], [36, 63, 13, true], [43, 66, 10, false],
    [50, 63, 12, true], [58, 66, 11, true], [65, 63, 12, false], [72, 67, 12, true],
    [-19, 76, 13, true], [-31, 79, 14, true], [-45, 75, 12, true], [-59, 80, 13, true], [-74, 77, 13, true],
    [19, 77, 13, true], [32, 80, 14, true], [46, 76, 12, true], [60, 79, 13, true], [75, 78, 13, true],
    [-13, 86, 12, true], [13, 88, 12, true], [-24, 92, 14, true], [26, 94, 14, true], [-40, 90, 13, true], [41, 91, 13, true],
  ];
  trees.forEach(([x, z, h, pine], i) => placeNature(kit, getNature, pine ? 'tree_pine' : 'tree_oak', [x, landscapeHeight(x, z), z], [h, h, h], Math.floor(rng(400 + i * 23)() * 4) * Math.PI / 2));
  const bushes: Array<[number, number, number]> = [
    [-15, 60, 1.3], [-17, 61.5, .9], [-22, 58, 1.2], [15, 60, 1.2], [17, 61.5, 1], [22, 58, 1.3],
    [-13, 64, 1.1], [13, 64, 1.1], [-21, 27, 1.3], [-19, 29.5, 1], [-23, 30, .9],
  ];
  bushes.forEach(([x, z, s], i) => placeNature(kit, getNature, 'bush', [x, landscapeHeight(x, z), z], [s, s, s], i % 4 * Math.PI / 2));
}
function flowerPatch(kit: Kit, getNature: NatureFactory, cx: number, cz: number, radius: number, count: number, name: string, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (pathDistance(x, z) < .5 || ellipse(x, z) < 1.3) continue;
    const s = .9 + r() * .5;
    placeNature(kit, getNature, name, [x, landscapeHeight(x, z), z], [s, s, s], i % 4 * Math.PI / 2);
  }
}
function meadowDetails(kit: Kit, getNature: NatureFactory) {
  const boulders: Array<[number, number, number, number, number]> = [
    [-28, 15, 2, 1.3, 1.6], [-30, 13, 1, .7, 1], [-23, 26, 1.6, .9, 1.3],
    [15, 19, 1.5, .65, 1.3], [16, 18, .65, .4, .6], [24, -10, 1.2, .9, 1],
    [-12, -28, 2.3, 1.4, 1.8], [-15, -27, 1.2, .8, 1], [12, -26, 1.7, 1, 1.4],
    [32, 12, 1.7, 1.1, 1.5], [30, 11, .8, .5, .6], [-7, 30, 1.3, .8, 1.2],
    [10, 34, 1.9, 1.1, 1.4], [-17, 39, 1.3, .6, 1], [30, 29, 2.2, 1.4, 1.6],
  ];
  for (let i = 0; i < boulders.length; i++) {
    const [x, z, w, h, d] = boulders[i];
    placeRock(kit, getNature, [x, landscapeHeight(x, z), z], [w, h, d], i * Math.PI / 4, i);
  }
  for (let i = 16; i < 170; i += 5) {
    if (i > 92 && i < 121) continue;
    const t = i / 220, p = stream.getPoint(t), tangent = stream.getTangent(t), bank = riverAt(p.x, p.z).halfWidth;
    const sign = i % 3 === 0 ? -1 : 1, off = bank + .6 + random() * .45;
    const x = p.x - tangent.z * off * sign, z = p.z + tangent.x * off * sign, s = .3 + random() * .55;
    placeRock(kit, getNature, [x, landscapeHeight(x, z), z], [s * 1.2, s * .7, s], i * Math.PI / 4, i);
  }
  flowerPatch(kit, getNature, -22, 10, 2.2, 14, 'flower_yellow', 18);
  flowerPatch(kit, getNature, -25, 18, 1.7, 10, 'flower_ivory', 38);
  flowerPatch(kit, getNature, 20, 10, 1.9, 14, 'flower_purple', 58);
  flowerPatch(kit, getNature, 10, 31, 2.2, 15, 'flower_ivory', 78);
  flowerPatch(kit, getNature, -14, 21, 1.7, 11, 'flower_yellow', 98);
  flowerPatch(kit, getNature, 15, -22, 1.7, 9, 'flower_yellow', 118);
  flowerPatch(kit, getNature, -19, 58, 2.2, 14, 'flower_purple', 138);
  flowerPatch(kit, getNature, 19, 58, 2.2, 14, 'flower_yellow', 158);
  flowerPatch(kit, getNature, -21, 28.5, 2, 12, 'flower_ivory', 178);
  const grassCenters = [[-26, 12], [-26, 22], [-10, 24], [12, 29], [25, 8], [31, 15], [-13, -23], [14, -24], [-17, 60], [17, 60]];
  for (let clump = 0; clump < 64; clump++) {
    const center = grassCenters[clump % grassCenters.length], a = random() * Math.PI * 2, d = Math.sqrt(random()) * 3.4;
    const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    if (pathDistance(x, z) < 1 || riverAt(x, z).distance < 4) continue;
    const s = .9 + random() * .4;
    placeNature(kit, getNature, 'grass', [x, landscapeHeight(x, z), z], [s, s, s], clump % 4 * Math.PI / 2);
  }
}
/** The valley is a bowl, as in the original game: tall faceted rock masses in warm terracotta close its
 *  north, west and east, and rise from the wooded ridge on the south. Each mass carries a green crown and a
 *  tree or two; a second, taller row stands behind, and two rows of woods line the foot. Polylines run
 *  along the inner foot. A mass that would stand in the creek, on a path or in a kept-clear area is left
 *  out, so the creek leaves through gorges and the pass with the gate stays open. Heights are metres
 *  above the local ground: lowest toward the gorges, tallest behind the mine. */
const CLIFF_WALLS: { points: [number, number][]; heights: [number, number]; woods: boolean }[] = [
  { points: [[-57, 40], [-53, 20], [-50, 0], [-48, -20], [-42, -36]], heights: [17, 26], woods: true },
  { points: [[-42, -36], [-26, -44], [-8, -47], [10, -46], [27, -42], [42, -37], [52, -44]], heights: [21, 30], woods: true },
  { points: [[64, -54], [69, -22], [69, 10], [67, 36], [66, 62]], heights: [17, 26], woods: true },
  // The south rim stands back on the ridge and stays low, with no woods of its own in front: the sun is in
  // the south-west, and anything taller here throws its shadow over the portal ring and the spawn.
  { points: [[-21, 80], [-36, 84], [-52, 81], [-69, 76]], heights: [8, 13], woods: false },
  { points: [[21, 80], [36, 84], [52, 81], [67, 75]], heights: [8, 13], woods: false },
];
const VALLEY_CENTRE = { x: 0, z: 18 };
function kept(x: number, z: number, margin: number) {
  return grounds.keepClear.some(area => area.kind === 'rect'
    ? x > area.minX - margin && x < area.maxX + margin && z > area.minZ - margin && z < area.maxZ + margin
    : Math.hypot(x - area.x, z - area.z) < area.radius + margin);
}
/** Points along a wall every `step` metres (jittered), with the unit normal pointing out of the valley. */
function wallStations(points: [number, number][], step: number, r: () => number, phase = 0) {
  const stations: { x: number; z: number; nx: number; nz: number; s: number }[] = [];
  let carried = phase;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], length = Math.hypot(bx - ax, bz - az);
    let tx = (bx - ax) / length, tz = (bz - az) / length, nx = tz, nz = -tx;
    if ((ax + bx) / 2 * nx - VALLEY_CENTRE.x * nx + ((az + bz) / 2 - VALLEY_CENTRE.z) * nz < 0) { nx = -nx; nz = -nz; }
    for (let d = carried; d < length; d += step + (r() - .5) * step * .3) { stations.push({ x: ax + tx * d, z: az + tz * d, nx, nz, s: stations.length }); carried = d + step - length; }
    if (carried < 0) carried = 0;
  }
  return stations;
}
function rockColumn(r: () => number, x: number, z: number, radius: number, height: number, tint: readonly [THREE.Color, THREE.Color]) {
  const ground = landscapeHeight(x, z), base = ground - 2.5, top = ground + height, sides = 7, spin = r() * Math.PI * 2;
  const tilt = [(r() - .5) * .14, (r() - .5) * .14], points: THREE.Vector3[] = [];
  // Rounded shoulders: the widest ring a third of the way up, then broad faces leaning in to the crown.
  for (const [f, k] of [[0, .96], [.3, 1], [.62, .95], [.86, .8], [1, .58]]) for (let i = 0; i < sides; i++) {
    const a = spin + (i + (r() - .5) * .55) / sides * Math.PI * 2, rr = radius * k * (.84 + r() * .3);
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    points.push(new THREE.Vector3(px, base + (top - base) * f + (f === 1 ? (px - x) * tilt[0] + (pz - z) * tilt[1] : 0), pz));
  }
  const geometry = new ConvexGeometry(points), position = geometry.getAttribute('position'), colors: number[] = [], c = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    // One colour per broad face: warm brown at the foot turning dusty mauve higher up (as the original's
    // cliffs), a little per-face variation and a darker foot.
    const centre = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3, f = (centre - base) / (top - base);
    c.copy(tint[0]).lerp(tint[1], smooth(.15, .7, f)).multiplyScalar((.92 + rng(Math.floor(x * 31 + z * 17 + i))() * .13) * (.84 + .16 * smooth(0, .55, f)));
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return { geometry, points, top: Math.max(...points.slice(-sides).map(p => p.y)), crown: radius * .58 };
}
function greenCrown(r: () => number, x: number, z: number, top: number, radius: number, tint: THREE.Color) {
  const points: THREE.Vector3[] = [], sides = 8, spin = r() * Math.PI * 2;
  // A big dome as wide as the column's shoulders, overhanging its top on every side (as the original's).
  for (const [dy, k] of [[-1.8, 1.35], [1.0, 1.62], [3.4, 1.18], [4.8, .46]]) for (let i = 0; i < sides; i++) {
    const a = spin + (i + (r() - .5) * .5) / sides * Math.PI * 2, rr = radius * k * (.88 + r() * .24);
    points.push(new THREE.Vector3(x + Math.cos(a) * rr, top + dy * (.85 + r() * .3), z + Math.sin(a) * rr));
  }
  const geometry = new ConvexGeometry(points), position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), colors: number[] = [], c = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    c.copy(tint).multiplyScalar((.92 + rng(Math.floor(x * 13 + z * 29 + i))() * .14) * (normal.getY(i) > .6 ? 1.12 : .96));
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return { geometry, top: Math.max(...points.map(p => p.y)) };
}
function buildCliffs(kit: Kit, getNature: NatureFactory) {
  const rock = new THREE.MeshLambertMaterial({ vertexColors: true }); rock.name = 'Valley cliff rock';
  const moss = new THREE.MeshLambertMaterial({ vertexColors: true }); moss.name = 'Valley cliff crown';
  // Foot and top colours per rock, and the crowns' emerald, chosen side by side on the public build against
  // the original game (tools/check-lighting-tone with live material tints).
  const r = rng(91807), green = new THREE.Color('#5ebc91');
  const stone = ([['#bf9495', '#c5a6ba'], ['#b4898a', '#ba99ac'], ['#c49f9f', '#cbb2c5']] as const).map(([foot, top]) => [new THREE.Color(foot), new THREE.Color(top)] as const);
  const clear = (x: number, z: number, radius: number) => {
    const river = riverAt(x, z);
    return river.distance > radius + river.halfWidth + 2.5 && pathDistance(x, z) > radius + 2 && !kept(x, z, radius * .6);
  };
  let columns = 0;
  CLIFF_WALLS.forEach((wall, w) => {
    for (const [row, step] of [[0, 9.5], [1, 10.5]] as const) for (const at of wallStations(wall.points, step, r, row * 4.5)) {
      const out = row ? 9 + r() * 4 : (r() - .5) * 3, x = at.x + at.nx * out, z = at.z + at.nz * out;
      const radius = (row ? 6.5 + r() * 3 : 5.5 + r() * 2.5), wave = .5 + .5 * Math.sin(at.s * .9 + w * 2.3);
      const height = wall.heights[0] + (wall.heights[1] - wall.heights[0]) * wave + (r() - .5) * 4 + (row ? 4 + r() * 5 : 0);
      if (!clear(x, z, radius)) continue;
      const column = rockColumn(r, x, z, radius, height, stone[Math.floor(r() * stone.length)]);
      const mesh = new THREE.Mesh(column.geometry, rock); mesh.name = 'Valley cliff column'; mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.hull = column.points.map(p => p.toArray()); kit.group.add(mesh); columns++;
      const crown = greenCrown(r, x, z, column.top, column.crown, green);
      const cap = new THREE.Mesh(crown.geometry, moss); cap.name = 'Valley cliff crown'; cap.castShadow = cap.receiveShadow = true; kit.group.add(cap);
      // A tree or two near the crown's valley side breaks each top against the sky.
      for (let k = row ? (r() < .5 ? 1 : 0) : r() < .3 ? 2 : r() < .85 ? 1 : 0; k > 0; k--) {
        const a = r() * Math.PI * 2, d = column.crown * (.15 + r() * .45), tx = x - at.nx * column.crown * .35 + Math.cos(a) * d, tz = z - at.nz * column.crown * .35 + Math.sin(a) * d, h = 6 + r() * 5;
        const tree = getNature(r() < .55 ? 'tree_pine' : 'tree_oak'); tree.name = 'Blockcraft cliff tree';
        tree.scale.setScalar(h); kit.add(tree, [tx, crown.top - .9, tz], Math.floor(r() * 4) * Math.PI / 2);
      }
    }
    // Two rows of woods along the foot, staggered, on the valley side.
    if (wall.woods) for (const [inset, step, phase] of [[6.5, 7.5, 0], [12, 8, 3.8]] as const) for (const at of wallStations(wall.points, step, r, phase)) {
      const x = at.x - at.nx * (inset + (r() - .5) * 2.5), z = at.z - at.nz * (inset + (r() - .5) * 2.5);
      const river = riverAt(x, z);
      if (river.distance < river.halfWidth + 3 || pathDistance(x, z) < 2.5) continue;
      const h = 9 + r() * 6;
      placeNature(kit, getNature, r() < .6 ? 'tree_pine' : 'tree_oak', [x, landscapeHeight(x, z), z], [h, h, h], Math.floor(r() * 4) * Math.PI / 2);
    }
  });
  return columns;
}
/** Where the creek leaves the valley it runs into woods instead of open sky. In the west gorge the banks are
 *  lined with big simple trees and, near the ground's edge, a grove stands right across the stream, closing the
 *  view down the gorge; in the north-east a smaller grove hides where the water starts. Thick trunks and a few
 *  broad crowns (the shared tree_oak / tree_pine). */
function creekEnds(kit: Kit, getNature: NatureFactory) {
  const r = rng(52771);
  const tAt = (test: (p: THREE.Vector3) => boolean, from: number, step: number) => {
    for (let t = from; t >= 0 && t <= 1; t += step) if (test(stream.getPoint(t))) return t;
    return from;
  };
  // West: from where the gorge opens (x = -60) to the ground's edge (x = -95); the last stretch is wooded across.
  const groves = [
    { t0: tAt(p => p.x > -60, 1, -.002), t1: tAt(p => p.x > -95, 1, -.002), across: tAt(p => p.x > -84, 1, -.002) },
    // North-east: from the source to the mouth of the gorge (z = -54).
    { t0: 0, t1: tAt(p => p.z > -56, 0, .002), across: tAt(p => p.z > -64, 0, .002) },
  ];
  let planted = 0;
  for (const g of groves) {
    const lo = Math.min(g.t0, g.t1), hi = Math.max(g.t0, g.t1), length = stream.getLength() * (hi - lo);
    for (let d = 0; d < length; d += 3.6 + r() * 1.6) {
      const t = lo + (hi - lo) * d / length, p = stream.getPoint(t), tangent = stream.getTangent(t), half = riverAt(p.x, p.z).halfWidth;
      // In the far stretch the grove fills the stream too; elsewhere two staggered rows on each bank.
      const wooded = g.t0 > g.t1 ? t <= g.across : t >= g.across;
      const offsets = wooded ? [-12, -7, -2.2, 2.2, 7, 12] : [-(half + 9), -(half + 3.4), half + 3.4, half + 9];
      for (const o of offsets) {
        if (r() < .18) continue;
        const off = o + (r() - .5) * 2.2, x = p.x - tangent.z * off + (r() - .5) * 1.5, z = p.z + tangent.x * off + (r() - .5) * 1.5;
        const h = 10 + r() * 6;
        if (placeNature(kit, getNature, r() < .55 ? 'tree_pine' : 'tree_oak', [x, landscapeHeight(x, z), z], [h, h, h], Math.floor(r() * 4) * Math.PI / 2)) planted++;
      }
    }
  }
  // A closing row right at the far end: oaks shoulder to shoulder with big bushes between their trunks, so no
  // sky shows under the crowns at the end of either gorge.
  for (const g of groves) {
    const p = stream.getPoint(g.t1), tangent = stream.getTangent(g.t1);
    for (let off = -15; off <= 15; off += 3) {
      const x = p.x - tangent.z * off, z = p.z + tangent.x * off, h = 11 + r() * 4;
      if (placeNature(kit, getNature, r() < .7 ? 'tree_oak' : 'tree_pine', [x, landscapeHeight(x, z), z], [h, h, h], Math.floor(r() * 4) * Math.PI / 2)) planted++;
      const bx = x - tangent.z * 1.5 - tangent.x * 1.2, bz = z + tangent.x * 1.5 - tangent.z * 1.2, s = 2.4 + r() * .8;
      placeNature(kit, getNature, 'bush', [bx, landscapeHeight(bx, bz), bz], [s, s, s], Math.floor(r() * 4) * Math.PI / 2);
    }
  }
  return planted;
}
/** Rounded stones half in the water along both banks, reed clumps on the lips and lily pads in the calm water
 *  near the banks, so the creek reads as a stream rather than a painted band. A separate random sequence
 *  keeps every other placement where it was. Nothing on the bridge's footprint. */
function creekDressing(kit: Kit, getNature: NatureFactory) {
  const r = rng(52114), bridge = (x: number, z: number) => Math.abs(x) < 4 && Math.abs(z - 36.5) < 7;
  const inside = (x: number, z: number) => x > groundBounds.x0 + 2 && x < groundBounds.x1 - 2 && z > groundBounds.z0 + 2 && z < groundBounds.z1 - 2;
  const place = (name: string, label: string, x: number, y: number, z: number, scale: V3) => {
    if (!inside(x, z) || bridge(x, z)) return;
    const object = getNature(name); object.name = label; object.scale.set(...scale); kit.add(object, [x, y, z], r() * Math.PI * 2);
  };
  for (let i = 4; i < 218; i += 2) {
    const t = i / 220, p = stream.getPoint(t), tangent = stream.getTangent(t), w = riverAt(p.x, p.z).halfWidth;
    for (const side of [-1, 1]) {
      const at = (offset: number) => [p.x - tangent.z * offset * side, p.z + tangent.x * offset * side] as const;
      if (r() < .45) {
        const [x, z] = at(w + .02 + r() * .22), s = .45 + r() * .6;
        place(r() < .5 ? 'rock_a' : 'rock_b', 'Blockcraft waterline stone', x, landscapeHeight(x, z) - .12, z, [s * 1.25, s * .75, s]);
      }
      if (r() < .2) {
        const [x, z] = at(w + .75 + r() * .25), s = 1.3 + r() * .5;
        place('grass', 'Blockcraft creek reeds', x, landscapeHeight(x, z), z, [s, s * 1.3, s]);
      }
    }
  }
  // Lily pads: small notched discs floating in clusters near the banks.
  const leaf = new THREE.Color('#58b94a');
  for (const [t, side] of [[.18, 1], [.27, -1], [.36, 1], [.6, -1], [.68, 1], [.77, -1], [.86, 1]] as const) {
    const p = stream.getPoint(t), tangent = stream.getTangent(t), w = riverAt(p.x, p.z).halfWidth;
    for (let k = 3 + Math.floor(r() * 3); k > 0; k--) {
      const along = (r() - .5) * 2.4, off = w - .45 - r() * .7, x = p.x + tangent.x * along - tangent.z * off * side, z = p.z + tangent.z * along + tangent.x * off * side;
      if (!inside(x, z) || bridge(x, z)) continue;
      const radius = .28 + r() * .22, geometry = new THREE.CircleGeometry(radius, 9, 0, Math.PI * 2 - .55);
      geometry.rotateX(-Math.PI / 2); geometry.rotateY(r() * Math.PI * 2);
      const pad = kit.mesh(geometry, '#' + leaf.clone().multiplyScalar(.9 + r() * .2).getHexString(), [x, CREEK_WATER_Y + .012, z]);
      pad.name = 'Creek lily pad'; pad.castShadow = false;
    }
  }
}
function buildBackdrop(kit: Kit) {
  // Two connected mountain ranges: long angular slopes, broad saddles and only
  // a few short plateau shoulders. Block-built detail belongs near the player;
  // the distant skyline must continue to read as a valley, not a curtain wall.
  // `facing` turns a range's long slope toward the valley (1: the range lies north and faces south).
  // Only the north has distant ranges: the later worlds lie along +Z, so the south is closed by the
  // wooded ridge alone and the route to them stays clear.
  const ridges = [
    // Forested blue-green, a step lighter than the near woods; grey-blue read as haze behind the cliffs.
    { z: -112, tint: '#86bf9c', heights: [12, 23, 33, 38, 31, 35, 43, 42, 33, 28, 34, 41, 38, 28, 30, 21, 9], phase: 1.4, shoulders: [3, 6, 11], facing: 1 },
    { z: -80, tint: '#68a882', heights: [8, 17, 24, 27, 24, 18, 23, 28, 25, 19, 16, 22, 29, 30, 24, 17, 7], phase: 3.1, shoulders: [3, 7, 13], facing: 1 },
  ];
  for (const ridge of ridges) {
    const spine: THREE.Vector3[] = [];
    for (let i = 0; i < ridge.heights.length; i++) {
      const x = -152 + i * 19 + (i === 0 || i === 16 ? 0 : Math.sin(i * 1.7 + ridge.phase) * 4);
      const z = ridge.z + Math.sin(i * .9 + ridge.phase) * 6, y = ridge.heights[i] - 2.5;
      if (ridge.shoulders.includes(i)) {
        // A short level shoulder breaks selected peaks; adjoining faces still
        // slope into their saddles rather than dropping down square columns.
        spine.push(new THREE.Vector3(x - 3.8, y - .4, z + .8), new THREE.Vector3(x + 2.2, y - .4, z - .5));
      } else spine.push(new THREE.Vector3(x, y, z));
    }
    const rows = [
      { depth: 35, fraction: 0, drift: 1.0 },
      { depth: 21, fraction: .38, drift: -.8 },
      { depth: 7, fraction: .79, drift: .35 },
      { depth: 0, fraction: 1, drift: 0 },
      { depth: -17, fraction: .63, drift: -.55 },
      { depth: -37, fraction: 0, drift: 1.0 },
    ];
    const grid = rows.map((row, rowIndex) => spine.map((crest, i) => {
      const end = i === 0 || i === spine.length - 1;
      const x = crest.x + (end ? 0 : Math.sin(i * 1.4 + ridge.phase) * 4 * row.drift);
      const y = -2.5 + (crest.y + 2.5) * row.fraction;
      const z = crest.z + row.depth * ridge.facing + (rowIndex === 3 ? 0 : Math.sin(i * .73 + rowIndex) * 3.5);
      return new THREE.Vector3(x, y, z);
    }));
    const positions: number[] = [], normals: number[] = [], colors: number[] = [];
    const tint = new THREE.Color(ridge.tint);
    for (let row = 0; row < rows.length - 1; row++) for (let i = 0; i < spine.length - 1; i++) {
      const a = grid[row][i], b = grid[row][i + 1], c = grid[row + 1][i], d = grid[row + 1][i + 1];
      // One face normal per broad quadrilateral avoids a regular triangle grid
      // in the lighting, while preserving the authored angular slope breaks.
      const across = b.clone().sub(a).add(d.clone().sub(c));
      const uphill = c.clone().sub(a).add(d.clone().sub(b));
      const normal = across.cross(uphill).normalize().multiplyScalar(ridge.facing);
      const color = tint.clone().multiplyScalar(.98 + rows[row].fraction * .035);
      for (const point of ridge.facing > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]) {
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mountain = new THREE.Mesh(geometry, materials.matte);
    mountain.name = 'Angular distant mountain ridge'; mountain.castShadow = false; mountain.receiveShadow = false;
    kit.group.add(mountain);
  }
}
/** The water between the two waterlines, 0.4 m below the meadow: strips across each section carry `creek`
 *  (across: 0 at one bank, 1 at the other; along: metres downstream) for the game's water shader
 *  (src/game/presentation/creekWater.ts: depth tint, flow, edge foam and glints). */
function buildWater() {
  const columns = 6, positions: number[] = [], normals: number[] = [], creekUv: number[] = [];
  let along = 0;
  for (let i = 0; i < riverSections.length - 1; i++) {
    const a = riverSections[i], b = riverSections[i + 1], ca = riverCenters[i], cb = riverCenters[i + 1], step = ca.distanceTo(cb);
    const centre = { x: (ca.x + cb.x) / 2, z: (ca.z + cb.z) / 2 };
    if (centre.x < groundBounds.x0 || centre.x > groundBounds.x1 || centre.z < groundBounds.z0 || centre.z > groundBounds.z1) { along += step; continue; }
    const at = (section: Point[], u: number) => ({ x: mix(section[WATERLINE].x, section[LAST_ROW - WATERLINE].x, u), z: mix(section[WATERLINE].z, section[LAST_ROW - WATERLINE].z, u) });
    for (let j = 0; j < columns; j++) {
      const u0 = j / columns, u1 = (j + 1) / columns, p = [[at(a, u0), u0, along], [at(a, u1), u1, along], [at(b, u1), u1, along + step], [at(b, u0), u0, along + step]] as const;
      // Two triangles per cell, wound upward.
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        const [q0, q1, q2] = tri.map(k => p[k]), up = (q1[0].x - q0[0].x) * (q2[0].z - q0[0].z) - (q1[0].z - q0[0].z) * (q2[0].x - q0[0].x) < 0;
        for (const q of up ? [q0, q1, q2] : [q0, q2, q1]) { positions.push(q[0].x, CREEK_WATER_Y, q[0].z); normals.push(0, 1, 0); creekUv.push(q[1], q[2]); }
      }
    }
    along += step;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('creek', new THREE.Float32BufferAttribute(creekUv, 2));
  const material = new THREE.MeshLambertMaterial({ color: '#36b9c9' }); material.name = 'Creek water';
  const water = new THREE.Mesh(geometry, material); water.name = 'Creek water';
  water.castShadow = false; water.receiveShadow = true; water.userData.keepDynamic = true;
  return [water];
}

export function buildLandscape(getNature: NatureFactory): { group: THREE.Group; water: THREE.Mesh[] } {
  random = rng(712044);
  const kit = new Kit(); kit.group.name = 'Pinewind playable valley';
  buildGround(kit); buildEdging(kit); buildQuarry(kit, getNature); buildPaths(kit); buildBackdrop(kit); buildCliffs(kit, getNature); plantings(kit, getNature); meadowDetails(kit, getNature); creekDressing(kit, getNature); creekEnds(kit, getNature);
  kit.group.traverse(o=>{if(o instanceof THREE.Mesh && /Flowing meadow|Inset polygon|turf lips|creek banks/.test(o.name)){o.userData.surfaceGround=true;o.castShadow=false;}});
  return { group: kit.group, water: buildWater() };
}
