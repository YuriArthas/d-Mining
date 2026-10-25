// Offline: world 2's base kit on top of the cave shell (caveKit.ts), built for phones: one smooth poured floor
// with lamp light baked into its vertex colours, painted lanes and arrows, a yellow rail round the pit, and glow
// faked without post-processing: soft additive halos (vertex-coloured, no textures), light cones and streaks of
// reflected light on the floor. Halo meshes use the 'Glow halo' material, which the game draws additively
// without depth writes or fog (StaticSurface.ts); every intensity stays within 0-1 (vertex colours are clamped).
import * as THREE from 'three';
import { colour, type caveKit } from './caveKit.ts';
import type { HallDefinition } from '../../../src/game/content/underground/hall.ts';

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

/** A strip following points on a surface (normals per point): `width` across, its colour `centre(t)` along the
 *  middle (t: 0..1 from the first point) fading to `edge` at both sides. */
export function ribbon(points: THREE.Vector3[], normals: THREE.Vector3[], width: number, centre: (t: number) => THREE.Color, edge: THREE.Color) {
  const position: number[] = [], colours: number[] = [];
  const across = points.map((_p, i) => { const along = points[Math.min(points.length - 1, i + 1)].clone().sub(points[Math.max(0, i - 1)]); return along.cross(normals[i]).normalize().multiplyScalar(width / 2); });
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], ca = centre(i / (points.length - 1)), cb = centre((i + 1) / (points.length - 1));
    const rows = [[a.clone().add(across[i]), edge], [a, ca], [a.clone().sub(across[i]), edge]] as const, next = [[b.clone().add(across[i + 1]), edge], [b, cb], [b.clone().sub(across[i + 1]), edge]] as const;
    for (let k = 0; k < 2; k++) for (const [p, c] of [rows[k], rows[k + 1], next[k + 1], rows[k], next[k + 1], next[k]]) { position.push(p.x, p.y, p.z); colours.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); g.computeVertexNormals();
  return g;
}

