import assert from 'node:assert/strict';
import test from 'node:test';
import { BlockHealth } from '../../src/game/logic/BlockHealth.ts';
import { BlockCracks } from '../../src/game/presentation/BlockCracks.ts';
import { crackAtlas, crackStage, CRACK_TILE, CRACK_STAGES } from '../../src/game/presentation/cracks.ts';
import { GameSession } from '../../src/game/application/GameSession.ts';

test('crack stages derive from HP fraction, clamp, and allocate nothing for intact blocks',()=>{
 assert.equal(crackStage(100,100),0);assert.equal(crackStage(90,100),1);assert.equal(crackStage(80,100),2);
 assert.equal(crackStage(20,30),4);assert.equal(crackStage(40,60),4);assert.equal(crackStage(1,100),10);assert.equal(crackStage(0,100),10);
});
test('pixel crack stages retain all existing dark pixels and become progressively denser',()=>{
 const data=crackAtlas();assert.equal(data.length,CRACK_TILE*CRACK_TILE*CRACK_STAGES*4);
 let previous=new Set();
 for(let stage=0;stage<CRACK_STAGES;stage++){
  const dark=new Set();
  for(let y=0;y<CRACK_TILE;y++)for(let x=0;x<CRACK_TILE;x++){
   const offset=(y*CRACK_TILE*CRACK_STAGES+stage*CRACK_TILE+x)*4;
   if(data[offset+3]===225)dark.add(y*CRACK_TILE+x);
  }
  assert.ok(dark.size>previous.size,`stage ${stage+1} adds cracks`);assert.ok(dark.size<CRACK_TILE*CRACK_TILE*.5);
  for(const pixel of previous)assert.ok(dark.has(pixel));previous=dark;
 }
 assert.deepEqual(crackAtlas(),data);
});
test('health observer replays sparse damage, removes actual destroyed cells, and unsubscribes',()=>{
 const health=new BlockHealth();health.damage('a',30,10);const events=[];
 const off=health.observe((...args)=>events.push(args));health.damage('b',100,50);health.forget('a');health.forget('absent');off();health.damage('b',100,10);
 assert.deepEqual(events,[['a',20],['b',50],['a',null]]);
});
const near=new Map([['0,-1,-2',{coord:[0,-1,-2],resource:{mesh:{}}}]]);
const damage=(x,hp=50)=>({cell:[x,-1,-25],hp,maximum:100});
test('damage rendering batches by region, skips idle work and restores after render unloading',()=>{
 const view=new BlockCracks();try{
  view.setDamage(damage(14));view.setDamage(damage(15,20));view.sync(near);
  assert.equal(view.group.children.length,1);assert.equal(view.diagnostics().instances,2);assert.equal(view.diagnostics().regions,1);
  const mesh=view.group.children[0];assert.deepEqual(Array.from(mesh.geometry.getAttribute('crackTile').array),[4,7]);
  const updates=view.diagnostics().updates;for(let i=0;i<1000;i++)view.sync(near);assert.equal(view.diagnostics().updates,updates);
  view.setDamage(damage(14,49));view.sync(near);assert.equal(view.diagnostics().updates,updates+1);
  view.setDamage(damage(14,48));view.sync(near);assert.equal(view.diagnostics().updates,updates+1,'same stage does not reupload');
  let disposed=0;mesh.addEventListener('dispose',()=>disposed++);view.sync(new Map());assert.equal(view.diagnostics().instances,0);assert.equal(disposed,1);
  view.sync(near);assert.equal(view.diagnostics().instances,2);assert.equal(view.group.children[0].geometry.getAttribute('crackTile').getX(0),5);
  view.setDamage({cell:[14,-1,-25],hp:0,maximum:0});view.sync(near);assert.equal(view.diagnostics().instances,1);
  view.setDamage({cell:[15,-1,-25],hp:0,maximum:0});view.sync(near);assert.equal(view.diagnostics().regions,0);
 }finally{view.dispose()}
});
test('distant damage allocates no meshes; negative/deep coordinates and cleanup remain correct',()=>{
 const view=new BlockCracks();for(let y=-2;y>-2000;y-=16)view.setDamage({cell:[-1,y,0],hp:1,maximum:10});
 view.sync(near);assert.equal(view.diagnostics().instanceBytes,0);assert.equal(view.diagnostics().instances,0);
 view.sync(new Map([['-1,-1,0',{coord:[-1,-1,0],resource:{mesh:{}}}]]));assert.equal(view.diagnostics().instances,1);
 const mesh=view.group.children[0];assert.deepEqual(mesh.position.toArray(),[-32,-32,0]);assert.equal(mesh.instanceMatrix.array[12],31);assert.equal(mesh.instanceMatrix.array[13],29);
 view.dispose();assert.equal(view.group.children.length,0);assert.equal(view.diagnostics().regions,0);
});
test('session damage projection persists across selection and clears only on actual removal',()=>{
 let now=0,solid=true;const session=new GameSession(50,()=>now),view=new BlockCracks();
 const cell=[14,-1,-25];session.attach({cell:()=>solid?6:0,pending:()=>false,mine:()=>true,cancelMining:()=>{},returnToSurface:()=>{}});
 const off=session.observeBlockDamage(view.setDamage);
 session.hit(cell);view.sync(near);assert.equal(view.group.children[0].geometry.getAttribute('crackTile').getX(0),0);
 session.selectTarget(null);session.resetPosition();view.sync(near);assert.equal(view.diagnostics().instances,1);
 for(let i=1;i<35;i++){now=i*.5;session.hit(cell)}view.sync(near);assert.equal(view.group.children[0].geometry.getAttribute('crackTile').getX(0),9);
 assert.equal(session.getSnapshot().inventory.used,0);solid=false;session.collected([{cell,kind:6}]);view.sync(near);
 assert.equal(view.diagnostics().instances,0);assert.equal(session.getSnapshot().inventory.used,15);off();view.dispose();
});
