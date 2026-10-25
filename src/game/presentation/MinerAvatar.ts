import { EQUIPMENT_URL, requiredModel } from './EquipmentModels.ts';
import { equipmentModel, toolMotion, type ToolMotion } from '../content/shopCatalog.ts';
import {
  AnimationClip, AnimationMixer, Euler, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, Vector3,
  type AnimationAction, type Bone, type Object3D, type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { applyStandingLight } from './bakedLight.ts';
import { disposeScenery } from './disposeScenery.ts';
import { MinerMiningLayer } from './MinerMiningLayer.ts';
import { UPPER_BODY, createMinerMotions } from './minerMotions.ts';
import { crossed, footContacts } from './minerSteps.ts';

const MODEL_URL = new URL('../assets/character/miner-a.glb', import.meta.url).href;
const LANDING_SECONDS = .32;
/** A drill's shake: two fast wobbles (Hz) on the arms, degrees at full weight; its whisks or bit turn this fast (rad/s). */
const DRILL_SHAKE = { rates: [23, 31], arm: 1.8, torso: .5, spin: 38 } as const;

type Layer = { lower: AnimationAction; upper: AnimationAction };
/** Lower and upper body play separately so the swing can own the arms while the legs keep moving. */
function layer(mixer: AnimationMixer, clip: AnimationClip): Layer {
  const part = (upper: boolean) => mixer.clipAction(new AnimationClip(`${clip.name}:${upper ? 'upper' : 'lower'}`, clip.duration,
    clip.tracks.filter(t => UPPER_BODY.has(t.name.split('.')[0]) === upper))).play();
  return { lower: part(false), upper: part(true) };
}

/** 角色外观借用游戏的脚底位置；骨骼动画不写入物理或存档。 */
export class MinerAvatar {
  readonly group: Group;
  private readonly mixer: AnimationMixer;
  private readonly locomotion: Layer[];
  private readonly air: Layer[];
  private readonly swing: AnimationAction;
  private readonly drill: AnimationAction;
  private motion: ToolMotion = 'swing';
  /** The equipped tool's parts that turn while it works, and the backpack's load that grows as it fills. */
  private spinners: Object3D[] = [];
  private load: Object3D | null = null;
  private fill = 0;
  private fillTarget = 0;
  private shakeTime = 0;
  private preview: { tool: number; bag: number; fill: number } | null = null;
  private readonly shake = new Quaternion();
  private readonly shakeEuler = new Euler();
  /** The bones a drill shakes: how far (degrees) and the phase of each one's wobble. */
  private readonly shaken: (readonly [Object3D, number, number])[] = [];
  private readonly shakes: Quaternion[] = [];
  private readonly undo = new Quaternion();
  private readonly mining = new MinerMiningLayer();
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
  private verticalSpeed = 0;
  private airTime = 0;
  private airborne = 0;
  private jumped = false;
  private fallSpeed = 0;
  private landAge = Infinity;
  private landStrength = 0;
  private tookOff = false;
  private landed: number | null = null;
  private contact: [number, number, number] | null = null;
  /** Foot-plant phases of the walk and run clips (index 1 and 2 of `locomotion`). */
  private readonly steps: readonly (readonly number[])[];
  private readonly stepPhase = [0, 0, 0];
  private stepped: number | null = null;
  private stepCount = 0;
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
    this.backpack.scale.setScalar(.7);
    this.backpack.position.set(0,-.02,.26);
    this.upperTorso.add(this.backpack);
    this.equipment.traverse(object=>{
      if (!(object instanceof Mesh)) return;
      object.receiveShadow=true;
      // Windows and domes draw after what they hold; their own see-through level survives the camera fade.
      if(object.name.startsWith('Glass'))object.renderOrder=1;
      for(const material of Array.isArray(object.material)?object.material:[object.material]) {
        material.userData.opacity=material.opacity;
        material.transparent=true;
        if(material instanceof MeshStandardMaterial){material.roughness=.9;material.metalness=0;applyStandingLight(material);}
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
          // Walking into a baked shadow darkens the miner like the ground around it.
          applyStandingLight(material);
        }
      }
    });
    if (this.meshes.length !== 1) throw new Error('矿工模型应包含一个蒙皮网格');
    this.steps = clips.map((clip, i) => i === 0 ? [] : footContacts(this.group, clip));
    this.mixer = new AnimationMixer(this.group);
    // The model's RAB 'Mine' clip is a slow axe chop; the swing and air poses are authored in code.
    const motions=createMinerMotions(this.group);
    this.locomotion=clips.map(clip=>layer(this.mixer,clip));
    this.air=[motions.rise,motions.fall,motions.land].map(clip=>layer(this.mixer,clip));
    this.swing=this.mixer.clipAction(motions.swing).play();
    this.swing.paused=true;
    this.drill=this.mixer.clipAction(motions.drill).play();
    this.drill.paused=true;
    for(const [name,amount,phase] of [['RightUpperArm',DRILL_SHAKE.arm,0],['LeftUpperArm',DRILL_SHAKE.arm,1.7],['UpperTorso',DRILL_SHAKE.torso,.6]] as const){
      this.shaken.push([this.group.getObjectByName(name)!,amount,phase]);this.shakes.push(new Quaternion());
    }
    this.blend(0,0,0,0);
    this.mixer.update(0);
  }

  setEquipment(toolLevel:number,bagLevel:number) { if(!this.preview)this.wear(toolLevel,bagLevel); }

  /** Debug only: wear this gear and show this load whatever the save says, until cleared with null. */
  previewGear(gear:{tool:number;bag:number;fill:number}|null) {
    this.preview=gear;
    if(gear){this.wear(gear.tool,gear.bag);this.fillTarget=MathUtils.clamp(gear.fill,0,1);}
  }

  private wear(toolLevel:number,bagLevel:number) {
    if(this.equippedTool!==toolLevel) {
      const tool=requiredModel(this.equipment,equipmentModel('tools',toolLevel)).clone(true);
      this.pickaxe.clear();this.pickaxe.add(tool);
      this.equippedTool=toolLevel;this.motion=toolMotion(toolLevel);
      this.spinners=[];tool.traverse(o=>{if(o.name.startsWith('Spin'))this.spinners.push(o);});
    }
    if(this.equippedBag!==bagLevel) {
      const bag=requiredModel(this.equipment,equipmentModel('backpacks',bagLevel)).clone(true);
      this.backpack.clear();this.backpack.add(bag);
      this.equippedBag=bagLevel;this.load=bag.getObjectsByProperty('type','Object3D').find(o=>o.name.startsWith('BagFill'))??null;
      this.showLoad();
    }
  }

  /** How full the backpack is, 0..1: bags with an open top or a window show their load heaping up. */
  setBagFill(fraction:number) { if(!this.preview)this.fillTarget=MathUtils.clamp(Number.isFinite(fraction)?fraction:0,0,1); }

  private showLoad() {
    if(!this.load)return;
    this.load.visible=this.fill>.01;
    this.load.scale.y=Math.max(.01,this.fill);
  }

  strike(target: readonly number[], speed: number) {
    this.miningTarget.set(target[0],target[1],target[2]);
    this.mining.strike(speed);
  }

  cancelMining() { this.mining.cancel(); }

  update(feet: readonly number[], delta: number, grounded: boolean, travelling: boolean) {
    const distance = Math.hypot(feet[0] - this.previous.x, feet[2] - this.previous.z);
    const discontinuity = !this.initialized || travelling || distance > 2 || Math.abs(feet[1] - this.previous.y) > 2;
    if(discontinuity)this.mining.cancel();
    const measured = discontinuity || delta <= 0 ? 0 : distance / delta;
    const rising = discontinuity || delta <= 0 ? 0 : (feet[1] - this.previous.y) / delta;
    this.previous.set(feet[0], feet[1], feet[2]);
    this.initialized = true;
    this.grounded = grounded;
    this.speed = discontinuity ? 0 : MathUtils.damp(this.speed, measured, 16, delta);
    const movement = MathUtils.smoothstep(this.speed, .08, .55);
    const running = MathUtils.smoothstep(this.speed, 2, 4.2);
    this.moving = discontinuity ? 0 : MathUtils.damp(this.moving, movement, 14, delta);
    this.running = discontinuity ? 0 : MathUtils.damp(this.running, running, 12, delta);
    this.locomotion[1].lower.setEffectiveTimeScale(MathUtils.clamp(this.speed / 1.8, .45, 2));
    this.locomotion[2].lower.setEffectiveTimeScale(MathUtils.clamp(this.speed / 3.6, .6, 2.2));
    this.updateAir(rising, delta, grounded, discontinuity);
    const rise = this.jumped ? MathUtils.smoothstep(this.verticalSpeed, -2.5, 1.5) : 0;
    const land = this.landAge < LANDING_SECONDS ? this.landStrength * landingEnvelope(this.landAge) : 0;
    this.mining.update(delta);
    this.restorePose();
    this.blend(this.airborne * rise, this.airborne * (1 - rise), land, this.mining.weight);
    this.mixer.update(delta);
    this.workTool(delta);
    this.fill=MathUtils.damp(this.fill,this.fillTarget,5,delta);
    if(Math.abs(this.fill-this.fillTarget)<1e-3)this.fill=this.fillTarget;
    this.showLoad();
    this.detectStep(discontinuity);
    const dx=this.miningTarget.x-feet[0],dz=this.miningTarget.z-feet[2];
    const elevation=Math.atan2(this.miningTarget.y-feet[1]-1.05,Math.max(.15,Math.hypot(dx,dz)));
    const pitch=MathUtils.clamp(elevation,-.6,.5)*this.mining.weight;
    this.upperTorso.quaternion.premultiply(this.aimRotation.setFromAxisAngle(this.pitchAxis,pitch));
    const desired=this.mining.weight>0&&Math.hypot(dx,dz)>.08
      ? Math.atan2(-dx,-dz)-(this.group.parent?.rotation.y??0) : 0;
    const turn=Math.atan2(Math.sin(desired-this.group.rotation.y),Math.cos(desired-this.group.rotation.y));
    this.group.rotation.y+=turn*(1-Math.exp(-22*delta));
    this.group.updateMatrixWorld(true);
    // Where the pick actually lands this frame: effects start at the struck spot the camera can see.
    if(this.mining.consumeContact())this.contact=this.pickTip()?.toArray() as [number,number,number]??[this.miningTarget.x,this.miningTarget.y,this.miningTarget.z];
  }

  /** A drill shakes the arms that hold it and turns its whisks while it works. */
  private workTool(delta: number) {
    const w=this.motion==='drill'?this.mining.weight:0;
    this.shakeTime=w>0?this.shakeTime+delta:0;
    for(const spinner of this.spinners)spinner.rotateY(DRILL_SHAKE.spin*w*delta);
    if(w<=0)return;
    const t=this.shakeTime*2*Math.PI,[a,b]=DRILL_SHAKE.rates,deg=Math.PI/180;
    const wobble=(amount:number,phase:number)=>this.shake.setFromEuler(this.shakeEuler.set(
      amount*w*deg*Math.sin(a*t+phase),amount*w*deg*.7*Math.sin(b*t+phase*2),amount*w*deg*.5*Math.sin((a+b)*.5*t+phase)));
    this.shaken.forEach(([bone,amount,phase],i)=>{this.shakes[i].copy(wobble(amount,phase));bone.quaternion.multiply(this.shakes[i]);});
  }

  /** Take back last frame's aim and shake. The mixer only rewrites a bone whose animated value changed, so on a
   *  held pose (the drill's hold) they would otherwise pile up frame after frame. */
  private restorePose() {
    this.upperTorso.quaternion.premultiply(this.undo.copy(this.aimRotation).invert());
    this.aimRotation.identity();
    this.shaken.forEach(([bone],i)=>{bone.quaternion.multiply(this.undo.copy(this.shakes[i]).invert());this.shakes[i].identity();});
  }

  /** A footstep when the leading locomotion clip passes a foot plant while walking on the ground. */
  private detectStep(discontinuity: boolean) {
    const lead = this.running > .5 ? 2 : 1, walking = !discontinuity && this.grounded && this.airborne === 0 && this.moving > .5;
    this.locomotion.forEach(({ lower }, i) => {
      const phase = lower.time / lower.getClip().duration;
      if (i === lead && walking && this.steps[i].some(contact => crossed(this.stepPhase[i], phase, contact))) {
        this.stepped = Math.max(this.stepped ?? 0, .5 + .5 * this.running); this.stepCount++;
      }
      this.stepPhase[i] = phase;
    });
  }

  private pickTip() { return this.pickaxe.getObjectsByProperty('type','Object3D').find(o=>o.name.startsWith('PickaxeTip'))?.getWorldPosition(new Vector3()); }

  /** Moments for sound and effects since the last call: the pick reaching the block (with the pick
   *  tip's world position), a take-off, a landing and a footstep (with their strength). */
  consumeEvents() {
    const events={contact:this.contact,jump:this.tookOff,land:this.landed,step:this.stepped};
    this.contact=null;this.tookOff=false;this.landed=null;this.stepped=null;
    return events;
  }

  /** Jump, fall and landing state from the drawn feet: the knee tuck needs a real take-off, a short
   *  step down never counts as a fall, and only a landing after real air time crouches. */
  private updateAir(rising: number, delta: number, grounded: boolean, discontinuity: boolean) {
    if(discontinuity){this.airTime=0;this.airborne=0;this.jumped=false;this.fallSpeed=0;this.landAge=Infinity;this.verticalSpeed=0;this.tookOff=false;this.landed=null;this.contact=null;return;}
    this.verticalSpeed=MathUtils.damp(this.verticalSpeed,rising,24,delta);
    if(grounded){
      if(this.airTime>.18){this.landAge=0;this.landStrength=MathUtils.clamp((this.fallSpeed-1.5)/7,.3,1);this.landed=this.landStrength;}
      else this.landAge+=delta;
      this.airTime=0;this.jumped=false;this.fallSpeed=0;
    }else{
      this.airTime+=delta;this.landAge=Infinity;
      if(!this.jumped&&rising>2){this.jumped=true;this.tookOff=true;}
      this.fallSpeed=Math.max(this.fallSpeed,-rising);
    }
    const target=!grounded&&(this.jumped||this.airTime>.09)?1:0;
    this.airborne=MathUtils.damp(this.airborne,target,target?20:32,delta);
    if(this.airborne<1e-3)this.airborne=0;
  }

  /** Lower body: locomotion under the air poses. Upper body: the same mix under the swing. */
  private blend(rise: number, fall: number, land: number, swing: number) {
    const total=rise+fall+land, scale=total>1?1/total:1, ground=1-Math.min(1,total);
    const loco=[1-this.moving,this.moving*(1-this.running),this.moving*this.running];
    const air=[rise*scale,fall*scale,land*scale];
    this.locomotion.forEach((l,i)=>{
      l.lower.setEffectiveWeight(loco[i]*ground);
      l.upper.setEffectiveWeight(loco[i]*ground*(1-swing));
      l.upper.time=l.lower.time;
      l.upper.setEffectiveTimeScale(l.lower.getEffectiveTimeScale());
    });
    this.air.forEach((l,i)=>{l.lower.setEffectiveWeight(air[i]);l.upper.setEffectiveWeight(air[i]*(1-swing));});
    const [active,idle]=this.motion==='drill'?[this.drill,this.swing]:[this.swing,this.drill];
    active.time=this.mining.phase*active.getClip().duration;
    active.setEffectiveWeight(swing);idle.setEffectiveWeight(0);
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
      speed: this.speed, grounded: this.grounded, steps: { count: this.stepCount, contacts: this.steps.slice(1) },
      air:{airborne:this.airborne,jumped:this.jumped,verticalSpeed:this.verticalSpeed,landing:this.landAge<LANDING_SECONDS},
      mining:this.mining.diagnostics(),
      pickaxe:{attachedTo:this.pickaxe.parent?.name,visible:this.pickaxe.visible,level:this.equippedTool,model:equipmentModel('tools',this.equippedTool),motion:this.motion,spinners:this.spinners.length,tip:this.pickTip()?.toArray()},
      backpack:{attachedTo:this.backpack.parent?.name,level:this.equippedBag,model:equipmentModel('backpacks',this.equippedBag),fill:this.fill,load:this.load?{visible:this.load.visible,scale:this.load.scale.y}:null},
      clips: this.locomotion.map(({lower:a}) => ({name:a.getClip().name.split(':')[0],time:a.time,weight:a.getEffectiveWeight(),speed:a.getEffectiveTimeScale()})),
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

/** Crouch quickly on contact, then rise back over the rest of the landing. */
function landingEnvelope(age: number) {
  const attack=.045;
  return age<attack ? MathUtils.smoothstep(age,0,attack) : (1-(age-attack)/(LANDING_SECONDS-attack))**2;
}