/** What every world 2 hall shares (see techKit().base). */
export type TechBase = Readonly<{
  hall: HallDefinition;
  /** Lamp posts [x, z, yaw] (caveKit.services) and ceiling lamps [x, z] (each with a cone). */
  lanterns: readonly (readonly [number, number, number])[]; lamps: readonly XZ[];
  /** The lane loop round the pit: half size and corner radius. */
  loop: Readonly<{ half: number; corner: number }>;
  /** The hall's accent glow (board halo, bollard lamps): match its props' accent tile. */
  accent: string;
  /** Floor base colour (default light concrete) and big painted arrows [x, z, yaw]. */
  floor?: string; arrows?: readonly (readonly [number, number, number])[];
}>;

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

  const paintMaterial = Object.assign(new THREE.MeshLambertMaterial({ vertexColors: true }), { name: 'Base paint' });
  const laneMaterial = gloss('Base lane gloss', .5);
  const self = {
    glowMaterial, light, paintMaterial, laneMaterial,
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

    /** THE STANDARD BASE, after the walls and ceiling: the glossy poured floor, the yellow lane loop and white
     *  arrows, the pit curb and rail, ceiling lamps with cones and glows, then the services (kiosks, board, lamp
     *  posts) with their glow: screen halos (orange for the sale, teal for the shop) and floor streaks before the
     *  kiosks, a halo round the board, balls round the lamp heads and the corner bollards' lamps. */
    base(o: TechBase) {
      const { hall } = o;
      self.pouredFloor(o.floor ?? '#a4a7ae', gloss('Base floor gloss', .42));
      self.lane(self.loopPath(o.loop.half, o.loop.corner), 1.0, '#f2c230', laneMaterial, true);
      for (const [x, z, yaw] of o.arrows ?? [[-6, 14.2, Math.PI / 2], [6, 14.2, -Math.PI / 2], [-14.6, 0, 0], [14.6, 0, 0]]) self.arrow(x, z, yaw, 3.2, '#f4f2ec', laneMaterial);
      kit.pitRim();
      self.rail('#f2c230', paintMaterial);
      for (const [x, z] of o.lamps) {
        kit.place('Ceiling_Lamp', [x, 12.6, z], (kit.r() - .5) * .3);
        self.glow(lightCone(x, z, .1, 12.3, .75, 3.3, '#ffe2b8', .1), 'Glow halo cone');
        self.glow(softFrame(1.5, .8, 0, .9, '#ffd8a0', .45, 3).rotateX(Math.PI / 2).translate(x, 12.28, z), 'Glow halo lamp');
      }
      kit.services(o.lanterns);
      for (const [stall, tint] of [[hall.stalls.sell, '#ff9a3c'], [hall.stalls.shop, '#38d8c8']] as const) {
        if (!stall) continue;
        const [x, , z] = stall.at;
        self.glow(softFrame(2.9, 1.3, 0, 1.1, tint, .5, 4).translate(x, 4.6, z - 1.12), 'Glow halo screen');
        self.glow(glowGrid(3.4, 2.6, 4, 5, tint, (u, v) => .22 * Math.sin(Math.PI * u) * v ** 1.5).rotateX(-Math.PI / 2).translate(x, .075, z - 2.6), 'Glow halo floor');
      }
      self.glow(softFrame(7.5, 2.4, 0, .7, o.accent, .3, 3).translate(hall.board[0], 6.0, hall.board[2] + .14), 'Glow halo board');
      for (const [x, z, yaw] of o.lanterns) self.glow(glowBall(.9, '#ffd8a8', .32).translate(x + .55 * Math.cos(yaw), 2.52, z - .55 * Math.sin(yaw)), 'Glow halo lamp');
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) self.glow(glowBall(.55, o.accent, .4).translate(sx * (PIT + .5), 1.2, sz * (PIT + .5)), 'Glow halo bollard');
    },

    /** SEAMS on the rock (glowing cracks, veins): `count` ribbons climbing the rock face from near the floor, one
     *  ray per point so they follow it, each `material` (emissive) under a soft halo ribbon of `tint`. `skip`
     *  rejects a start by wall (0 north, 1 south, 2 west, 3 east) and position along it. */
    seams(count: number, material: THREE.Material, tint: string, skip: (side: number, d: number) => boolean = () => false, name = 'Cave seam') {
      const rocks: THREE.Mesh[] = []; kit.group.updateMatrixWorld(true);
      kit.group.traverse(o => { if (o instanceof THREE.Mesh && o.material === kit.M.rock) rocks.push(o); });
      const ray = new THREE.Raycaster(), r = kit.r, white = new THREE.Color('#ffffff'), black = new THREE.Color(0, 0, 0);
      for (let i = 0, made = 0; i < count * 4 && made < count; i++) {
        const side = Math.floor(r() * 4), d = (r() - .5) * 32;
        if (skip(side, d)) continue;
        const dir = new THREE.Vector3(...([[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][side] as [number, number, number]));
        const points: THREE.Vector3[] = [], normals: THREE.Vector3[] = [];
        let y = .4 + r() * 2.2, s = d;
        for (let k = 0; k < 7; k++) {
          const origin = (side < 2 ? new THREE.Vector3(s, y, 0) : new THREE.Vector3(0, y, s)).addScaledVector(dir, PIT + 1);
          ray.set(origin, dir); ray.far = 16;
          const hit = ray.intersectObjects(rocks, false)[0];
          if (!hit || !hit.face) break;
          const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          points.push(hit.point.clone().addScaledVector(n, .05)); normals.push(n);
          y += .6 + r() * .7; s += (r() - .5) * 1.1;
        }
        if (points.length < 4) continue;
        made++;
        add(new THREE.Mesh(ribbon(points, normals, .16, () => white, white), material), name);
        self.glow(ribbon(points.map((p, k) => p.clone().addScaledVector(normals[k], .06)), normals, 1.3, t => new THREE.Color(tint).multiplyScalar(.4 * Math.sin(Math.PI * Math.min(1, t * 1.2 + .1))), black), 'Glow halo seam');
      }
    },
  };
  return self;
}
