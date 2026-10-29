import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group, PerspectiveCamera, Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MinerAvatar} from '../../src/game/presentation/MinerAvatar.ts';
import {MiningInteraction} from '../../src/game/runtime/MiningInteraction.ts';
import {GameInput} from '../../src/game/GameInput.ts';

async function avatar() {
  const loader=new GLTFLoader().register(()=>({name:'cpu-test-textures',loadTexture:()=>Promise.resolve(new Texture())}));
  const assets=await Promise.all(['character/miner-d','shop/equipment'].map(async name=>{
    const b=readFileSync(new URL(`../../src/game/assets/${name}.glb`,import.meta.url));
    return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  }));
  const result=Reflect.construct(MinerAvatar,assets);
  new Group().add(result.group);result.update([0,0,0],0,true,false);
  return result;
}

test('真实镐子跟随右手挥动，停止后恢复待机；传送取消动作',async()=>{
  const a=await avatar();
  try{
    const before=a.diagnostics(),points=[];
    assert.equal(before.pickaxe.attachedTo,'RightHand');
    assert.equal(before.mining.active,false);
    a.strike([0,0,-3],2);
    for(let i=0;i<25;i++){a.update([0,0,0],1/60,true,false);points.push(a.diagnostics().pickaxe.tip);}
    assert.ok(points.flat().every(Number.isFinite));
    assert.ok(Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))>.35,'pick head must travel through a real swing');
    assert.equal(a.diagnostics().mining.strikes,1);
    for(let i=0;i<30;i++)a.update([0,0,0],1/60,true,false);
    assert.equal(a.diagnostics().mining.active,false);
    assert.equal(a.diagnostics().clips[0].weight,1);
    a.strike([0,0,-3],2);a.update([0,0,0],.05,true,false);
    assert.ok(a.diagnostics().mining.active);
    a.update([0,0,0],.05,true,true);
    assert.equal(a.diagnostics().mining.active,false);
  }finally{a.dispose();a.dispose();}
});

test('边跑边挖保持原有腿部动作；攻速改变不排队补播',async()=>{
  const a=await avatar(),b=await avatar();
  try{
    let frame=0,expected=0;
    for(const speed of [2,8,16]){
      for(let n=0;n<120;n++,frame++){
        if(n%Math.round(120/speed)===0){a.strike([0,-1,-8],speed);expected++;}
        const feet=[0,0,-frame*4/120];
        a.update(feet,1/120,true,false);b.update(feet,1/120,true,false);
        for(const name of ['LowerTorso','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot']){
          const left=a.group.getObjectByName(name),right=b.group.getObjectByName(name);
          assert.deepEqual(left.quaternion.toArray(),right.quaternion.toArray(),`${name} changed during mining`);
          assert.ok(left.position.distanceTo(right.position)<1e-7);
        }
      }
      assert.equal(a.diagnostics().mining.speed,speed);
      assert.equal(a.diagnostics().mining.strikes,expected);
    }
    a.update([0,0,-frame*4/120],2,true,false);
    assert.equal(a.diagnostics().mining.active,false);
    assert.equal(a.diagnostics().mining.strikes,expected);
    a.strike([0,0,-8],2);a.update([0,0,-frame*4/120],.01,true,false);a.cancelMining();
    a.update([0,0,-frame*4/120],.01,true,false);
    assert.equal(a.diagnostics().mining.active,false);
  }finally{a.dispose();b.dispose();}
});

test('挥镐只响应实际伤害：冷却、满包、锁定、空点与零伤害重试均不触发',()=>{
  let result={status:'hit',damage:10},speed=2,allowed=true,ready=true,calls=0;
  const session={observeBlockDamage:()=>()=>{},selectTarget:()=>{},hit:()=>{calls++;return result;},getSnapshot:()=>({miningStats:{speed}})};
  const terrain={ready:()=>ready,canMine:()=>allowed,cell:c=>c[2]===-2?64:0,measurements:{add:()=>{}},render:{pipeline:{residents:new Map()}}};
  const camera=new PerspectiveCamera(60,1,.1,100);camera.position.set(1,1,3);camera.lookAt(1,1,-3);
  const input=new GameInput(),interaction=new MiningInteraction(session);
  const update=()=>interaction.update(camera,[1,0,1],false,input,terrain);
  try{
    input.point(0,0,true);input.mine('mouse',true);update();
    assert.deepEqual(interaction.strike,{target:[1,1,-3],speed:2,cell:[0,0,-2],kind:64,damage:10,breaking:false});
    for(const status of ['cooldown','full','locked','pending','unavailable']){
      result={status};update();assert.equal(interaction.strike,null,status);
    }
    result={status:'breaking',damage:0};update();assert.equal(interaction.strike,null);
    speed=16;result={status:'breaking',damage:4};update();assert.equal(interaction.strike.speed,16);assert.equal(interaction.strike.breaking,true,'the final blow is marked so it can burst at once');
    const previous=calls;
    allowed=false;update();assert.equal(interaction.strike,null);assert.equal(calls,previous);
    allowed=true;ready=false;update();assert.equal(interaction.strike,null);assert.equal(calls,previous);
    ready=true;input.point(0,0,false);update();assert.equal(interaction.strike,null);assert.equal(calls,previous);
    input.mine('mouse',false);input.point(0,0,true);update();assert.equal(interaction.strike,null);assert.equal(calls,previous);
  }finally{interaction.dispose();}
});
