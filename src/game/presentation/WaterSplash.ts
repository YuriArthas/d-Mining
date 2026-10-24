import { Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, Quaternion, RingGeometry, Vector3 } from 'three';

const DROPS = 120;
const RIPPLES = 12;
const GRAVITY = 15;
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

type Drop = { position: Vector3; velocity: Vector3; size: number; age: number; floor: number };
type Ripple = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; age: number; life: number; size: number };

/** Splashes where the player wades through world 1's creek: chunky droplets thrown up round the foot and a
 *  white ring spreading on the water. `strength` runs from a footstep (about 0.35) to a jump landing (1).
 *  Droplets share one instanced draw and vanish when they fall back through the water; rings are a small
 *  pool of flat meshes. Purely visual. */
export class WaterSplash {
  readonly group = new Group();
  private readonly drops: Drop[] = [];
  private readonly mesh: InstancedMesh<IcosahedronGeometry, MeshLambertMaterial>;
  private readonly ripples: Ripple[] = [];
  private readonly ringGeometry = new RingGeometry(.8, 1, 28).rotateX(-Math.PI / 2);
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private next = 0;
  random = Math.random;
  splashes = 0;
  /** Debug only: slows the splash down so a screenshot can catch it. */
  timeScale = 1;

  constructor() {
    this.group.name = 'creek-water-splash';
    // A cool white that stays readable on the blue water and in the bank's shade.
    this.mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshLambertMaterial({ color: '#eefaff', emissive: new Color('#6fa9bd') }), DROPS);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    this.group.add(this.mesh);
    for (let i = 0; i < RIPPLES; i++) {
      const mesh = new Mesh(this.ringGeometry, new MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      mesh.visible = false; mesh.renderOrder = 2; mesh.frustumCulled = false;
      this.ripples.push({ mesh, age: 0, life: 1, size: 1 });
      this.group.add(mesh);
    }
  }

  /** A splash round (x, z) on the water surface at height `water`. */
  splash(x: number, water: number, z: number, strength: number) {
    const s = Math.max(.2, Math.min(1, strength));
    const count = Math.round(5 + s * 17);
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2, out = .12 + this.random() * .22 * (1 + s);
      const speed = (1 + this.random() * 1.6) * (.7 + s * .8), rise = (2.2 + this.random() * 2.4) * (.65 + s * .75);
      const position = new Vector3(x + Math.cos(angle) * out, water + .04, z + Math.sin(angle) * out);
      this.spawn(position, new Vector3(Math.cos(angle) * speed, rise, Math.sin(angle) * speed), (.045 + this.random() * .06) * (.8 + s * .5), water);
    }
    this.ring(x, water, z, .55 + s * .9, .55 + s * .35);
    // Bigger splashes leave a second, wider ring.
    if (s > .5) this.ring(x, water, z, 1.1 + s * 1.3, .9 + s * .3);
    this.splashes++;
  }

  update(elapsed: number) {
    const delta = elapsed * this.timeScale;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += delta;
      d.velocity.y -= GRAVITY * delta;
      d.position.addScaledVector(d.velocity, delta);
      if (d.position.y < d.floor || d.age > 2) { this.drops[i] = this.drops[this.drops.length - 1]; this.drops.pop(); }
    }
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i], stretch = 1 + Math.min(1.2, Math.abs(d.velocity.y) * .08);
      this.matrix.compose(d.position, this.quaternion, this.scale.set(d.size, d.size * stretch, d.size));
      this.mesh.setMatrixAt(i, this.matrix);
    }
    for (let i = this.drops.length; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.count = this.drops.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const r of this.ripples) {
      if (!r.mesh.visible) continue;
      r.age += delta;
      const t = r.age / r.life;
      if (t >= 1) { r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(r.size * (.3 + .7 * (1 - (1 - t) ** 2)));
      r.mesh.material.opacity = .75 * (1 - t) ** 1.5;
    }
  }

  diagnostics() { return { drops: this.drops.length, ripples: this.ripples.filter(r => r.mesh.visible).length, splashes: this.splashes }; }

  dispose() {
    this.drops.length = 0;
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose();
    this.ringGeometry.dispose();
    for (const r of this.ripples) r.mesh.material.dispose();
  }

  private ring(x: number, water: number, z: number, size: number, life: number) {
    const r = this.ripples[this.next++ % RIPPLES];
    r.mesh.position.set(x, water + .02, z); r.mesh.scale.setScalar(size * .3);
    r.mesh.material.opacity = .75; r.mesh.visible = true;
    r.age = 0; r.life = life; r.size = size;
  }

  private spawn(position: Vector3, velocity: Vector3, size: number, floor: number) {
    // The oldest droplet makes room: it is nearly back in the water anyway.
    if (this.drops.length >= DROPS) { let oldest = 0; for (let i = 1; i < this.drops.length; i++) if (this.drops[i].age > this.drops[oldest].age) oldest = i; this.drops.splice(oldest, 1); }
    this.drops.push({ position, velocity, size, age: 0, floor });
  }
}
