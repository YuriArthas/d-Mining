import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationMixer, Group, Texture, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MinerAvatar} from '../../src/game/presentation/MinerAvatar.ts';
import {SWING_SECONDS} from '../../src/game/presentation/MinerMiningLayer.ts';
import {SWING_IMPACT, createMinerMotions} from '../../src/game/presentation/minerMotions.ts';

const loader=new GLTFLoader().register(()=>({name:'cpu-test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
const parse=name=>{
  const b=readFileSync(new URL(`../../src/game/assets/${name}.glb`,import.meta.url));
  return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
};
async function avatar() {
  const result=Reflect.construct(MinerAvatar,await Promise.all(['character/miner-d','shop/equipment'].map(parse)));
  new Group().add(result.group);result.update([0,0,0],0,true,false);
  return result;
}
const tip=a=>a.diagnostics().pickaxe.tip;
const bone=(a,name)=>a.group.getObjectByName(name);

test('挥镐：先举到头后上方，再在命中相位把镐尖砸到正前方胸口高度的方块面',async()=>{
  const a=await avatar();
  try{
    for(let i=0;i<30;i++)a.update([0,0,0],1/60,true,false);
    const speed=2,period=1/speed,dt=1/240;
    a.strike([0,1,-2],speed);
    let top=null,impact=null;
    for(let t=0;t<period;t+=dt){
      a.update([0,0,0],dt,true,false);
      const p=tip(a);
      if(!top||p[1]>top[1])top=p;
      if(!impact&&a.diagnostics().mining.phase>=SWING_IMPACT)impact=p;
    }
    assert.ok(top[1]>1.9&&top[2]>-.3,`wind-up lifts the pick over and behind the head: ${top}`);
    assert.ok(impact[2]<-.9&&impact[2]>-1.4,`contact reaches the face of the block in front: ${impact}`);
    assert.ok(impact[1]>.6&&impact[1]<1.3,`contact lands at chest height: ${impact}`);
  }finally{a.dispose();}
});

test('挥镐：低处目标俯身下砸，高处目标后仰上挑',async()=>{
  const heights={};
  for(const [name,target] of Object.entries({low:[0,-1,-1.2],high:[0,3,-2]})){
    const a=await avatar();
    try{
      a.strike(target,2);
      while(a.diagnostics().mining.phase<SWING_IMPACT)a.update([0,0,0],1/240,true,false);
      heights[name]=tip(a)[1];
    }finally{a.dispose();}
  }
  assert.ok(heights.low<.6,`digging down strikes low: ${heights.low}`);
  assert.ok(heights.high>1.3,`mining overhead strikes high: ${heights.high}`);
});

test('高攻速每次命中都计数，但手臂按最短挥动时长连贯挥镐，停手后不补播',async()=>{
  const a=await avatar();
  try{
    const dt=1/120;let hits=0;
    for(let frame=0;frame<240;frame++){
      if(frame%8===0){a.strike([0,1,-2],16);hits++;}
      a.update([0,0,0],dt,true,false);
    }
    const d=a.diagnostics().mining;
    assert.equal(d.strikes,hits);
    assert.equal(d.speed,16);
    assert.equal(d.swingSeconds,SWING_SECONDS.min);
    assert.ok(d.swings<=Math.ceil(2/SWING_SECONDS.min)+1&&d.swings>=Math.floor(2/SWING_SECONDS.min)-1,`visible swings stay readable: ${d.swings}`);
    let settle=0;
    while(a.diagnostics().mining.active&&settle<1){a.update([0,0,0],dt,true,false);settle+=dt;}
    assert.ok(settle<=SWING_SECONDS.min*2+.13,`no backlog after the last hit: ${settle}`);
    assert.ok(a.diagnostics().mining.swings<=d.swings+1,'at most the one waiting swing plays after the last hit');
  }finally{a.dispose();}
});

test('跳跃：上升收膝、下落张臂、落地屈膝缓冲后回到待机',async()=>{
  const a=await avatar();
  try{
    for(let i=0;i<30;i++)a.update([0,0,0],1/60,true,false);
    const restRoot=bone(a,'Root').getWorldPosition(new Vector3()).y;
    let y=0,vy=9,rise=null,fall=null,maxAir=0;
    while(true){
      vy-=24/60;y+=vy/60;
      if(y<=0)break;
      a.update([0,y,0],1/60,false,false);
      const d=a.diagnostics();maxAir=Math.max(maxAir,d.air.airborne);
      const thigh=bone(a,'RightUpperLeg').rotation.x;
      if(vy>4&&d.air.airborne>.9)rise??=thigh;
      if(vy<-6)fall=thigh;
    }
    assert.ok(maxAir>.95,'air pose takes over while airborne');
    assert.ok(rise>.7,`knee tucked on the way up: ${rise}`);
    assert.ok(fall<rise-.3,`legs open up on the way down: ${fall}`);
    let lowest=Infinity,landed=false;
    for(let t=0;t<.5;t+=1/60){
      a.update([0,0,0],1/60,true,false);
      landed||=a.diagnostics().air.landing;
      lowest=Math.min(lowest,bone(a,'Root').getWorldPosition(new Vector3()).y);
    }
    assert.ok(landed,'landing registered');
    assert.ok(restRoot-lowest>.06,`hips dip on landing: ${restRoot-lowest}`);
    const d=a.diagnostics();
    assert.equal(d.air.landing,false);
    assert.equal(d.clips[0].weight,1,'idle fully restored after the landing');
  }finally{a.dispose();}
});

test('走下矮台阶或短暂离地不算下落，也不触发落地下蹲',async()=>{
  const a=await avatar();
  try{
    for(let i=0;i<30;i++)a.update([0,0,0],1/60,true,false);
    a.update([0,-.1,0],1/60,false,false);a.update([0,-.2,0],1/60,false,false);
    for(let i=0;i<20;i++){
      a.update([0,-.25,0],1/60,true,false);
      const d=a.diagnostics();
      assert.ok(d.air.airborne<.05,`brief step-down stays grounded: ${d.air.airborne}`);
      assert.equal(d.air.landing,false);
    }
  }finally{a.dispose();}
});

test('落地下蹲姿势把两脚留在原地：只降低骨盆、弯曲膝盖',async()=>{
  const gltf=await parse('character/miner-d');
  const rig=gltf.scene,feet=['LeftFoot','RightFoot'];
  rig.updateMatrixWorld(true);
  const rest=feet.map(n=>rig.getObjectByName(n).getWorldPosition(new Vector3()));
  const restRoot=rig.getObjectByName('Root').getWorldPosition(new Vector3());
  const mixer=new AnimationMixer(rig);
  mixer.clipAction(createMinerMotions(rig).land).play();mixer.update(0);rig.updateMatrixWorld(true);
  feet.forEach((n,i)=>{
    const now=rig.getObjectByName(n).getWorldPosition(new Vector3());
    assert.ok(now.distanceTo(rest[i])<.005,`${n} stays planted: ${now.distanceTo(rest[i])}`);
  });
  assert.ok(restRoot.y-rig.getObjectByName('Root').getWorldPosition(new Vector3()).y>.1,'pelvis lowered');
  for(const side of ['Left','Right'])assert.ok(rig.getObjectByName(`${side}LowerLeg`).rotation.x<-.5,`${side} knee bends backward`);
});

test('电钻类工具（打蛋器）：平端在胸前往前顶，手臂抖动、搅头转动；不像镐那样举过头顶',async()=>{
  const a=await avatar();
  try{
    a.setEquipment(7,1);
    assert.equal(a.diagnostics().pickaxe.motion,'drill');assert.equal(a.diagnostics().pickaxe.spinners,2);
    for(let i=0;i<30;i++)a.update([0,0,0],1/60,true,false);
    let spinner;a.group.getObjectByName('equipped-pickaxe').traverse(o=>{if(!spinner&&o.name.startsWith('Spin'))spinner=o;});const before=spinner.quaternion.clone();
    const dt=1/240,arm=bone(a,'RightUpperArm'),tips=[],turns=[];
    for(let frame=0;frame<360;frame++){
      if(frame%120===0)a.strike([0,1,-2],2);
      a.update([0,0,0],dt,true,false);
      if(frame>24){tips.push(tip(a));turns.push(arm.quaternion.clone());}
    }
    const high=Math.max(...tips.map(p=>p[1])),low=Math.min(...tips.map(p=>p[1]));
    assert.ok(high<1.6&&low>.8,`held level at chest height, never raised overhead: ${low.toFixed(2)}..${high.toFixed(2)}`);
    assert.ok(tips.every(p=>p[2]<-1.1),'the whisks stay pointed at the block in front');
    // The shake: the arm's rotation keeps changing frame to frame while the hold stays put.
    const wobble=Math.max(...turns.slice(1).map((q,i)=>q.angleTo(turns[i])));
    assert.ok(wobble>.002&&wobble<.06,`arms shake a little: ${wobble}`);
    assert.ok(spinner.quaternion.angleTo(before)>.1,'the whisks turn while drilling');
    // Back on a pick: the overhead swing again and nothing spins.
    a.setEquipment(1,1);assert.equal(a.diagnostics().pickaxe.motion,'swing');assert.equal(a.diagnostics().pickaxe.spinners,0);
    a.strike([0,1,-2],2);let top=-Infinity;
    for(let t=0;t<.5;t+=dt){a.update([0,0,0],dt,true,false);top=Math.max(top,tip(a)[1]);}
    assert.ok(top>1.9,`the pick swings overhead: ${top}`);
  }finally{a.dispose();}
});

test('背包装载：有开口或窗户的背包，矿堆随装满程度长高，空了就不显示',async()=>{
  const a=await avatar();
  try{
    a.setEquipment(1,4);
    const settle=f=>{a.setBagFill(f);for(let i=0;i<120;i++)a.update([0,0,0],1/60,true,false);return a.diagnostics().backpack;};
    assert.equal(settle(0).load.visible,false);
    const half=settle(.5);assert.ok(Math.abs(half.load.scale-.5)<.01&&half.load.visible,`half full: ${JSON.stringify(half)}`);
    assert.ok(Math.abs(settle(1).load.scale-1)<.01);
    // Swapping bags keeps the load; closed bags (the watermelon) have none.
    a.setEquipment(1,9);assert.ok(Math.abs(a.diagnostics().backpack.load.scale-1)<.01);
    a.setEquipment(1,5);assert.equal(a.diagnostics().backpack.load,null);
    // The fish tank's glass stays see-through and draws after its contents.
    a.setEquipment(1,4);
    let glass;a.group.getObjectByName('equipped-backpack').traverse(o=>{if(!glass&&o.name.startsWith('Glass'))glass=o;});
    assert.ok(glass.material.userData.opacity<.5&&glass.renderOrder>0);
  }finally{a.dispose();}
});

test('会动的部件：齿轮战斧挥动时齿轮转，停手就停；传送门背包的漩涡一直慢慢转',async()=>{
  const a=await avatar();
  try{
    a.setEquipment(19,29);
    const find=(root,prefix)=>{let hit;a.group.getObjectByName(root).traverse(o=>{if(!hit&&o.name.startsWith(prefix))hit=o;});return hit;};
    const gear=find('equipped-pickaxe','Spin'),swirl=find('equipped-backpack','Spin');
    assert.equal(a.diagnostics().pickaxe.motion,'swing');
    const g0=gear.quaternion.clone(),s0=swirl.quaternion.clone();
    for(let i=0;i<60;i++)a.update([0,0,0],1/60,true,false);
    assert.ok(gear.quaternion.angleTo(g0)<1e-6,'the gear rests while idle');
    assert.ok(swirl.quaternion.angleTo(s0)>.5,'the portal swirls on its own');
    a.strike([0,1,-2],2);for(let i=0;i<20;i++)a.update([0,0,0],1/60,true,false);
    assert.ok(gear.quaternion.angleTo(g0)>.5,'the gear turns while swinging');
  }finally{a.dispose();}
});
