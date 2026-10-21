import {
  AnimationMixer, Group, MathUtils, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3,
  type AnimationAction, type Bone, type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { disposeScenery } from './disposeScenery.ts';

const MODEL_URL = new URL('../assets/character/miner-a.glb', import.meta.url).href;

/** 角色外观借用游戏的脚底位置；骨骼动画不写入物理或存档。 */
export class MinerAvatar {
  readonly group: Group;
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly walk: AnimationAction;
  private readonly run: AnimationAction;
  private readonly meshes: SkinnedMesh[] = [];
  private readonly previous = new Vector3();
  private initialized = false;
  private speed = 0;
  private moving = 0;
  private running = 0;
  private grounded = true;
  private disposed = false;

  static async load(signal: AbortSignal) {
    const response = await fetch(MODEL_URL, { signal });
    if (!response.ok) throw new Error(`矿工模型加载失败：HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    try {
      signal.throwIfAborted();
      return new MinerAvatar(gltf);
    } catch (error) {
      disposeScenery(gltf.scene);
      throw error;
    }
  }

  private constructor(gltf: GLTF) {
    this.group = gltf.scene;
    this.group.name = 'miner-a-avatar';
    const clips = ['Idle', 'Walk', 'Run'].map(name => {
      const clip = gltf.animations.find(c => c.name === name);
      if (!clip) throw new Error(`矿工模型缺少 ${name} 动作`);
      return clip;
    });
    this.group.traverse(object => {
      if (object instanceof SkinnedMesh) {
        object.frustumCulled = false;
        this.meshes.push(object);
      }
      if (!(object instanceof Mesh)) return;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true; // 近距离相机沿用游戏的角色淡出。
        if (material instanceof MeshStandardMaterial) {
          material.roughness = .9;
          material.metalness = 0;
        }
      }
    });
    if (this.meshes.length !== 1) throw new Error('矿工模型应包含一个蒙皮网格');
    this.mixer = new AnimationMixer(this.group);
    [this.idle, this.walk, this.run] = clips.map(clip => this.mixer.clipAction(clip).play());
    this.idle.setEffectiveWeight(1);
    this.walk.setEffectiveWeight(0);
    this.run.setEffectiveWeight(0);
    this.mixer.update(0);
  }

  update(feet: readonly number[], delta: number, grounded: boolean, travelling: boolean) {
    const distance = Math.hypot(feet[0] - this.previous.x, feet[2] - this.previous.z);
    const discontinuity = !this.initialized || travelling || distance > 2;
    const measured = discontinuity || delta <= 0 ? 0 : distance / delta;
    this.previous.set(feet[0], feet[1], feet[2]);
    this.initialized = true;
    this.grounded = grounded;
    this.speed = discontinuity ? 0 : MathUtils.damp(this.speed, measured, 16, delta);
    const movement = MathUtils.smoothstep(this.speed, .08, .55);
    const running = MathUtils.smoothstep(this.speed, 2, 4.2);
    this.moving = discontinuity ? 0 : MathUtils.damp(this.moving, movement, 14, delta);
    this.running = discontinuity ? 0 : MathUtils.damp(this.running, running, 12, delta);
    this.idle.setEffectiveWeight(1 - this.moving);
    this.walk.setEffectiveWeight(this.moving * (1 - this.running));
    this.run.setEffectiveWeight(this.moving * this.running);
    this.walk.setEffectiveTimeScale(MathUtils.clamp(this.speed / 1.8, .45, 2));
    this.run.setEffectiveTimeScale(MathUtils.clamp(this.speed / 3.6, .6, 2.2));
    // 本轮只接待机与地面移动；离地时保持腿部动作，避免空中继续踏步。
    this.walk.paused = !grounded;
    this.run.paused = !grounded;
    this.mixer.update(delta);
    this.group.updateMatrixWorld(true);
  }

  diagnostics() {
    const mesh = this.meshes[0];
    const bones = mesh.skeleton.bones;
    const important = ['Head','LeftUpperArm','RightUpperArm','LeftLowerLeg','RightLowerLeg'];
    const textures = new Set<Texture>();
    this.group.traverse(object => {
      if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof MeshStandardMaterial && material.map) textures.add(material.map);
      }
    });
    return {
      model: 'Miner A', bones: bones.length, skinnedMeshes: this.meshes.length,
      triangles: mesh.geometry.index!.count / 3, textures: textures.size,
      speed: this.speed, grounded: this.grounded,
      clips: [this.idle, this.walk, this.run].map(a => ({name:a.getClip().name,time:a.time,weight:a.getEffectiveWeight(),speed:a.getEffectiveTimeScale()})),
      joints: Object.fromEntries(bones.filter(b => important.includes(b.name)).map((b: Bone) => [b.name,b.quaternion.toArray()])),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.group);
    for (const mesh of this.meshes) mesh.skeleton.dispose();
    disposeScenery(this.group);
  }
}
