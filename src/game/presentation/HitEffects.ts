import { BoxGeometry, Color, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { CELL, type Coord } from '../terrain/SparseWorld.ts';

export type BlockColors = Readonly<{ host: Color; ore: Color | null }>;
type Particle = { position: Vector3; velocity: Vector3; rotation: Euler; spin: Vector3; size: number; age: number; life: number; color: Color };

const CAPACITY = 192;
const GRAVITY = 22;
const FLASH_SECONDS = 0.14;
const WHITE = new Color('#ffffff');
const BLACK = new Color('#000000');

/** Short-lived mining feedback: chips fly off the struck face, a breaking block bursts into chunks,
 *  hard landings kick up dust, and the struck block flashes for a moment. Every particle shares one
 *  instanced draw; nothing here touches gameplay, terrain or physics. */
export class HitEffects {
  readonly group = new Group();
  private readonly mesh: InstancedMesh<BoxGeometry, MeshStandardMaterial>;
  private readonly flash: Mesh<BoxGeometry, MeshBasicMaterial>;
  private readonly particles: Particle[] = [];
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private flashAge = Infinity;
  random = Math.random;
  spawned = 0;

  constructor() {
    this.group.name = 'mining-hit-effects';
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 1, metalness: 0 }), CAPACITY);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < CAPACITY; i++) this.mesh.setColorAt(i, WHITE);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.flash = new Mesh(new BoxGeometry(CELL * 1.02, CELL * 1.02, CELL * 1.02), new MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    this.flash.visible = false; this.flash.renderOrder = 3;
    this.group.add(this.mesh, this.flash);
  }

  /** Chips from the open face of `cell` that best faces `from`, plus a quick flash of the block.
   *  `open` says whether a face (unit axis normal) borders air; buried faces would hide the chips.
   *  `at` (the pick tip) places them under the pick, where the third-person camera can see them. */
  hit(cell: Coord, from: readonly number[], colors: BlockColors, open: (normal: Vector3) => boolean = () => true, at?: readonly number[] | null) {
    const center = cellCenter(cell), toward = new Vector3(from[0], from[1], from[2]).sub(center);
    const faces = FACES.filter(open).sort((a, b) => b.dot(toward) - a.dot(toward));
    const normal = (faces[0] ?? FACES[2]).clone(), axis = dominantAxis(normal);
    const point = center.clone().addScaledVector(normal, CELL / 2 + 0.03);
    for (const tangent of [0, 1, 2].filter(a => a !== axis)) {
      const offset = at ? at[tangent] - center.getComponent(tangent) : toward.getComponent(tangent) * 0.35;
      point.setComponent(tangent, center.getComponent(tangent) + clamp(offset, -CELL * 0.42, CELL * 0.42));
    }
    for (let i = 0; i < 9; i++) {
      const velocity = normal.clone().multiplyScalar(2.4 + this.random() * 1.6);
      velocity.x += (this.random() - 0.5) * 3.2; velocity.z += (this.random() - 0.5) * 3.2;
      velocity.y += 2 + this.random() * 1.4;
      this.spawn(point, velocity, 0.13 + this.random() * 0.11, 0.4 + this.random() * 0.2, this.pick(colors, 0.35));
    }
    this.flash.position.copy(center); this.flashAge = 0;
  }

  /** A breaking block bursts into chunks and a little dust. */
  burst(cell: Coord, colors: BlockColors) {
    const center = cellCenter(cell), dust = colors.host.clone().lerp(WHITE, 0.35);
    for (let i = 0; i < 16; i++) {
      const offset = new Vector3(this.random() - 0.5, this.random() - 0.5, this.random() - 0.5).multiplyScalar(CELL * 0.7);
      const velocity = offset.clone().multiplyScalar(2.6 + this.random() * 2).setY(2.5 + this.random() * 2.2);
      this.spawn(center.clone().add(offset), velocity, 0.16 + this.random() * 0.18, 0.55 + this.random() * 0.25, this.pick(colors, 0.45));
    }
    for (let i = 0; i < 6; i++) {
      const velocity = new Vector3(this.random() - 0.5, 0.4 + this.random() * 0.6, this.random() - 0.5).multiplyScalar(1.6);
      this.spawn(center, velocity, 0.06 + this.random() * 0.05, 0.4, dust);
    }
    this.flash.position.copy(center); this.flashAge = 0;
  }

  /** Dust ring at the feet after a hard landing. */
  dust(feet: readonly number[], color: Color) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.random() * 0.4, speed = 1.2 + this.random() * 0.8;
      const velocity = new Vector3(Math.cos(angle) * speed, 0.6 + this.random() * 0.6, Math.sin(angle) * speed);
      this.spawn(new Vector3(feet[0], feet[1] + 0.08, feet[2]), velocity, 0.07 + this.random() * 0.05, 0.35, color);
    }
  }

  update(delta: number) {
    this.flashAge += delta;
    const flashing = this.flashAge < FLASH_SECONDS;
    this.flash.visible = flashing;
    if (flashing) {
      const t = this.flashAge / FLASH_SECONDS;
      this.flash.material.opacity = 0.3 * (1 - t) ** 2;
      this.flash.scale.setScalar(1 + 0.05 * (1 - t));
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += delta;
      if (p.age >= p.life) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      p.velocity.y -= GRAVITY * delta;
      p.position.addScaledVector(p.velocity, delta);
      p.rotation.set(p.rotation.x + p.spin.x * delta, p.rotation.y + p.spin.y * delta, p.rotation.z + p.spin.z * delta);
    }
    this.particles.forEach((p, i) => {
      const shrink = 1 - (p.age / p.life) ** 2;
      this.matrix.compose(p.position, this.quaternion.setFromEuler(p.rotation), this.scale.setScalar(p.size * shrink));
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, p.color);
    });
    this.mesh.count = this.particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  diagnostics() { return { particles: this.particles.length, spawned: this.spawned, flashing: this.flash.visible }; }

  dispose() {
    this.particles.length = 0;
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose();
    this.flash.geometry.dispose(); this.flash.material.dispose();
  }

  /** Ore chips keep the ore colour; rock chips split into a lighter broken face and a darker side,
   *  so they stand out against the very rock they came from. */
  private pick(colors: BlockColors, oreShare: number) {
    if (colors.ore && this.random() < oreShare) return colors.ore;
    return this.random() < 0.6 ? colors.host.clone().lerp(WHITE, 0.3) : colors.host.clone().lerp(BLACK, 0.3);
  }

  private spawn(position: Vector3, velocity: Vector3, size: number, life: number, color: Color) {
    // Oldest particles make room: they are nearly gone anyway.
    if (this.particles.length >= CAPACITY) this.particles.sort((a, b) => b.age / b.life - a.age / a.life).shift();
    this.particles.push({
      position: position.clone(), velocity, size, life, age: 0, color,
      rotation: new Euler(this.random() * 6.3, this.random() * 6.3, this.random() * 6.3),
      spin: new Vector3(this.random() - 0.5, this.random() - 0.5, this.random() - 0.5).multiplyScalar(18),
    });
    this.spawned++;
  }
}

const FACES = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const cellCenter = (cell: Coord) => new Vector3((cell[0] + 0.5) * CELL, (cell[1] + 0.5) * CELL, (cell[2] + 0.5) * CELL);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function dominantAxis(v: Vector3) {
  const x = Math.abs(v.x), y = Math.abs(v.y), z = Math.abs(v.z);
  return x >= y && x >= z ? 0 : y >= z ? 1 : 2;
}
