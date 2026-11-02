import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationMixer, Box3, Quaternion, Texture, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const bytes = readFileSync(process.env.MINER_AVATAR_TEST_MODEL ?? new URL('../../src/game/assets/character/miner-d.glb',import.meta.url));
// CPU 资产测试不解码贴图；公网浏览器另行验证真实贴图和 WebGL 播放。
const loader = new GLTFLoader().register(() => ({name:'cpu-test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mesh = gltf.scene.getObjectByProperty('type','SkinnedMesh');

test('实际鞋底的前后轴跟随 RAB 动作，不能叠加模型静止姿势的外八角度', () => {
  // 从网格独立识别鞋底长轴，不依赖绑定脚本的元数据或脚骨旋转。
  const p=mesh.geometry.attributes.position;
  const soles=['Left','Right'].map((side,s)=>{
    const sign=s===0?-1:1,unique=new Map();
    for(let i=0;i<p.count;i++)if(p.getY(i)<.055&&p.getX(i)*sign>0){
      const v=new Vector3().fromBufferAttribute(p,i);
      unique.set(v.toArray().map(n=>n.toFixed(5)).join(','),{index:i,rest:v});
    }
    const vertices=[...unique.values()];
    assert.ok(vertices.length>40);
    const center=vertices.reduce((sum,v)=>sum.add(v.rest),new Vector3()).divideScalar(vertices.length);
    let xx=0,xz=0,zz=0;
    for(const v of vertices){const d=v.rest.clone().sub(center);xx+=d.x*d.x;xz+=d.x*d.z;zz+=d.z*d.z;}
    const angle=.5*Math.atan2(2*xz,xx-zz),axis=new Vector3(Math.cos(angle),0,Math.sin(angle));
    if(axis.z>0)axis.negate();
    for(const v of vertices)v.coefficient=v.rest.clone().sub(center).dot(axis);
    return {side,vertices};
  });
  const mixer=new AnimationMixer(gltf.scene),errors={};
  try{
    for(const clip of gltf.animations.filter(c=>c.name!=='Mine')){
      const file={Idle:'idle',Walk:'walk',Run:'move'}[clip.name];
      const motion=JSON.parse(readFileSync(new URL(`./fixtures/motions/rab-${file}.json`,import.meta.url))).currentVersion.motion;
      const byPart=new Map(motion.joints.map(j=>[j.childPartName,j]));
      mixer.stopAllAction();mixer.clipAction(clip).reset().play();
      const maximum={Left:0,Right:0};
      const frames=Math.round(clip.duration*60);
      for(let frame=0;frame<frames;frame++){
        const phase=frame/frames,t=phase*motion.durationSeconds;
        const next=motion.keyframes.findIndex(f=>f.timeSeconds>=t);
        const b=motion.keyframes[Math.max(0,next)],a=motion.keyframes[Math.max(0,next-1)];
        const alpha=b===a?0:(t-a.timeSeconds)/(b.timeSeconds-a.timeSeconds);
        const closing=Math.max(0,(phase-.9)/.1),blend=closing*closing*(3-2*closing);
        const world={HumanoidRootPart:new Quaternion()};
        const rotation=part=>{
          if(world[part])return world[part];
          const j=byPart.get(part),q=new Quaternion().fromArray(a.transforms[j.jointKey].quaternion).normalize();
          q.slerp(new Quaternion().fromArray(b.transforms[j.jointKey].quaternion).normalize(),alpha);
          q.slerp(new Quaternion().fromArray(motion.keyframes[0].transforms[j.jointKey].quaternion).normalize(),blend);
          return world[part]=rotation(j.parentPartName).clone().multiply(q);
        };
        mixer.setTime(clip.duration*phase);gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
        for(const {side,vertices} of soles){
          const actual=new Vector3();
          for(const v of vertices)actual.addScaledVector(mesh.getVertexPosition(v.index,new Vector3()),v.coefficient);
          const expected=new Vector3(0,0,-1).applyQuaternion(rotation(side+'Foot'));
          const error=actual.normalize().angleTo(expected)*180/Math.PI;
          maximum[side]=Math.max(maximum[side],error);
        }
      }
      errors[clip.name]=maximum;
    }
    console.log('Sole direction error versus original RAB motion (degrees)',errors);
    for(const [clip,sides] of Object.entries(errors))for(const [side,error] of Object.entries(sides))
      assert.ok(error<2,`${clip} ${side}: shoe direction deviates ${error.toFixed(2)} degrees from RAB`);
  }finally{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
});

test('矿工保留完整网格、16 骨架以及每个顶点的归一化权重', () => {
  assert.equal(mesh.skeleton.bones.length,16);
  assert.equal(mesh.geometry.index.count/3,JSON.parse(readFileSync(new URL('../../src/game/assets/character/miner-d.manifest.json',import.meta.url))).triangles);
  const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
  for(let i=0;i<weights.count;i++) {
    const w=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
    assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<.0001);
    for(let j=0;j<4;j++)assert.ok(indices.array[i*4+j]<16);
  }
});

test('膝轴位于腿部截面中央，膝部只由同侧大腿和小腿控制', () => {
  gltf.scene.updateMatrixWorld(true);
  const p=mesh.geometry.attributes.position,indices=mesh.geometry.index.array;
  const weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
  for(const [side,sign] of [['Left',-1],['Right',1]]){
    const bone=mesh.skeleton.bones.find(b=>b.name===side+'LowerLeg');
    const pivot=mesh.worldToLocal(bone.getWorldPosition(new Vector3())),section=[];
    for(let i=0;i<indices.length;i+=3)for(const [aIndex,bIndex]of[[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]){
      const a=new Vector3().fromBufferAttribute(p,aIndex),b=new Vector3().fromBufferAttribute(p,bIndex);
      if((a.y-pivot.y)*(b.y-pivot.y)>0||Math.abs(a.y-b.y)<1e-8)continue;
      const point=a.lerp(b,(pivot.y-a.y)/(b.y-a.y));
      if(point.x*sign>0)section.push(point);
    }
    const bounds=new Box3().setFromPoints(section),center=bounds.getCenter(new Vector3());
    assert.ok(Math.hypot(center.x-pivot.x,center.z-pivot.z)<.008,`${side}: knee pivot outside the leg center`);
    let examined=0;
    for(let i=0;i<p.count;i++){
      if(p.getX(i)*sign<=0||Math.abs(p.getY(i)-pivot.y)>.065)continue;
      examined++;
      for(let j=0;j<4;j++){
        if(weights.array[i*4+j]<.0001)continue;
        const name=mesh.skeleton.bones[joints.array[i*4+j]].name;
        assert.ok(name===side+'UpperLeg'||name===side+'LowerLeg',`${side} knee vertex follows ${name}`);
      }
    }
    assert.ok(examined>60);
  }
});

test('四组 RAB 动作包含实际关节变化，循环首尾一致且没有水平根位移', () => {
  assert.deepEqual(gltf.animations.map(c=>c.name).sort(),['Idle','Mine','Run','Walk']);
  for(const clip of gltf.animations) {
    assert.ok(clip.validate());
    const animated=clip.tracks.filter(t=>t.name.endsWith('.quaternion')&&Array.from(t.values).some((v,i)=>Math.abs(v-t.values[i%4])>.01));
    assert.ok(animated.length>=6,clip.name+' contains moving joints');
    for(const track of clip.tracks) {
      const size=track.getValueSize();
      for(let i=0;i<size;i++)assert.ok(Math.abs(track.values[i]-track.values[track.values.length-size+i])<.0001,`${clip.name}: ${track.name} loop seam`);
      if(track.name==='Root.position')for(let i=0;i<track.values.length;i+=3){assert.equal(track.values[i],0);assert.equal(track.values[i+2],0);}
    }
  }
});

test('行走和跑步时膝盖在朝前的弯折平面内运动，不向侧面拧出', () => {
  const mixer=new AnimationMixer(gltf.scene),metrics={};
  const bone=name=>mesh.skeleton.bones.find(b=>b.name===name);
  try{
    for(const clip of gltf.animations.filter(c=>c.name==='Walk'||c.name==='Run')){
      mixer.stopAllAction();mixer.clipAction(clip).reset().play();
      let maximumLateral=0;
      for(let frame=0;frame<Math.round(clip.duration*60);frame++){
        mixer.setTime(frame/60);gltf.scene.updateMatrixWorld(true);
        const forward=new Vector3(0,0,-1).applyQuaternion(bone('LowerTorso').getWorldQuaternion(new Quaternion()));
        for(const side of ['Left','Right']){
          const hip=bone(side+'UpperLeg').getWorldPosition(new Vector3());
          const knee=bone(side+'LowerLeg').getWorldPosition(new Vector3()).sub(hip);
          const ankle=bone(side+'Foot').getWorldPosition(new Vector3()).sub(hip).normalize();
          const pole=forward.clone().addScaledVector(ankle,-forward.dot(ankle)).normalize();
          const normal=ankle.clone().cross(pole).normalize();
          maximumLateral=Math.max(maximumLateral,Math.abs(knee.dot(normal)));
          assert.ok(knee.dot(pole)>-.001,`${clip.name} ${side} knee bends backward`);
        }
      }
      metrics[clip.name]=maximumLateral;
      assert.ok(maximumLateral<.002,`${clip.name}: lateral knee deviation ${maximumLateral}m`);
    }
    console.log('Knee deviation from forward bending plane (metres)',metrics);
  }finally{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
});

test('待机、行走和跑步全周期的蒙皮顶点保持人体尺度，脚底不穿地', () => {
  const mixer=new AnimationMixer(gltf.scene),v=new Vector3();
  for(const clip of gltf.animations.filter(c=>c.name!=='Mine')){
    mixer.stopAllAction();mixer.clipAction(clip).reset().play();
    for(let frame=0;frame<32;frame++){
      mixer.setTime(clip.duration*frame/32);gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
      const bounds=new Box3();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);assert.ok(v.toArray().every(Number.isFinite));bounds.expandByPoint(v);}
      assert.ok(bounds.min.y>-.008&&bounds.min.y<.02,`${clip.name}: floor=${bounds.min.y}`);
      assert.ok(bounds.max.y>1.6&&bounds.max.y<2.05,`${clip.name}: height=${bounds.max.y}`);
      assert.ok(bounds.max.x-bounds.min.x<1.4,`${clip.name}: body width`);
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
});

test('跑步时相邻顶点不会因绑定到不同肢体而拉出长刺', () => {
  const p=mesh.geometry.attributes.position,ix=mesh.geometry.index.array,edges=new Map();
  for(let i=0;i<ix.length;i+=3)for(const[a,b]of[[ix[i],ix[i+1]],[ix[i+1],ix[i+2]],[ix[i+2],ix[i]]]){
    const length=new Vector3().fromBufferAttribute(p,a).distanceTo(new Vector3().fromBufferAttribute(p,b));
    if(length>.015)edges.set([a,b].sort((a,b)=>a-b).join(','),{a,b,length});
  }
  const mixer=new AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>c.name==='Run');
  mixer.clipAction(clip).play();
  let maximumStretch=0,maximumEdge=0;
  for(let frame=0;frame<12;frame++){
    mixer.setTime(clip.duration*frame/12);gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
    const positions=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()));
    for(const edge of edges.values()){
      const length=positions[edge.a].distanceTo(positions[edge.b]);
      maximumStretch=Math.max(maximumStretch,length/edge.length);
      maximumEdge=Math.max(maximumEdge,length);
    }
  }
  console.log({maximumStretch,maximumEdge});
  assert.ok(maximumStretch<5,`vertex stretch ${maximumStretch}`);
  assert.ok(maximumEdge<.2,`stretched edge ${maximumEdge}`);
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
});
