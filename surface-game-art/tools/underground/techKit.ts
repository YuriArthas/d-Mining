// Offline: world 2's base kit on top of the cave shell (caveKit.ts), built for phones: one smooth poured floor
// with lamp light baked into its vertex colours, painted lanes and arrows, a yellow rail round the pit, and glow
// faked without post-processing: soft additive halos (vertex-coloured, no textures), light cones and streaks of
// reflected light on the floor. Halo meshes use the 'Glow halo' material, which the game draws additively
// without depth writes or fog (StaticSurface.ts); every intensity stays within 0-1 (vertex colours are clamped).
import * as THREE from 'three';
import { colour, type caveKit } from './caveKit.ts';

type Kit = ReturnType<typeof caveKit>;
type XZ = readonly [number, number];
export type Pool = Readonly<{ at: XZ; radius: number; color: string; strength: number }>;

/** Additive glow (see the header); double sided so crossed and wall halos read from either side. */
export const halo = () => Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }), { name: 'Glow halo' });
/** Unlit vertex colours, for surfaces that are their own light (the molten core). */
export const unlit = (name: string) => Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true }), { name });
/** A glossy matte: the lamps' highlights slide over it (the game keeps its roughness, StaticSurface.ts). */
export const gloss = (name: string, roughness: number) => Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }), { name });

/** Per-vertex colours from each vertex position. */
function paint(g: THREE.BufferGeometry, pick: (p: THREE.Vector3, i: number) => THREE.Color) {
  const pos = g.getAttribute('position'), out = new Float32Array(pos.count * 3), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); pick(p, i).toArray(out, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}
const capped = (c: THREE.Color) => c.setRGB(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));

/** A soft frame in the XY plane facing +Z: rings at offsets d0..d1 round a w x h rectangle (a point when both
 *  are 0, which makes a disc), its colour fading from `strength` at d0 to nothing at d1. */
export function softFrame(w: number, h: number, d0: number, d1: number, tint: string, strength: number, steps = 4, arc = 5) {
  const per = 4 * (arc + 1), position: number[] = [], colours: number[] = [], index: number[] = [], c = new THREE.Color(tint);
  for (let k = 0; k <= steps; k++) {
    const d = d0 + (d1 - d0) * k / steps, f = strength * (1 - k / steps) ** 2;
    for (let corner = 0; corner < 4; corner++) {
      const cx = (corner === 0 || corner === 3 ? 1 : -1) * w / 2, cy = (corner < 2 ? 1 : -1) * h / 2;
      for (let j = 0; j <= arc; j++) {
        const a = (corner + j / arc) * Math.PI / 2;
        position.push(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0);
        colours.push(c.r * f, c.g * f, c.b * f);
      }
    }
    if (k) for (let i = 0; i < per; i++) {
      const a = (k - 1) * per + i, b = (k - 1) * per + (i + 1) % per;
      index.push(a, b, b + per, a, b + per, a + per);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index); g.computeVertexNormals();
  return g.toNonIndexed();
}
/** A w x h grid in the XY plane facing +Z, its glow given per vertex by f(u, v) with u, v in 0..1. */
export function glowGrid(w: number, h: number, nu: number, nv: number, tint: string, f: (u: number, v: number) => number) {
  const g = new THREE.PlaneGeometry(w, h, nu, nv).toNonIndexed(), c = new THREE.Color(tint);
  return paint(g, p => capped(c.clone().multiplyScalar(f(p.x / w + .5, p.y / h + .5))));
}
/** A glowing ball for lamps seen from anywhere: three upright discs a third of a turn apart and a flat one. */
export function glowBall(r: number, tint: string, strength: number) {
  const parts = [0, 1, 2].map(k => softFrame(0, 0, 0, r, tint, strength, 3, 3).rotateY(k * Math.PI / 3));
  parts.push(softFrame(0, 0, 0, r, tint, strength, 3, 3).rotateX(Math.PI / 2));
  const position = parts.flatMap(p => [...p.getAttribute('position').array]), colours = parts.flatMap(p => [...p.getAttribute('color').array]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.computeVertexNormals();
  return g;
}
/** An open cone of light from y1 (radius r1) down to y0 (radius r0), brightest at the top. */
export function lightCone(x: number, z: number, y0: number, y1: number, r1: number, r0: number, tint: string, strength: number) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 18, 5, true).toNonIndexed(); g.translate(x, (y0 + y1) / 2, z);
  const c = new THREE.Color(tint);
  return paint(g, p => c.clone().multiplyScalar(strength * ((p.y - y0) / (y1 - y0)) ** 1.6));
}

