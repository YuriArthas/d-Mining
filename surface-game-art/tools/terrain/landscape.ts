import * as THREE from 'three';
import { Kit, materials, rng, type V3 } from './kit.ts';
import { createGroundTexture, createStoneTexture, createWaterTexture, createPathTexture, groundTextureBounds } from './terrainTexture.ts';

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

const stream = new THREE.CatmullRomCurve3([
  [64,-70],[57,-30],[54,10],[52,32],[44,51],[28,49],[15,39],[0,36.5],[-18,40],[-38,50],[-70,55],[-110,57],
].map(([x,z])=>new THREE.Vector3(x,0,z)));
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
  return { distance: Math.sqrt(distanceSquared), halfWidth: 2.45 + .22 * Math.sin(t * 14), t };
}

/** The broad valley supports a faceted creek, without a visible world voxel grid. */
function meadowHeight(x: number, z: number) {
  // The plaza and the route to the next world's gate remain on the gameplay floor.
  if(Math.abs(x)<12 && z>50)return .035;
  const upland=smooth(53,92,Math.abs(x))*7.5+smooth(33,77,-z)*8;
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
const riverSections = riverCenters.map((center, index) => {
  const previous = riverCenters[Math.max(0, index - 1)], next = riverCenters[Math.min(riverCenters.length - 1, index + 1)];
  const tangent = next.clone().sub(previous).normalize(), width = riverAt(center.x, center.z).halfWidth;
  const offsets = [-(width + 1.05), -(width + .70), -(width - .05), -(width - .35), 0, width - .35, width - .05, width + .70, width + 1.05];
  return offsets.map((offset, row) => {
    const x = center.x - tangent.z * offset, z = center.z + tangent.x * offset;
    const y = row === 0 || row === 8 ? meadowHeight(x, z) : row === 1 || row === 7 ? .04 : row === 2 || row === 6 ? .02 : .01;
    return { x, y, z };
  });
});
const riverCorridor: Polygon[] = [], bankBoundary: Array<[Point, Point]> = [], bankFaces: Array<{ polygon: Polygon; row: number }> = [];
for (let i = 0; i < riverSections.length - 1; i++) {
  const a = riverSections[i], b = riverSections[i + 1];
  riverCorridor.push(polygon([a[0], a[8], b[8], b[0]]));
  bankBoundary.push([a[0], b[0]], [a[8], b[8]]);
  for (let row = 0; row < 8; row++) bankFaces.push({ polygon: polygon([a[row], a[row + 1], b[row + 1], b[row]]), row });
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

const paths = [
 {width:2.7,points:[[0,80],[0,54],[0,46],[0,36.5],[0,26],[0,16],[0,8]]},
 {width:2.0,points:[[0,25],[-7,23],[-17,18.7],[-13,8],[-13,-4],[-20,-6.3]]},
 {width:2.2,points:[[0,25],[12,25],[20,29],[22,39],[22,45]]},
 {width:2.0,points:[[-17,18.7],[-23,24],[-23,38],[-23,48],[-12,47],[0,46]]},
 {width:1.7,points:[[20,29],[22,20],[22,15.5],[27,15.5]]},
 {width:1.7,points:[[22,39],[22,44.5],[27,44.5]]},
].map(path=>({width:path.width,curve:new THREE.CatmullRomCurve3(path.points.map(([x,z])=>new THREE.Vector3(x,0,z)))}));
const pathPoints = paths.map(path => ({ width: path.width, points: path.curve.getPoints(90) }));
function pathDistance(x: number, z: number) {
  let nearest = Infinity;
  for (const path of pathPoints) for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i], b = path.points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / Math.max(.0001, dx * dx + dz * dz), 0, 1);
    nearest = Math.min(nearest, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - path.width);
  }
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
  const white = new THREE.Color('#ffffff'), earth = new THREE.Color('#c7a36e');
  const roadRegions: Polygon[] = [];
  for (const path of paths) {
    const points = path.curve.getSpacedPoints(Math.ceil(path.curve.getLength() / 2.5));
    const sides = points.map((center, index) => {
      const tangent = points[Math.min(points.length - 1, index + 1)].clone().sub(points[Math.max(0, index - 1)]).normalize();
      return [-1, 1].map(sign => ({ x: center.x - tangent.z * path.width * sign, y: 0, z: center.z + tangent.x * path.width * sign }));
    });
    for (let i = 0; i < sides.length - 1; i++) roadRegions.push(polygon([sides[i][0], sides[i][1], sides[i + 1][1], sides[i + 1][0]]));
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
      if (face.row === 0 || face.row === 7) emitSurface(lips, clipped, white, 'ground');
      else emitSurface(banks, clipped, earth, 'bank');
    }
  }
  kit.group.add(meshFromData(lips, grassMaterial, 'Shared bevelled turf lips'));
  const bank = meshFromData(banks, bankMaterial, 'Continuous faceted creek banks'); bank.castShadow = true; kit.group.add(bank);
}

