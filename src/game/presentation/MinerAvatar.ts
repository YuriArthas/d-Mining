import { EQUIPMENT_URL, requiredModel } from './EquipmentModels.ts';
import { equipmentModel } from '../content/shopCatalog.ts';
import {
  AnimationMixer, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, Vector3,
  type AnimationAction, type Bone, type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { disposeScenery } from './disposeScenery.ts';
import { MinerMiningLayer } from './MinerMiningLayer.ts';

const MODEL_URL = new URL('../assets/character/miner-a.glb', import.meta.url).href;

/** 角色外观借用游戏的脚底位置；骨骼动画不写入物理或存档。 */
export class MinerAvatar {
  readonly group: Group;
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly walk: AnimationAction;
  private readonly run: AnimationAction;
  private readonly mining: MinerMiningLayer;
  private readonly pickaxe = new Group();
  private readonly backpack = new Group();
  private readonly equipment: Group;
  private equippedTool=0;
  private equippedBag=0;
  private readonly miningTarget = new Vector3();
  private readonly upperTorso: Bone;
  private readonly aimRotation = new Quaternion();
  private readonly pitchAxis = new Vector3(1,0,0);
  private readonly meshes: SkinnedMesh[] = [];
  private readonly previous = new Vector3();
  private initialized = false;
  private speed = 0;
  private moving = 0;
  private running = 0;
  private grounded = true;
  private disposed = false;

  static async load(signal: AbortSignal) {
    const loaded = await Promise.allSettled([MODEL_URL,EQUIPMENT_URL].map(async url=>{
      const response=await fetch(url,{signal});
      if(!response.ok)throw Error(`矿工资源加载失败：HTTP ${response.status}`);
      return new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
    }));
    try {
      for(const item of loaded)if(item.status==='rejected')throw item.reason;
      signal.throwIfAborted();
      return new MinerAvatar((loaded[0] as PromiseFulfilledResult<GLTF>).value,(loaded[1] as PromiseFulfilledResult<GLTF>).value);
    } catch (error) {
      // 构造中途失败时，工具可能已经挂到人物上；先拆开再分别释放。
      for(const item of loaded)if(item.status==='fulfilled')item.value.scene.removeFromParent();
      for(const item of loaded)if(item.status==='fulfilled')disposeScenery(item.value.scene);
      throw error;
    }
  }

  private constructor(gltf: GLTF, library: GLTF) {
    this.group = gltf.scene;
    this.group.name = 'miner-a-avatar';
    this.upperTorso=this.group.getObjectByName('UpperTorso') as Bone;
    if(!this.upperTorso)throw Error('矿工模型缺少上身骨骼');
    const hand=this.group.getObjectByName('RightHand');
    if(!hand)throw Error('矿工模型缺少右手骨骼');
    this.equipment=library.scene;
    this.pickaxe.name='equipped-pickaxe';
    this.pickaxe.position.set(0,-.14,.015);
    this.pickaxe.rotation.set(-Math.PI/2,0,0);
    hand.add(this.pickaxe);
    this.backpack.name='equipped-backpack';
    this.backpack.scale.setScalar(.62);
    this.backpack.position.set(0,-.02,.26);
    this.upperTorso.add(this.backpack);
    this.equipment.traverse(object=>{
      if (!(object instanceof Mesh)) return;
      object.receiveShadow=true;
      for(const material of Array.isArray(object.material)?object.material:[object.material]) {
        material.transparent=true;
        if(material instanceof MeshStandardMaterial){material.roughness=.9;material.metalness=0;}
      }
    });
    this.setEquipment(1,1);
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
    const mining=gltf.animations.find(c=>c.name==='Mine');
    if(!mining)throw Error('矿工模型缺少 Mine 动作');
    this.mining=new MinerMiningLayer(this.mixer,clips,mining);
    [this.idle, this.walk, this.run] = this.mining.lower;
    this.idle.setEffectiveWeight(1);
    this.walk.setEffectiveWeight(0);
    this.run.setEffectiveWeight(0);
    this.mining.update(0);
    this.mixer.update(0);
  }

  setEquipment(toolLevel:number,bagLevel:number) {
    if(this.equippedTool!==toolLevel) {
      this.pickaxe.clear();this.pickaxe.add(requiredModel(this.equipment,equipmentModel('tools',toolLevel)).clone(true));
      this.equippedTool=toolLevel;
    }
    if(this.equippedBag!==bagLevel) {
      this.backpack.clear();this.backpack.add(requiredModel(this.equipment,equipmentModel('backpacks',bagLevel)).clone(true));
      this.equippedBag=bagLevel;
    }
  }

  strike(target: readonly number[], speed: number) {
    this.miningTarget.set(target[0],target[1],target[2]);
    this.mining.strike(speed);
  }

  cancelMining() { this.mining.cancel(); }

  update(feet: readonly number[], delta: number, grounded: boolean, travelling: boolean) {
    const distance = Math.hypot(feet[0] - this.previous.x, feet[2] - this.previous.z);
    const discontinuity = !this.initialized || travelling || distance > 2;
    if(discontinuity)this.mining.cancel();
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
    // 离地时保持腿部动作，避免空中继续踏步；挥镐仍独立控制上身。
    this.walk.paused = !grounded;
    this.run.paused = !grounded;
    this.mining.update(delta);
    this.mixer.update(delta);
    const dx=this.miningTarget.x-feet[0],dz=this.miningTarget.z-feet[2];
    const elevation=Math.atan2(this.miningTarget.y-feet[1]-1.05,Math.max(.15,Math.hypot(dx,dz)));
    const pitch=MathUtils.clamp(elevation+.25,-.5,.6)*this.mining.weight;
    this.upperTorso.quaternion.premultiply(this.aimRotation.setFromAxisAngle(this.pitchAxis,pitch));
    const desired=this.mining.weight>0&&Math.hypot(dx,dz)>.08
      ? Math.atan2(-dx,-dz)-(this.group.parent?.rotation.y??0) : 0;
    const turn=Math.atan2(Math.sin(desired-this.group.rotation.y),Math.cos(desired-this.group.rotation.y));
    this.group.rotation.y+=turn*(1-Math.exp(-22*delta));
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
      mining:this.mining.diagnostics(),
      pickaxe:{attachedTo:this.pickaxe.parent?.name,visible:this.pickaxe.visible,level:this.equippedTool,model:equipmentModel('tools',this.equippedTool),tip:this.pickaxe.getObjectsByProperty('type','Object3D').find(o=>o.name.startsWith('PickaxeTip'))?.getWorldPosition(new Vector3()).toArray()},
      backpack:{attachedTo:this.backpack.parent?.name,level:this.equippedBag,model:equipmentModel('backpacks',this.equippedBag)},
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
    this.pickaxe.clear();this.backpack.clear();
    disposeScenery(this.equipment);
    disposeScenery(this.group);
  }
}
