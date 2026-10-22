import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, Color, Fog, HemisphereLight, DirectionalLight} from 'three';
import {EnvironmentController} from '../../src/game/presentation/EnvironmentController.ts';
import {ENVIRONMENT_CONFIG} from '../../src/game/world/environment.ts';
import {surfaceLightStrength, surfaceLightStrengthAtFeet} from '../../src/game/world/SurfaceLightFade.ts';
function setup(){
 const scene=new Scene(),background=new Color('#123456'),fog=new Fog('#234567',5,10);
 scene.background=background;scene.fog=fog;
 const ambient=new HemisphereLight(),key=new DirectionalLight();
 const sky={active:false,time:null,disposed:0,prepared:0,submitted:0,prepareDraw(){this.prepared++;},markSubmitted(){this.submitted++;},setDaylight(v){this.daylight=v;this.time=v>=.5?'day':'night';},setLightingStrength(v){this.lightingStrength=v;},setEnabled(v){this.active=v;if(v)scene.background=null;},dispose(){this.disposed++;},diagnostics(){return {};}};
 const lights={active:false,time:null,disposed:0,setDaylight(v){this.daylight=v;this.time=v>=.5?'day':'night';},setSurfaceStrength(v){this.strength=v;this.active=v>0;},dispose(){this.disposed++;},diagnostics(){return {};}};
 const env=new EnvironmentController(scene,ambient,key,sky,lights,ENVIRONMENT_CONFIG);
 return {scene,ambient,key,sky,lights,env,background,fog};
}
const surface={surface:true,surfaceLightStrength:1,time:'night',depth:0,sky:'#b8deeb',groundLight:'#b8d2c4',sceneryRevision:1};
test('prewarm and first surface frame use identical illumination, daytime hides the night rig',()=>{
 const c=setup();c.env.prepare(surface);
 const before=[c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()];
 c.env.update(surface,.016);
 assert.deepEqual([c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()],before);
 assert.equal(c.scene.fog,null);assert.equal(c.scene.background,null);assert.equal(c.sky.active,true);
 c.env.update({...surface,time:'day'},.016);
 assert.equal(c.lights.time,'day');assert.equal(c.key.intensity,ENVIRONMENT_CONFIG.surface.day.moonIntensity);
});
test('underground detaches surface environment and tracks configured depth; returning restores surface',()=>{
 const c=setup();c.env.prepare(surface);
 c.env.update({...surface,surface:false,surfaceLightStrength:0,depth:400,sky:'#414e55'},.1);
 assert.equal(c.sky.active,false);assert.equal(c.lights.active,false);
 assert.equal(c.key.position.y,42-400);assert.equal(c.key.target.position.y,-400);
 assert.equal(c.scene.fog.near,38);assert.equal(c.scene.fog.far,74);
 assert.equal(c.key.castShadow,false);
 c.env.update(surface,.1);assert.equal(c.scene.fog,null);assert.equal(c.sky.active,true);
});
test('disposal is idempotent, restores borrowed scene state and rejects late updates',()=>{
 const c=setup();c.env.prepare(surface);c.env.dispose();c.env.dispose();
 assert.equal(c.sky.disposed,1);assert.equal(c.lights.disposed,1);
 assert.equal(c.scene.background,c.background);assert.equal(c.scene.fog,c.fog);
 assert.throws(()=>c.env.update(surface,.1),/disposed/);
});
test('prewarm and runtime fade base lights toward the underground baseline with the entrance coefficient',()=>{
 const c=setup(),frame={...surface,surfaceLightStrength:.37};
 c.env.prepare(frame);assert.equal(c.lights.strength,.37);assert.equal(c.sky.lightingStrength,.37);
 assert.equal(c.key.intensity,2.5+(2.25-2.5)*.37);
 const intensity=c.key.intensity,updates=c.env.updates;
 c.env.update({...frame,surfaceLightStrength:.36},.016);
 assert.equal(c.lights.strength,.36);assert.ok(c.key.intensity>intensity);
 assert.equal(c.key.intensity,2.5+(2.25-2.5)*.36);
 assert.equal(c.env.updates,updates+1);assert.equal(c.key.castShadow,false);
 c.env.update({...frame,surfaceLightStrength:.36},.016);assert.equal(c.env.updates,updates+1);
 c.env.dispose();
});

test('automatic cycle interpolates the actual sky, ambient, key and night lights consistently',()=>{
 const c=setup(),frame={...surface,time:'auto'};c.env.prepare(frame);
 assert.equal(c.env.daylightBlend,0);assert.equal(c.sky.daylight,0);
 c.env.update(frame,.016,444);
 assert.equal(c.env.daylightBlend,.5);assert.equal(c.sky.daylight,.5);assert.equal(c.lights.daylight,.5);
 assert.equal(c.ambient.intensity,(ENVIRONMENT_CONFIG.surface.night.ambientIntensity+ENVIRONMENT_CONFIG.surface.day.ambientIntensity)/2);
 assert.equal(c.key.intensity,(ENVIRONMENT_CONFIG.surface.night.moonIntensity+ENVIRONMENT_CONFIG.surface.day.moonIntensity)/2);
 assert.equal(c.env.cameraDaylightBlend,.5);
 c.env.update(frame,.016,6);assert.equal(c.env.daylightBlend,1);
 c.env.dispose();
});