export function techKit(kit: Kit, pools: readonly Pool[]) {
  const { HALF, PIT, add, box } = kit;
  const glowMaterial = halo();
  const poolColours = pools.map(p => ({ ...p, c: new THREE.Color(p.color) }));
  const fall = (x: number, z: number, p: Pool) => { const t = Math.hypot(x - p.at[0], z - p.at[1]) / p.radius; return t < 1 ? (1 - t * t) ** 2 : 0; };
  /** How much lamp light reaches (x, z): 0 in the dark, about 1 under a lamp. */
  const light = (x: number, z: number) => Math.min(1.2, pools.reduce((s, p) => s + p.strength * fall(x, z, p), 0));
  /** A painted colour as lit by the pools: dimmed in the dark, full under the lamps. */
  const lit = (tint: THREE.Color, x: number, z: number) => capped(tint.clone().multiplyScalar(.5 + .5 * Math.min(1, light(x, z))));
  const ring = [[-HALF, -PIT, -HALF, HALF], [PIT, HALF, -HALF, HALF], [-PIT, PIT, -HALF, -PIT], [-PIT, PIT, PIT, HALF]] as const;

  return {
    glowMaterial, light,
    /** Add a halo mesh (already in place). */
    glow(g: THREE.BufferGeometry, name = 'Glow halo') { return add(new THREE.Mesh(g, glowMaterial), name); },

    /** FLOOR: one smooth slab over the floor ring, `step` apart in vertices so the pools' light shows: the base
     *  colour in the dark, warmed by each pool's colour toward its centre. Walkable slabs as caveKit's (4 cm). */
    pouredFloor(base: string, material: THREE.Material, step = .5) {
      const b = new THREE.Color(base);
      for (const [x0, x1, z0, z1] of ring) {
        const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / step), Math.ceil((z1 - z0) / step)).rotateX(-Math.PI / 2).toNonIndexed();
        g.translate((x0 + x1) / 2, .045, (z0 + z1) / 2); g.computeVertexNormals();
        add(new THREE.Mesh(paint(g, p => {
          const c = b.clone().multiplyScalar(.5);
          for (const q of poolColours) { const k = q.strength * fall(p.x, p.z, q) * .6; c.r += q.c.r * k; c.g += q.c.g * k; c.b += q.c.b * k; }
          return capped(c);
        }), material), 'Base poured floor');
        box([(x0 + x1) / 2, .02, (z0 + z1) / 2], [(x1 - x0) / 2, .02, (z1 - z0) / 2]);
      }
    },

    /** A painted lane of `width` along a path of points (closed: back to the start), lit by the pools. */
    lane(points: readonly XZ[], width: number, tint: string, material: THREE.Material, closed = false, y = .056) {
      const c = new THREE.Color(tint), position: number[] = [], n = points.length;
      const at = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
      const side = (i: number) => { const a = at(i - 1), b = at(i + 1), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * width / 2, dx / l * width / 2]; };
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const p = at(i), q = at(i + 1), sp = side(i), sq = side(i + 1);
        const l0 = [p[0] + sp[0], y, p[1] + sp[1]], r0 = [p[0] - sp[0], y, p[1] - sp[1]], l1 = [q[0] + sq[0], y, q[1] + sq[1]], r1 = [q[0] - sq[0], y, q[1] - sq[1]];
        for (const [a, b, d] of [[l0, r0, r1], [l0, r1, l1]]) {
          // Wound to face up (seen from above, counter-clockwise).
          const up = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
          position.push(...a, ...(up > 0 ? b : d), ...(up > 0 ? d : b));
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      g.computeVertexNormals();
      add(new THREE.Mesh(paint(g, p => lit(c, p.x, p.z)), material), 'Base lane');
    },
    /** A rounded square path round the pit: half size and corner radius, points about `step` apart. */
    loopPath(half: number, corner: number, step = .5): XZ[] {
      const out: XZ[] = [], straight = half - corner;
      for (let k = 0; k < 4; k++) {
        const a0 = k * Math.PI / 2, cx = Math.cos(a0 + Math.PI / 4) * Math.SQRT2 * straight, cz = Math.sin(a0 + Math.PI / 4) * Math.SQRT2 * straight;
        for (let j = 0, arcs = Math.ceil(corner * Math.PI / 2 / step); j < arcs; j++) { const a = a0 + j / arcs * Math.PI / 2; out.push([cx + Math.cos(a) * corner, cz + Math.sin(a) * corner]); }
        const a1 = a0 + Math.PI / 2, from: XZ = [cx + Math.cos(a1) * corner, cz + Math.sin(a1) * corner], dir: XZ = [-Math.sin(a1), Math.cos(a1)];
        for (let s = 0, n = Math.ceil(straight * 2 / step); s < n; s++) out.push([from[0] + dir[0] * s / n * straight * 2, from[1] + dir[1] * s / n * straight * 2]);
      }
      return out;
    },
    /** A big painted arrow at (x, z) pointing along `yaw` (0: toward -Z), `size` long. */
    arrow(x: number, z: number, yaw: number, size: number, tint: string, material: THREE.Material, y = .066) {
      const s = size / 3.2, shape = new THREE.Shape([[-.36, 1.6], [.36, 1.6], [.36, -.2], [.9, -.2], [0, -1.6], [-.9, -.2], [-.36, -.2]].map(([u, v]) => new THREE.Vector2(u * s, -v * s)));
      const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).rotateY(yaw).toNonIndexed(); g.translate(x, y, z); g.computeVertexNormals();
      const c = new THREE.Color(tint);
      add(new THREE.Mesh(paint(g, p => lit(c, p.x, p.z)), material), 'Base arrow');
    },
    /** A hazard band: yellow and black blocks in turn from a to b at height y. */
    hazard(a: XZ, b: XZ, width: number, material: THREE.Material, y = .062) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(l / .6), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < n; k++) {
        const t = (k + .5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const g = new THREE.BoxGeometry(width, .012, l / n).toNonIndexed(); g.computeVertexNormals(); g.rotateY(yaw); g.translate(x, y, z);
        add(new THREE.Mesh(colour(g, () => lit(new THREE.Color(k % 2 ? '#2a2a2e' : '#f2c230'), x, z)), material), 'Base hazard band');
      }
    },

    /** RAIL on the pit curb (caveKit's pitRim), open where the curb is: posts and two bars, with colliders. */
    rail(tint: string, material: THREE.Material, height = 1.1) {
      const c = new THREE.Color(tint), at = PIT + .3;
      const part = (size: readonly number[], p: readonly number[]) => {
        const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed(); g.computeVertexNormals(); g.translate(p[0], p[1], p[2]);
        add(new THREE.Mesh(colour(g, (_y, _i, n) => lit(c, p[0], p[2]).multiplyScalar(n.y > .5 ? 1.08 : n.y < -.5 ? .7 : .92)), material), 'Base rail');
      };
      for (const side of [-1, 1]) for (const [a0, a1] of [[-PIT - .6, -1.6], [1.6, PIT + .6]]) for (const axis of ['x', 'z'] as const) {
        const len = a1 - a0, mid = (a0 + a1) / 2, posts = Math.max(2, Math.round(len / 1.8) + 1);
        const pos = (a: number, y: number) => axis === 'x' ? [a, y, side * at] : [side * at, y, a];
        for (let k = 0; k < posts; k++) { const a = a0 + .1 + (len - .2) * k / (posts - 1); part([.14, height - .28, .14], pos(a, .28 + (height - .28) / 2)); }
        for (const y of [height - .05, .7]) part(axis === 'x' ? [len, .1, .1] : [.1, .1, len], pos(mid, y));
        box(pos(mid, (height + .28) / 2), axis === 'x' ? [len / 2, (height - .28) / 2, .08] : [.08, (height - .28) / 2, len / 2]);
      }
    },
  };
}