function placeNature(kit: Kit, getNature: NatureFactory, name: string, position: V3, scale: V3, yaw = 0) {
  const [x,,z]=position;
  if(Math.abs(x)<10&&Math.abs(z)<10)return;
  if(x>20&&x<46&&z>12&&z<48)return;
  if(x>-31&&x<-22&&z>12&&z<51)return;
  if(Math.hypot(x+17,z-12)<7||Math.hypot(x+20,z+13)<6||Math.hypot(x-34,z-8)<7)return;
  if(Math.abs(x)<7&&z>30)return;
  if(Math.hypot(x-12,z-30)<4||Math.hypot(x-10.8,z-12)<4)return;

  const object = getNature(name); object.name = `Blockcraft ${name}`;
  object.scale.set(...scale); kit.add(object, position, yaw); return object;
}
function placeRock(kit: Kit, getNature: NatureFactory, position: V3, size: V3, yaw: number, variant = 0) {
  return placeNature(kit, getNature, variant % 2 ? 'rock_b' : 'rock_a', position, size, yaw);
}
function buildQuarry(kit: Kit, getNature: NatureFactory) {
  for(const x of [-8.45,8.45])kit.box([x,.12,0],[.42,.24,16.7],'#d2bb80',[0,0,0],.04);
  kit.box([0,.12,-8.45],[17.3,.24,.42],'#d2bb80',[0,0,0],.04);
}
function buildPaths(kit: Kit) {
  // Deliberate square paving clusters, not a smooth overlay hiding painted edges.
  for (const [cx, cz] of [[0,16],[-17,18.7],[-20,-6.3],[22,29],[0,47]]) {
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
  const grassCenters = [[-26, 12], [-26, 22], [-10, 24], [12, 29], [25, 8], [31, 15], [-13, -23], [14, -24]];
  for (let clump = 0; clump < 64; clump++) {
    const center = grassCenters[clump % grassCenters.length], a = random() * Math.PI * 2, d = Math.sqrt(random()) * 3.4;
    const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    if (pathDistance(x, z) < 1 || riverAt(x, z).distance < 4) continue;
    const s = .9 + random() * .4;
    placeNature(kit, getNature, 'grass', [x, landscapeHeight(x, z), z], [s, s, s], clump % 4 * Math.PI / 2);
  }
}
function buildBackdrop(kit: Kit, getNature: NatureFactory) {
  for (const [x, z, w, h, d, seed] of [
    [-31, -32, 7, 8, 6, 11], [-20, -39, 9, 10, 7, 23], [-6, -43, 11, 11, 7, 37],
    [10, -42, 10, 12, 7, 43], [24, -35, 8, 8, 6, 59],
    [-39, -21, 6, 6, 8, 67], [42, -23, 6, 8, 10, 79],
  ]) {
    placeNature(kit, getNature, 'cliff', [x, landscapeHeight(x, z) - .2, z], [w, h, d], (seed % 4) * Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const a = .55 + i * 1.35, bx = x + Math.cos(a) * w * .76, bz = z + Math.sin(a) * d * .76;
      placeRock(kit, getNature, [bx, landscapeHeight(bx, bz) - .1, bz], [w * .27, h * (.2 + i * .055), d * .28], i * Math.PI / 2, i);
    }
  }
  // Two connected mountain ranges: long angular slopes, broad saddles and only
  // a few short plateau shoulders. Block-built detail belongs near the player;
  // the distant skyline must continue to read as a valley, not a curtain wall.
  const ridges = [
    { z: -112, tint: '#7cadd0', heights: [12, 23, 33, 38, 31, 35, 43, 42, 33, 28, 34, 41, 38, 28, 30, 21, 9], phase: 1.4, shoulders: [3, 6, 11] },
    { z: -80, tint: '#608fae', heights: [8, 17, 24, 27, 24, 18, 23, 28, 25, 19, 16, 22, 29, 30, 24, 17, 7], phase: 3.1, shoulders: [3, 7, 13] },
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
      const z = crest.z + row.depth + (rowIndex === 3 ? 0 : Math.sin(i * .73 + rowIndex) * 3.5);
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
      const normal = across.cross(uphill).normalize();
      const color = tint.clone().multiplyScalar(.98 + rows[row].fraction * .035);
      for (const point of [a, b, c, b, d, c]) {
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
function buildWater() {
  const data = meshData(), white = new THREE.Color('#ffffff');
  for (let i = 0; i < riverSections.length - 1; i++) {
    const a = riverSections[i], b = riverSections[i + 1];
    const surface = polygon([a[2], a[6], b[6], b[2]].map(p => ({ x: p.x, y: .055, z: p.z })));
    emitSurface(data, cutPolygon(surface.points, worldPolygon).inside, white, 'water');
  }
  const material = new THREE.MeshLambertMaterial({ map: createWaterTexture() });
  const water = meshFromData(data, material, 'Bright polygon creek with broad pixel glints');
  water.castShadow = false; water.userData.keepDynamic = true;
  return [water];
}

export function buildLandscape(getNature: NatureFactory): { group: THREE.Group; water: THREE.Mesh[] } {
  random = rng(712044);
  const kit = new Kit(); kit.group.name = 'Pinewind playable valley';
  buildGround(kit); buildQuarry(kit, getNature); buildPaths(kit); buildBackdrop(kit, getNature); plantings(kit, getNature); meadowDetails(kit, getNature);
  kit.group.traverse(o=>{if(o instanceof THREE.Mesh && /Flowing meadow|Inset polygon|turf lips|creek banks/.test(o.name)){o.userData.surfaceGround=true;o.castShadow=false;}});
  return { group: kit.group, water: buildWater() };
}