test('the underground baseline and camera grade are independent of the surface cycle',()=>{
 const c=setup(),frame={...surface,time:'auto',surface:false,surfaceLightStrength:0,depth:400};c.env.prepare(frame);
 const before=[c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()];
 c.env.update(frame,.016,450);
 assert.equal(c.env.daylightBlend,1);assert.equal(c.env.cameraDaylightBlend,0);
 assert.deepEqual([c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()],before);
 assert.equal(c.sky.active,false);assert.equal(c.lights.strength,0);
 c.env.update({...frame,surface:true,depth:0,surfaceLightStrength:1},.016,0);
 assert.equal(c.sky.active,true);assert.equal(c.env.cameraDaylightBlend,1);
 c.env.dispose();
});

test('debug clock advance changes no lighting until the next automatic frame',()=>{
 const c=setup(),frame={...surface,time:'auto'};c.env.prepare(frame);
 assert.equal(c.env.advanceDayNight(444).daylight,.5);
 assert.equal(c.env.daylightBlend,0);assert.equal(c.sky.daylight,0);
 c.env.update(frame,.016,0);assert.equal(c.env.daylightBlend,.5);assert.equal(c.sky.daylight,.5);
 c.env.update({...frame,time:'night'},.016,100);assert.equal(c.env.daylightBlend,0);
 c.env.update(frame,.016,0);assert.equal(c.env.daylightBlend,.5,'manual debug mode does not advance the automatic cycle');
 assert.throws(()=>c.env.advanceDayNight(-1),/非负有限数/);
 c.env.dispose();
});

test('logic updates do not prepare GPU work; startup and admitted draws own preparation',()=>{
 const c=setup(),frame={...surface,time:'auto'};c.env.prepare(frame);
 assert.equal(c.sky.prepared,1);assert.equal(c.sky.submitted,0);
 c.env.advanceDayNight(438);
 for(let i=0;i<100;i++)c.env.update(frame,.016);
 assert.ok(c.sky.daylight>0);assert.equal(c.sky.prepared,1);assert.equal(c.sky.submitted,0);
 c.env.prepareDraw();assert.equal(c.sky.prepared,2);
 c.env.markSubmitted();assert.equal(c.sky.submitted,1);
 c.env.dispose();
 assert.throws(()=>c.env.prepareDraw(),/disposed/);assert.throws(()=>c.env.markSubmitted(),/disposed/);
});

function baseLighting(c) {
 return [...c.ambient.color.toArray(),...c.ambient.groundColor.toArray(),c.ambient.intensity,
  ...c.key.color.toArray(),c.key.intensity,...c.key.position.toArray(),...c.key.target.position.toArray(),c.env.cameraDaylightBlend];
}

test('30m, 32m and 100m in the first mine keep base lighting and camera fixed while the visible sky cycles',()=>{
 for(const depth of [30,32,100]) {
  const c=setup(),frame={...surface,time:'auto',surfaceLightStrength:surfaceLightStrengthAtFeet(-depth+.027)};
  assert.equal(frame.surfaceLightStrength,0);
  c.env.prepare(frame);
  const baseline=baseLighting(c),updates=c.env.updates;
  assert.equal(c.ambient.intensity,ENVIRONMENT_CONFIG.underground.ambientIntensity);
  assert.equal(c.key.intensity,ENVIRONMENT_CONFIG.underground.keyIntensity);
  assert.equal(c.key.color.getHex(),new Color(ENVIRONMENT_CONFIG.underground.keyColor).getHex());
  assert.deepEqual(c.env.ambientSnapshot,{color:c.ambient.color.getHex(),groundColor:c.ambient.groundColor.getHex(),intensity:c.ambient.intensity});
  for(const [elapsed,daylight] of [[444,.5],[6,1],[444,.5],[6,0]]) {
   c.env.update(frame,.016,elapsed);
   assert.equal(c.env.daylightBlend,daylight);assert.equal(c.sky.daylight,daylight);assert.equal(c.sky.active,true);
   assert.equal(c.sky.lightingStrength,0);assert.equal(c.env.environmentLightingStrength,0);
   assert.equal(c.env.cameraDaylightBlend,0);assert.equal(c.lights.strength,0);
   assert.deepEqual(baseLighting(c),baseline);assert.equal(c.env.updates,updates);
   assert.equal(c.scene.fog,null,'retaining the visible sky must not introduce a new fog switch at 30m');
  }
  c.env.dispose();
 }
});

test('the existing 4–30m smooth band makes base lighting and camera continuous on descent and ascent',()=>{
 for(const time of ['night','day','auto']) {
  const c=setup();
  if(time==='auto')c.env.advanceDayNight(444);
  const at = depth => {
   const strength=surfaceLightStrength(depth);
   c.env.update({...surface,time,surfaceLightStrength:strength},.016,0);
   assert.equal(c.sky.lightingStrength,strength);assert.equal(c.lights.strength,strength);
   assert.equal(c.env.cameraDaylightBlend,c.env.daylightBlend*strength);
   return baseLighting(c);
  };
  const entrance=at(4),next=at(4.01);
  assert.ok(entrance.every((v,i)=>Math.abs(v-next[i])<.0001));
  at(16);
  const nearEnd=at(29.99),endpoint=at(30);
  assert.ok(nearEnd.every((v,i)=>Math.abs(v-endpoint[i])<.0001));
  assert.deepEqual(at(32),endpoint);assert.deepEqual(at(30),endpoint);
  assert.deepEqual(at(29.99),nearEnd);
  at(16);assert.deepEqual(at(4),entrance);
  assert.equal(c.key.castShadow,false);c.env.dispose();
 }
});
