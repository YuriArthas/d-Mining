import assert from 'node:assert/strict';
import test from 'node:test';
import { FixedStepClock, RenderSchedule } from '../../src/game/movement.ts';
import { CharacterPhysics, initPhysics, RAPIER } from '../../src/game/validation/physics.ts';
await initPhysics();
test('30/60/90/120 Hz drive equal speed, with diagonal normalization and camera-relative axes',()=>{
 for(const hz of [30,60,90,120,144,240])for(const [x,z,yaw,expected] of [[1,0,0,[6,0]],[1,1,0,[6/Math.sqrt(2),-6/Math.sqrt(2)]],[0,1,Math.PI/2,[-6,0]]]){
  const p=new CharacterPhysics(),clock=new FixedStepClock();try{
   p.world.createCollider(RAPIER.ColliderDesc.cuboid(30,0.5,30).setTranslation(40,-0.5,40));p.teleport([40,0.025,40]);
   for(let i=0;i<hz;i++)clock.advance(1/hz,()=>p.tick(x,z,yaw,false,true));
   assert.equal(p.steps,60);assert.ok(Math.abs(p.feet()[0]-40-expected[0])<0.003);assert.ok(Math.abs(p.feet()[2]-40-expected[1])<0.003);
  }finally{p.dispose();}
 }
});
test('render deadlines retain 60 Hz average on higher-refresh screens',()=>{
 for(const hz of [60,90,120]){
  const schedule=new RenderSchedule();let renders=0;
  for(let i=0;i<hz*10;i++)if(schedule.due(i*1000/hz))renders++;
  assert.ok(Math.abs(renders-600)<=1,`${hz} Hz: ${renders}`);
 }
});
test('long frames are bounded; interpolation stays between steps and resets on teleport',()=>{
 const clock=new FixedStepClock();let ticks=0;
 assert.equal(clock.advance(5,()=>ticks++),6);assert.equal(ticks,6);assert.ok(Math.abs(clock.droppedSeconds-4.9)<1e-9);assert.ok(clock.alpha<1e-6);
 clock.advance(1/120,()=>ticks++);assert.ok(Math.abs(clock.alpha-0.5)<1e-6);clock.reset();assert.equal(clock.alpha,0);
 const p=new CharacterPhysics();try{
  p.teleport([30,20,30]);const before=p.feet();p.tick(1,0,0,false,true);const after=p.feet(),middle=p.interpolatedFeet(0.5);
  middle.forEach((v,i)=>assert.ok(Math.abs(v-(before[i]+after[i])/2)<1e-7));
  p.teleport([35,15,35]);assert.deepEqual(p.interpolatedFeet(0),p.feet());
 }finally{p.dispose();}
});

test('60 Hz vsync jitter does not turn the frame limiter into a lower frame rate',()=>{
 for(const jitter of [.3,.5,1,2,4]){
  const schedule=new RenderSchedule();let renders=0;
  for(let i=0;i<6000;i++)if(schedule.due(i*1000/60+(i%2===0?jitter:-jitter)))renders++;
  assert.equal(renders,6000,`timestamp jitter +/-${jitter} ms must retain 60 FPS`);
 }
});
test('slow browser RAF does not lose frames and a background gap does not trigger catch-up',()=>{
 for(const hz of [30,40,50,59.94]){
  const schedule=new RenderSchedule();let renders=0;
  for(let i=0;i<1000;i++)if(schedule.due(i*1000/hz))renders++;
  assert.equal(renders,1000);
 }
 const schedule=new RenderSchedule();schedule.due(0);assert.equal(schedule.due(10000),true);
 assert.equal(schedule.due(10001),false);assert.equal(schedule.due(10002),false);
 assert.equal(schedule.due(10000+1000/60),true);
});

test('display mode submits every RAF at high refresh; switching back resets the 60 Hz deadline',()=>{
 for(const hz of [60,90,120,144,240]){
  const schedule=new RenderSchedule();let renders=0;
  for(let i=0;i<hz*10;i++)if(schedule.due(i*1000/hz,'display'))renders++;
  assert.equal(renders,hz*10);
 }
 const schedule=new RenderSchedule();schedule.due(0);assert.equal(schedule.due(1),false);
 assert.equal(schedule.due(2,'display'),true);assert.equal(schedule.due(3,'display'),true);
 assert.equal(schedule.due(4,'60'),true);assert.equal(schedule.due(5,'60'),false);
});
