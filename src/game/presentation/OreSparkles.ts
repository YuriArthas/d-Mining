import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Points, ShaderMaterial, Vector2 } from 'three';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';

/** Glints that rise off exposed ore near the miner, in the ore's colour: a fixed pool drawn as one additive point
 *  cloud. Random cells around the miner are probed (`probes` a second, whatever the frame rate); an ore cell with an open face spawns a sparkle
 *  on that face. The pool, the probes and the spawn rate are fixed, so the cost never grows with the ore in view.
 *  An effect, not scenery: nothing is culled or unloaded. */
export const ORE_SPARKLES = { capacity: 48, probes: 1500, maxProbes: 60, radius: 6, rate: 9, life: [1.1, 1.9] } as const;
const FACES: readonly Coord[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
type Sparkle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number };
export type SparkleOre = Readonly<{ color: Color; strength: number }> | null;

export class OreSparkles {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly sparkles: Sparkle[] = [];
  private readonly position = new Float32Array(ORE_SPARKLES.capacity * 3);
  private readonly color = new Float32Array(ORE_SPARKLES.capacity * 3);
  private readonly glow = new Float32Array(ORE_SPARKLES.capacity * 2);
  private budget = 0;
  private probeBudget = 0;
  random = Math.random;
  spawned = 0;

  /** `cell` reads the terrain (0 is empty); `ore` says whether a kind sparkles, in what colour and how often (0..1). */
  private readonly cell: (c: Coord) => number | null;
  private readonly ore: (kind: number) => SparkleOre;
  constructor(cell: (c: Coord) => number | null, ore: (kind: number) => SparkleOre) {
    this.cell = cell; this.ore = ore;
    const geometry = new BufferGeometry();
    for (const [name, array, size] of [['position', this.position, 3], ['color', this.color, 3], ['glow', this.glow, 2]] as const)
      geometry.setAttribute(name, new BufferAttribute(array, size).setUsage(DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.points = new Points(geometry, new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
      uniforms: { uHalfHeight: { value: 400 } },
      vertexShader: `uniform float uHalfHeight; attribute vec3 color; attribute vec2 glow; varying vec3 vColor; varying float vAlpha;
        void main(){ vColor=color; vAlpha=glow.x; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=glow.y*projectionMatrix[1][1]*uHalfHeight/max(-mv.z,.5); }`,
      // A four-point star with a soft core.
      fragmentShader: `varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 p=abs(gl_PointCoord-.5)*2.; float star=max(1.-p.x*9.-p.y*1.2,0.)+max(1.-p.y*9.-p.x*1.2,0.);
          float core=max(1.-length(p)*1.6,0.); float a=clamp(star+core*core,0.,1.)*vAlpha; if(a<.01)discard;
          gl_FragColor=vec4((vColor*1.4+vec3(core*.7))*a,1.); }`,
    }));
    this.points.name = 'ore-sparkles'; this.points.frustumCulled = false; this.points.renderOrder = 4;
    // World-sized: half the drawing buffer's height converts the projected size to device pixels at any DPR.
    const buffer = new Vector2();
    this.points.onBeforeRender = renderer => { this.points.material.uniforms.uHalfHeight.value = renderer.getDrawingBufferSize(buffer).y / 2; };
  }

  /** Call once per frame with the miner's chest position. */
  update(delta: number, centre: readonly number[]) {
    this.budget = Math.min(2, this.budget + delta * ORE_SPARKLES.rate);
    const cx = Math.floor(centre[0] / CELL), cy = Math.floor(centre[1] / CELL), cz = Math.floor(centre[2] / CELL), r = ORE_SPARKLES.radius;
    this.probeBudget = Math.min(ORE_SPARKLES.maxProbes, this.probeBudget + delta * ORE_SPARKLES.probes);
    for (; this.probeBudget >= 1 && this.budget >= 1 && this.sparkles.length < ORE_SPARKLES.capacity; this.probeBudget--) {
      const c: Coord = [cx + Math.round((this.random() * 2 - 1) * r), cy + Math.round((this.random() * 2 - 1) * r), cz + Math.round((this.random() * 2 - 1) * r)];
      const kind = this.cell(c), look = kind ? this.ore(kind) : null;
      if (!look || this.random() > look.strength) continue;
      const face = FACES[Math.floor(this.random() * 6)];
      if (this.cell([c[0] + face[0], c[1] + face[1], c[2] + face[2]]) !== 0) continue;
      this.budget -= 1; this.spawned++;
      // On the open face, a little off it, drifting out and up.
      const u = () => (this.random() - .5) * .8 * CELL;
      const x = (c[0] + .5 + face[0] * .56) * CELL + (face[0] ? 0 : u()), y = (c[1] + .5 + face[1] * .56) * CELL + (face[1] ? 0 : u()), z = (c[2] + .5 + face[2] * .56) * CELL + (face[2] ? 0 : u());
      const [lo, hi] = ORE_SPARKLES.life, i = this.sparkles.length;
      this.sparkles.push({ x, y, z, vx: face[0] * .25, vy: .28 + face[1] * .2, vz: face[2] * .25, age: 0, life: lo + this.random() * (hi - lo), size: .2 + this.random() * .14 });
      this.color[i * 3] = look.color.r; this.color[i * 3 + 1] = look.color.g; this.color[i * 3 + 2] = look.color.b;
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.age += delta;
      if (s.age < s.life) { s.x += s.vx * delta; s.y += s.vy * delta; s.z += s.vz * delta; continue; }
      // Swap-remove, keeping colours in step with their sparkles.
      const last = this.sparkles.length - 1;
      this.sparkles[i] = this.sparkles[last]; this.color.copyWithin(i * 3, last * 3, last * 3 + 3); this.sparkles.pop();
    }
    this.sparkles.forEach((s, i) => {
      const t = s.age / s.life, twinkle = Math.sin(t * Math.PI) * (.75 + .25 * Math.sin(s.age * 18 + i));
      this.position[i * 3] = s.x; this.position[i * 3 + 1] = s.y; this.position[i * 3 + 2] = s.z;
      this.glow[i * 2] = twinkle; this.glow[i * 2 + 1] = s.size * (.7 + .3 * twinkle);
    });
    const geometry = this.points.geometry;
    for (const name of ['position', 'color', 'glow']) geometry.getAttribute(name).needsUpdate = true;
    geometry.setDrawRange(0, this.sparkles.length);
  }

  /** Debug: `n` sparkles around a point, in a colour. */
  burst(at: readonly number[], color: Color, n = 12) {
    for (let k = 0; k < n && this.sparkles.length < ORE_SPARKLES.capacity; k++) {
      const i = this.sparkles.length;
      this.sparkles.push({ x: at[0] + (this.random() - .5) * 1.6, y: at[1] + (this.random() - .5) * 1.2, z: at[2] + (this.random() - .5) * 1.6, vx: 0, vy: .25, vz: 0, age: 0, life: 4, size: .3 });
      this.color[i * 3] = color.r; this.color[i * 3 + 1] = color.g; this.color[i * 3 + 2] = color.b;
    }
  }

  get count() { return this.sparkles.length; }
  /** Travel: drop every sparkle at once. */
  clear() { this.sparkles.length = 0; this.points.geometry.setDrawRange(0, 0); }
  dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
}
