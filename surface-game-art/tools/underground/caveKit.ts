// Offline: the shared cave shell every underground rest hall is built from. A craggy shell of faceted rock masses
// hides the voxel walls and ceiling of the 40 x 40 x 20 m room, stalactites hang from it, irregular flagstones
// carpet the floor ring round the open 16 m mine pit, and the service stalls, name board and lantern posts from
// the hall's Blender kit stand where its data puts them. Each hall's builder calls these steps in order with its
// own palette and adds its landmarks between them. Colliders: rock masses as convex hulls, props as boxes.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rng } from '../terrain/kit.ts';
import type { HallDefinition } from '../../../src/game/content/underground/hall.ts';

export type HallSolid = { at: number[]; half: number[]; yaw: number; hull?: number[] };
export type GetProp = (name: string) => THREE.Object3D;
type Tint = (f: number) => THREE.Color;

export const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** Vertex-coloured materials (converted to the game's standard material on export). Glow materials keep their
 *  emissive colour and must have "glow" in their name: they cast no occlusion. */
export const matte = (name: string) => Object.assign(new THREE.MeshLambertMaterial({ vertexColors: true }), { name });
export const glow = (name: string, color: string, strength: number) => Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffffff', emissive: color, emissiveIntensity: strength, roughness: .6 }), { name });

/** Per-face vertex colours: `pick` gets each triangle's mean height, its first vertex index and its normal. */
export function colour(g: THREE.BufferGeometry, pick: (y: number, i: number, n: THREE.Vector3) => THREE.Color) {
  const p = g.getAttribute('position'), nrm = g.getAttribute('normal'), out = new Float32Array(p.count * 3), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; n.fromBufferAttribute(nrm, i);
    const c = pick(y, i, n);
    for (let k = 0; k < 3; k++) c.toArray(out, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A faceted rock mass: a convex hull of jittered rings (profile: [height fraction, radius factor]). */
export function rockMass(r: () => number, x: number, z: number, radius: number, y0: number, y1: number, profile: readonly (readonly [number, number])[], tint: Tint, sides = 7) {
  const spin = r() * Math.PI * 2, points: THREE.Vector3[] = [];
  for (const [f, k] of profile) for (let i = 0; i < sides; i++) {
    const a = spin + (i + (r() - .5) * .6) / sides * Math.PI * 2, rr = radius * k * (.82 + r() * .32);
    points.push(new THREE.Vector3(x + Math.cos(a) * rr, y0 + (y1 - y0) * f, z + Math.sin(a) * rr));
  }
  const g = new ConvexGeometry(points), shade = rng(Math.floor(x * 97 + z * 13 + y0 * 7));
  colour(g, y => tint((y - y0) / Math.max(.01, y1 - y0)).clone().multiplyScalar(.9 + shade() * .16));
  return { geometry: g, points };
}

/** A small faceted solid for glints, specks and beads. */
export function gem(radius: number, x: number, y: number, z: number, colourHex = '#ffffff') {
  const g = new THREE.OctahedronGeometry(radius, 0).toNonIndexed(); g.computeVertexNormals(); g.translate(x, y, z);
  return colour(g, () => new THREE.Color(colourHex));
}

/** The hall's colours. Rock and ceiling gradients run bottom to top. */
export type CavePalette = Readonly<{
  rock: readonly [string, string]; upper: readonly [string, string]; ceiling: readonly [string, string];
  stalactite: readonly [string, string]; joint: string; stones: readonly string[]; curb: string;
}>;
type P2 = [number, number];
/** The floor ring's paving (see caveKit().floor); `stones` overrides the palette's stone colours, `height` the
 *  range of stone heights (keep under 9 cm: the player walks on a 4 cm slab). */
export type FloorStyle = Readonly<{ stones?: readonly string[]; height?: readonly [number, number] }> & (
  | Readonly<{ kind: 'flags' }>
  | Readonly<{ kind: 'shards'; size: number; gap: number }>
  | Readonly<{ kind: 'hex'; radius: number; gap: number }>
  | Readonly<{ kind: 'planks'; width: number; gap: number; missing?: number }>
  | Readonly<{ kind: 'ashlar'; row: readonly [number, number]; width: readonly [number, number]; gap: number; cracked: number; missing: number }>);
/** Keep the part of a convex polygon where nx * x + nz * z >= d. */
function clip(poly: P2[], nx: number, nz: number, d: number) {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = nx * a[0] + nz * a[1] - d, db = nx * b[0] + nz * b[1] - d;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const centre = (poly: P2[]): P2 => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
const area = (poly: P2[]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/** Pull every corner toward the centre by half the joint width. */
function shrink(poly: P2[], gap: number) {
  if (poly.length < 3) return [];
  const [cx, cz] = centre(poly);
  return poly.map(([x, z]): P2 => { const d = Math.hypot(x - cx, z - cz), k = Math.max(0, 1 - gap / 2 / Math.max(d, 1e-6)); return [cx + (x - cx) * k, cz + (z - cz) * k]; });
}
/** Round areas the lower wall masses and wall-foot props keep clear of at floor level (landmarks). */
export type KeepOut = Readonly<{ x: number; z: number; radius: number }>;

export function caveKit(hall: HallDefinition, seed: number, palette: CavePalette, keepOut: readonly KeepOut[] = []) {
  const group = new THREE.Group(); group.name = `${hall.id} hall`;
  const solids: HallSolid[] = [], r = rng(seed);
  const HALF = hall.size[0] / 2, TOP = hall.size[1], PIT = hall.pit;
  const M = { rock: matte('Cave rock'), ceiling: matte('Cave ceiling'), floor: matte('Cave flagstones') };
  const hull = (points: THREE.Vector3[]) => {
    const b = new THREE.Box3().setFromPoints(points), c = b.getCenter(new THREE.Vector3()), h = b.getSize(new THREE.Vector3()).multiplyScalar(.5);
    solids.push({ at: c.toArray(), half: h.toArray(), yaw: 0, hull: points.flatMap(p => [p.x - c.x, p.y - c.y, p.z - c.z].map(v => +v.toFixed(4))) });
  };
  const box = (at: readonly number[], half: readonly number[], yaw = 0) => solids.push({ at: [...at], half: [...half], yaw });
  const add = (mesh: THREE.Mesh, name?: string) => { mesh.castShadow = mesh.receiveShadow = true; if (name) mesh.name = name; group.add(mesh); return mesh; };
  const place = (name: string, at: readonly number[], yaw = 0, scale = 1) => {
    const p = getPropRef.current!(name); p.position.set(at[0], at[1], at[2]); p.rotation.y = yaw; p.scale.setScalar(scale); group.add(p); return p;
  };
  const getPropRef: { current: GetProp | null } = { current: null };
  const inPit = (x: number, z: number, margin = .6) => Math.abs(x) < PIT + margin && Math.abs(z) < PIT + margin;
  /** A point a little in from one wall: side 0 north, 1 south, 2 west, 3 east; `d` runs along it. */
  const alongWall = (side: number, d: number, inset: number): [number, number] => side === 0 ? [d, -inset] : side === 1 ? [d, inset] : side === 2 ? [-inset, d] : [inset, d];

  const stalls = [hall.stalls.sell, hall.stalls.shop].filter(s => !!s);
  const stallBoxes = stalls.map(({ at: [x, , z] }) => ({ x0: x - 3.2, x1: x + 3.2, z0: z - 2.2, z1: z + 2.2 }));
  /** Clear of the stalls, the name board and the landmarks, by `reach`. */
  const clearOf = (x: number, z: number, reach: number) =>
    !stallBoxes.some(b => x + reach > b.x0 && x - reach < b.x1 && z + reach > b.z0 && z - reach < b.z1) &&
    !(Math.abs(x - hall.board[0]) < 5.2 && z - reach < hall.board[2] + 1) &&
    !keepOut.some(k => Math.hypot(x - k.x, z - k.z) < reach + k.radius);

  return {
    group, solids, r, M, HALF, TOP, PIT, hull, box, add, place, clearOf, inPit, alongWall,
    /** Props come from the hall's Blender kit, cloned at the origin. */
    useProps(getProp: GetProp) { getPropRef.current = getProp; },

    /** WALLS: two tiers of masses along every wall, their backs beyond the voxel wall. The lower tier is chunky
     *  and shrinks back where it would crowd a stall, the board or a landmark; the upper tier leans further in,
     *  under the ceiling. Then one big mass per corner. `open` leaves out the masses (of either tier) it accepts by
     *  centre and radius, for a facade the hall builds there instead. */
    walls(open: (x: number, z: number, radius: number) => boolean = () => false) {
      const rockTint: Tint = f => lerp(palette.rock[0], palette.rock[1], smooth(.1, .9, f));
      const upperTint: Tint = f => lerp(palette.upper[0], palette.upper[1], smooth(.2, 1, f));
      for (const [wall, along] of [['n', 1], ['s', 1], ['w', 0], ['e', 0]] as const) {
        for (let d = -HALF - 1; d < HALF + 1; d += 3.6 + r() * 1.6) {
          const sign = wall === 'n' || wall === 'w' ? -1 : 1, wallX = (v: number, inset: number) => along ? [v, sign * (HALF - inset)] : [sign * (HALF - inset), v];
          let radius = 2.4 + r() * 1.2, inset = radius * (-.1 + r() * .3);
          let [x, z] = wallX(d, inset);
          const face = () => wallX(d, inset + radius);
          for (let tries = 0; tries < 4 && !clearOf(face()[0], face()[1], .4); tries++) { radius *= .78; inset = -radius * .25; [x, z] = wallX(d, inset); }
          const lowTop = 6 + r() * 7;
          const low = rockMass(r, x, z, radius, -.6, lowTop, [[0, .96], [.32, 1], [.66, .9], [1, .62]], rockTint);
          if (!open(x, z, radius)) { add(new THREE.Mesh(low.geometry, M.rock), 'Cave wall mass'); hull(low.points); }
          const upRadius = 2.8 + r() * 1.6, upAt = d + (r() - .5) * 1.8;
          let upInset = upRadius * (.35 + r() * .3);
          // Over the name board it stays behind the board's face.
          if (wall === 'n' && Math.abs(upAt - hall.board[0]) < 4.4 + upRadius) upInset = Math.min(upInset, HALF + hall.board[2] - upRadius * 1.1);
          const [ux, uz] = wallX(upAt, upInset);
          const up = rockMass(r, ux, uz, upRadius, lowTop - 1.5, TOP + 1, [[0, .7], [.3, 1], [.75, 1.05], [1, 1]], upperTint);
          if (!open(ux, uz, upRadius)) add(new THREE.Mesh(up.geometry, M.rock), 'Cave wall upper mass');
        }
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const m = rockMass(r, sx * (HALF - 1), sz * (HALF - 1), 4.2, -.6, TOP + 1, [[0, .9], [.4, 1], [1, .95]], rockTint);
        add(new THREE.Mesh(m.geometry, M.rock), 'Cave corner mass'); hull(m.points);
      }
    },

    /** CEILING: broad slabs a little under the voxel ceiling, then stalactites over the floor ring; a share of
     *  their tips get a glint in one of `tips` (picked evenly). `open` leaves out slabs and stalactites by centre. */
    ceiling(stalactites = 70, tips: readonly THREE.Material[] = [], tipChance = .22, open: (x: number, z: number) => boolean = () => false) {
      const ceilingTint: Tint = f => lerp(palette.ceiling[0], palette.ceiling[1], f);
      for (let x = -HALF; x < HALF; x += 6.5) for (let z = -HALF; z < HALF; z += 6.5) {
        const cx = x + 3.25 + (r() - .5) * 2, cz = z + 3.25 + (r() - .5) * 2, base = TOP - 2.6 - r() * 2.2;
        const slab = rockMass(r, cx, cz, 4.6 + r() * 1.2, base, TOP + .8, [[0, .62], [.4, 1], [1, 1]], ceilingTint);
        if (!open(cx, cz)) add(new THREE.Mesh(slab.geometry, M.ceiling), 'Cave ceiling slab');
      }
      const stalTint = new THREE.Color(palette.stalactite[0]);
      for (let i = 0; i < stalactites; i++) {
        const a = r() * Math.PI * 2, d = 6 + r() * 12.5, x = Math.cos(a) * d * 1.08, z = Math.sin(a) * d * 1.08;
        if (Math.abs(x) > HALF - 1.5 || Math.abs(z) > HALF - 1.5) continue;
        const length = 1.6 + r() * 4.2, radius = .45 + r() * .7, top = TOP - 1.4 - r() * 1.6;
        if (open(x, z)) continue;
        const g = new THREE.ConeGeometry(radius, length, 6, 1).rotateX(Math.PI).toNonIndexed(); g.computeVertexNormals();
        g.translate(x, top - length / 2, z);
        colour(g, (y) => stalTint.clone().lerp(new THREE.Color(palette.stalactite[1]), smooth(top, top - length, y)));
        add(new THREE.Mesh(g, M.ceiling), 'Cave stalactite');
        if (tips.length && r() < tipChance) {
          const size = .18 + r() * .12, material = tips[Math.floor(r() * tips.length)];
          add(new THREE.Mesh(gem(size, x, top - length - .05, z), material), 'Cave glow tip');
        }
      }
    },

    /** FLOOR RING: the joint ground (palette.joint; `joint` may make it glow, as lava or crystal seams), then the
     *  hall's own paving over it (visual only), and the walkable slabs the player stands on (4 cm). Paving kinds:
     *  flags: large irregular six-sided flags on a staggered grid (蘑菇洞穴);
     *  shards: random cells of a jittered grid (crazy paving, ice plates), `size` apart;
     *  hex: basalt column tops of `radius`, each at its own height;
     *  planks: boards of random length pointing at the walls, a few missing;
     *  ashlar: rows of laid slabs of random width, a few cracked in two or missing. */
    floor(style: FloorStyle = { kind: 'flags' }, joint?: THREE.Material) {
      for (const [x0, x1, z0, z1] of [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]]) {
        const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).toNonIndexed(); g.translate((x0 + x1) / 2, .006, (z0 + z1) / 2);
        colour(g, () => new THREE.Color(palette.joint)); add(new THREE.Mesh(g, joint ?? M.floor), 'Cave floor joints');
      }
      const tints = (style.stones ?? palette.stones).map(c => new THREE.Color(c));
      const tint = () => tints[Math.floor(r() * tints.length)].clone().multiplyScalar(.9 + r() * .18);
      const [h0, h1] = style.kind === 'flags' ? [.03, .06] : style.height ?? [.03, .06];
      const slab = (poly: P2[], gap: number, h = h0 + r() * (h1 - h0), c = tint()) => {
        const cut = shrink(outsidePit(poly), gap);
        if (area(cut) < .04) return;
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(cut.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.computeVertexNormals();
        add(new THREE.Mesh(colour(g, () => c), M.floor), 'Cave flagstone');
      };
      // A polygon outside the pit: cut along the pit side its centre lies beyond (the curb covers the seam).
      const outsidePit = (poly: P2[]) => {
        const [cx, cz] = centre(poly), ax = Math.abs(cx) - PIT, az = Math.abs(cz) - PIT;
        if (ax < 0 && az < 0) return [];
        return ax >= az ? clip(poly, Math.sign(cx), 0, PIT) : clip(poly, 0, Math.sign(cz), PIT);
      };
      if (style.kind === 'flags') {
        // Large irregular flags on a staggered grid, each a little turned, so the floor never reads as tiles.
        for (let row = 0, z = -HALF; z < HALF; z += 2.6, row++) for (let x = -HALF - (row % 2) * 1.3; x < HALF; x += 2.6) {
          const cx = x + 1.3 + (r() - .5) * .3, cz = z + 1.3 + (r() - .5) * .3, turn = (r() - .5) * .25;
          if (inPit(cx, cz)) continue;
          const corners = [[-1, -.6], [-.3, -1], [1, -.85], [.9, .4], [.4, 1], [-.95, .8]].map(([u, v]) => {
            const k = 1.22 - r() * .16, px = u * k, pz = v * k;
            return new THREE.Vector2(cx + px * Math.cos(turn) - pz * Math.sin(turn), cz + px * Math.sin(turn) + pz * Math.cos(turn));
          });
          const h = .03 + r() * .03;
          const g = new THREE.ExtrudeGeometry(new THREE.Shape(corners.map(p => new THREE.Vector2(p.x, -p.y))), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.computeVertexNormals();
          const c = tints[Math.floor(r() * tints.length)].clone().multiplyScalar(.92 + r() * .14);
          add(new THREE.Mesh(colour(g, () => c), M.floor), 'Cave flagstone');
        }
      } else if (style.kind === 'shards') {
        const n = Math.ceil(HALF * 2 / style.size) + 2, sites: P2[][] = [];
        for (let i = 0; i < n; i++) { sites.push([]); for (let j = 0; j < n; j++) sites[i].push([-HALF + (i - .5 + r() * .8 + .1) * style.size, -HALF + (j - .5 + r() * .8 + .1) * style.size]); }
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const [px, pz] = sites[i][j], e = style.size * 1.6;
          let cell: P2[] = [[px - e, pz - e], [px + e, pz - e], [px + e, pz + e], [px - e, pz + e]];
          for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
            const q = sites[i + di]?.[j + dj]; if (!q || (!di && !dj)) continue;
            // Keep the side nearer this site: (q - p) . x <= (|q|^2 - |p|^2) / 2.
            cell = clip(cell, px - q[0], pz - q[1], (px * px + pz * pz - q[0] * q[0] - q[1] * q[1]) / 2);
          }
          slab(cell, style.gap);
        }
      } else if (style.kind === 'hex') {
        const R = style.radius, w = R * 1.5, hgt = R * Math.sqrt(3);
        for (let i = -Math.ceil(HALF / w) - 1; i <= Math.ceil(HALF / w) + 1; i++) for (let j = -Math.ceil(HALF / hgt) - 1; j <= Math.ceil(HALF / hgt) + 1; j++) {
          const cx = i * w, cz = j * hgt + (i & 1 ? hgt / 2 : 0);
          slab(Array.from({ length: 6 }, (_, k): P2 => [cx + Math.cos(k * Math.PI / 3) * R, cz + Math.sin(k * Math.PI / 3) * R]), style.gap);
        }
      } else if (style.kind === 'planks') {
        // North and south of the pit the boards run north-south, east and west they run east-west: toward the walls.
        for (const along of ['z', 'x'] as const) for (let u = -HALF; u < HALF; u += style.width) {
          for (let v = -HALF - r() * 2; v < HALF;) {
            const length = 1.4 + r() * 2, mid = v + length / 2, x = along === 'z' ? u + style.width / 2 : mid, z = along === 'z' ? mid : u + style.width / 2;
            const ours = along === 'z' ? Math.abs(z) >= Math.abs(x) : Math.abs(x) > Math.abs(z);
            if (ours && r() >= (style.missing ?? 0)) {
              const [a0, a1, b0, b1] = along === 'z' ? [u, u + style.width, v, v + length] : [v, v + length, u, u + style.width];
              slab([[a0, b0], [a1, b0], [a1, b1], [a0, b1]], style.gap);
            }
            v += length;
          }
        }
      } else {
        for (let z = -HALF; z < HALF;) {
          const depth = style.row[0] + r() * (style.row[1] - style.row[0]);
          for (let x = -HALF - r() * 2; x < HALF;) {
            const width = style.width[0] + r() * (style.width[1] - style.width[0]), roll = r();
            const rect: P2[] = [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth]];
            if (roll < style.missing) { /* a lost slab: the joint ground shows */ }
            else if (roll < style.missing + style.cracked) {
              // Cracked across: two pieces split along a line from the near edge to the far edge.
              const t0 = x + width * (.25 + r() * .5), t1 = x + width * (.25 + r() * .5), c = tint(), h = h0 + r() * (h1 - h0);
              slab([[x, z], [t0, z], [t1, z + depth], [x, z + depth]], style.gap, h, c);
              slab([[t0, z], [x + width, z], [x + width, z + depth], [t1, z + depth]], style.gap, h - .01, c);
            } else slab(rect, style.gap);
            x += width;
          }
          z += depth;
        }
      }
      // Low enough that standing here still counts as the room's floor (PlayerDepth: within the spawn clearance).
      for (const [x0, x1, z0, z1] of [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]])
        box([(x0 + x1) / 2, .02, (z0 + z1) / 2], [(x1 - x0) / 2, .02, (z1 - z0) / 2]);
    },

    /** Spots along the wall feet for ground patches (moss, snow, ash): `count` of them, plus `extra`. */
    wallSpots(count: number, extra: readonly (readonly [number, number, number])[] = []) {
      const spots: [number, number, number][] = extra.map(s => [...s] as [number, number, number]);
      for (let i = 0; i < count; i++) {
        const side = Math.floor(r() * 4), d = (r() - .5) * 34, inset = HALF - 2.4 - r() * 1.6;
        spots.push([...alongWall(side, d, inset), 1.4 + r() * 1.4]);
      }
      return spots;
    },
    /** Soft blobs slightly above the flagstones, each scattered with glowing specks (`specks[0]` with
     *  chance `split`, else `specks[1]`). */
    patches(spots: readonly (readonly [number, number, number])[], material: THREE.Material, tint: string, name: string, specks: readonly THREE.Material[] = [], split = .6, density = 3) {
      for (const [x, z, radius] of spots) {
        if (inPit(x, z)) continue;
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = radius * (.7 + r() * .5); pts.push(new THREE.Vector2(x + Math.cos(a) * rr, -(z + Math.sin(a) * rr))); }
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .06, bevelEnabled: false }).rotateX(-Math.PI / 2).toNonIndexed(); g.translate(0, .045, 0); g.computeVertexNormals();
        colour(g, () => new THREE.Color(tint).multiplyScalar(.85 + r() * .3));
        add(new THREE.Mesh(g, material), name);
        if (!specks.length) continue;
        for (let k = 0; k < Math.round(radius * density); k++) {
          const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * radius * .8;
          const speck = gem(.05 + r() * .05, x + Math.cos(a) * rr, .12, z + Math.sin(a) * rr);
          add(new THREE.Mesh(speck, r() < split || specks.length === 1 ? specks[0] : specks[1]), `${name} glow`);
        }
      }
    },

    /** PIT RIM: a low curb round the open pit, open in the middle of every side, a post prop per corner. */
    pitRim(post = 'Pit_Post') {
      const curbTint = new THREE.Color(palette.curb);
      for (const side of [-1, 1]) for (const [a0, a1] of [[-PIT - .6, -1.6], [1.6, PIT + .6]]) {
        for (const axis of ['x', 'z'] as const) {
          const len = a1 - a0, mid = (a0 + a1) / 2;
          const g = new THREE.BoxGeometry(axis === 'x' ? len : .55, .28, axis === 'x' ? .55 : len).toNonIndexed(); g.computeVertexNormals();
          const at = axis === 'x' ? [mid, .14, side * (PIT + .3)] : [side * (PIT + .3), .14, mid];
          g.translate(at[0], at[1], at[2]); colour(g, (y) => curbTint.clone().multiplyScalar(y > .2 ? 1.12 : .9));
          add(new THREE.Mesh(g, M.floor), 'Cave pit curb');
          box(at, axis === 'x' ? [len / 2, .14, .275] : [.275, .14, len / 2]);
        }
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) place(post, [sx * (PIT + .5), 0, sz * (PIT + .5)], r() * 6);
    },

    /** Hanging strands found by casting rays up to the rock: beads in `beads` (two picked evenly), a strand. */
    hangers(count: number, beads: readonly THREE.Material[], strand: THREE.Material, strandTint: string) {
      const rocks: THREE.Mesh[] = []; group.updateMatrixWorld(true);
      group.traverse(o => { if (o instanceof THREE.Mesh && (o.material === M.rock || o.material === M.ceiling)) rocks.push(o); });
      const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const x = (r() - .5) * 34, z = (r() - .5) * 34;
        if (Math.abs(x) < PIT && Math.abs(z) < PIT && r() < .7) continue;
        ray.set(new THREE.Vector3(x, 8, z), up); ray.far = 20;
        const hit = ray.intersectObjects(rocks, false)[0]; if (!hit) continue;
        const length = 2 + r() * 4.5, count = Math.round(length / .42), material = r() < .5 || beads.length === 1 ? beads[0] : beads[1];
        for (let k = 0; k < count; k++)
          add(new THREE.Mesh(gem(.09 + (k % 3 === 0 ? .06 : 0), x + Math.sin(k * .9) * .08, hit.point.y - .2 - k * .42, z + Math.cos(k * .7) * .08), material), 'Cave glow vine');
        const g = new THREE.CylinderGeometry(.025, .025, length, 4).toNonIndexed(); g.computeVertexNormals();
        g.translate(x, hit.point.y - .2 - length / 2, z); colour(g, () => new THREE.Color(strandTint));
        add(new THREE.Mesh(g, strand), 'Cave vine strand');
      }
    },

    /** The service stalls (Stall_Sell, Stall_Shop), the name board and lantern posts. Every hall's stall keeps the
     *  same footprint and colliders (cave_props.py): a counter in front, two back posts and a back shelf. */
    services(lanterns: readonly (readonly [number, number, number])[] = [[-3.6, 15.2, 0], [3.6, 15.2, Math.PI], [-8.8, -12.6, 0], [8.8, -12.6, Math.PI]]) {
      for (const [name, stall] of [['Stall_Sell', hall.stalls.sell], ['Stall_Shop', hall.stalls.shop]] as const) {
        if (!stall) continue;
        place(name, stall.at, Math.PI);
      }
      place('Name_Board', [hall.board[0], 0, hall.board[2]], 0);
      for (const [x, z, yaw] of lanterns) place('Lantern_Post', [x, 0, z], yaw);
    },

    /** Small props along the wall feet: `pick` chooses the prop and its scale (drawn after the turn); the prop
     *  brings its collider. */
    wallFoot(count: number, pick: () => Readonly<{ name: string; scale: () => number }>) {
      for (let i = 0; i < count; i++) {
        const side = Math.floor(r() * 4), d = (r() - .5) * 34, inset = HALF - 2.9 - r() * .8;
        const [x, z] = alongWall(side, d, inset);
        if (!clearOf(x, z, .8)) continue;
        const choice = pick();
        const yaw = r() * 6.3;
        place(choice.name, [x, 0, z], yaw, choice.scale());
      }
    },
  };
}
