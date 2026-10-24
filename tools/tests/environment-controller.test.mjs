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
 const sky={active:false,disposed:0,prepared:0,submitted:0,prepareDraw(){this.prepared++;},markSubmitted(){this.submitted++;},setLightingStrength(v){this.lightingStrength=v;},setEnabled(v){this.active=v;if(v)scene.background=null;},dispose(){this.disposed++;},diagnostics(){return {};}};
 const env=new EnvironmentController(scene,ambient,key,sky,ENVIRONMENT_CONFIG);
 return {scene,ambient,key,sky,env,background,fog};
}
const {surface:DAY,underground:UNDER}=ENVIRONMENT_CONFIG;
const surface={surface:true,surfaceLightStrength:1,depth:0,sky:'#b8deeb',groundLight:'#b8d2c4',sceneryRevision:1};
test('prewarm and the first surface frame use the same daylight',()=>{
 const c=setup();c.env.prepare(surface);
 const before=[c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()];
 c.env.update(surface,.016);
 assert.deepEqual([c.ambient.color.getHex(),c.ambient.intensity,c.key.color.getHex(),c.key.intensity,...c.key.position.toArray()],before);
 assert.equal(c.scene.fog,null);assert.equal(c.scene.background,null);assert.equal(c.sky.active,true);
 assert.equal(c.key.intensity,DAY.sunIntensity);assert.equal(c.ambient.intensity,DAY.ambientIntensity);
 assert.deepEqual(c.key.position.toArray(),[...DAY.sunPosition]);assert.equal(c.env.surfaceBlend,1);
});
test('underground detaches the surface environment and tracks the configured depth; returning restores it',()=>{
 const c=setup();c.env.prepare(surface);
 c.env.update({...surface,surface:false,surfaceLightStrength:0,depth:400,sky:'#414e55'},.1);
 assert.equal(c.sky.active,false);assert.equal(c.env.surfaceBlend,0);
 assert.equal(c.key.position.y,42-400);assert.equal(c.key.target.position.y,-400);
 assert.equal(c.scene.fog.near,38);assert.equal(c.scene.fog.far,74);
 assert.equal(c.key.castShadow,false);
 c.env.update(surface,.1);assert.equal(c.scene.fog,null);assert.equal(c.sky.active,true);
});
test('a layer with its own cave mood uses it underground',()=>{
 const c=setup(),cave={sky:'#8a90e0',ground:'#3d3560',ambient:1.05,key:'#b4c0ff',keyIntensity:.9,fog:'#211f3c'};
 c.env.prepare({...surface,surface:false,surfaceLightStrength:0,depth:800,cave});
 assert.equal(c.ambient.intensity,1.05);assert.equal(c.key.intensity,.9);
 assert.equal(c.ambient.color.getHex(),new Color(cave.sky).getHex());assert.equal(c.scene.fog.color.getHex(),new Color(cave.fog).getHex());
 c.env.dispose();
});
test('disposal is idempotent, restores borrowed scene state and rejects late updates',()=>{
 const c=setup();c.env.prepare(surface);c.env.dispose();c.env.dispose();
 assert.equal(c.sky.disposed,1);
 assert.equal(c.scene.background,c.background);assert.equal(c.scene.fog,c.fog);
 assert.throws(()=>c.env.update(surface,.1),/disposed/);
});
test('prewarm and runtime fade base lights toward the underground baseline with the entrance coefficient',()=>{
 const c=setup(),frame={...surface,surfaceLightStrength:.37};
 c.env.prepare(frame);assert.equal(c.sky.lightingStrength,.37);
 assert.equal(c.key.intensity,UNDER.keyIntensity+(DAY.sunIntensity-UNDER.keyIntensity)*.37);
 const intensity=c.key.intensity,updates=c.env.updates;
 c.env.update({...frame,surfaceLightStrength:.36},.016);
 assert.ok(c.key.intensity<intensity);
 assert.equal(c.key.intensity,UNDER.keyIntensity+(DAY.sunIntensity-UNDER.keyIntensity)*.36);
 assert.equal(c.env.updates,updates+1);assert.equal(c.key.castShadow,false);
 c.env.update({...frame,surfaceLightStrength:.36},.016);assert.equal(c.env.updates,updates+1);
 c.env.dispose();
});
test('logic updates do not prepare GPU work; startup and admitted draws own preparation',()=>{
 const c=setup();c.env.prepare(surface);
 assert.equal(c.sky.prepared,1);assert.equal(c.sky.submitted,0);
 for(let i=0;i<100;i++)c.env.update(surface,.016);
 assert.equal(c.sky.prepared,1);assert.equal(c.sky.submitted,0);
 c.env.prepareDraw();assert.equal(c.sky.prepared,2);
 c.env.markSubmitted();assert.equal(c.sky.submitted,1);
 c.env.dispose();
 assert.throws(()=>c.env.prepareDraw(),/disposed/);assert.throws(()=>c.env.markSubmitted(),/disposed/);
});

function baseLighting(c) {
 return [...c.ambient.color.toArray(),...c.ambient.groundColor.toArray(),c.ambient.intensity,
  ...c.key.color.toArray(),c.key.intensity,...c.key.position.toArray(),...c.key.target.position.toArray(),c.env.surfaceBlend];
}
test('30m, 32m and 100m down the first mine keep the underground baseline under the visible sky',()=>{
 for(const depth of [30,32,100]) {
  const c=setup(),frame={...surface,surfaceLightStrength:surfaceLightStrengthAtFeet(-depth+.027)};
  assert.equal(frame.surfaceLightStrength,0);
  c.env.prepare(frame);
  const baseline=baseLighting(c),updates=c.env.updates;
  assert.equal(c.ambient.intensity,UNDER.ambientIntensity);
  assert.equal(c.key.intensity,UNDER.keyIntensity);
  assert.equal(c.key.color.getHex(),new Color(UNDER.keyColor).getHex());
  assert.deepEqual(c.env.ambientSnapshot,{color:c.ambient.color.getHex(),groundColor:c.ambient.groundColor.getHex(),intensity:c.ambient.intensity});
  for(let i=0;i<4;i++){
   c.env.update(frame,.016);
   assert.equal(c.sky.active,true);assert.equal(c.sky.lightingStrength,0);assert.equal(c.env.surfaceBlend,0);
   assert.deepEqual(baseLighting(c),baseline);assert.equal(c.env.updates,updates);
   assert.equal(c.scene.fog,null,'retaining the visible sky must not introduce a fog switch at 30m');
  }
  c.env.dispose();
 }
});
test('the 4–30m smooth band makes base lighting and camera continuous on descent and ascent',()=>{
 const c=setup();
 const at = depth => {
  const strength=surfaceLightStrength(depth);
  c.env.update({...surface,surfaceLightStrength:strength},.016);
  assert.equal(c.sky.lightingStrength,strength);assert.equal(c.env.surfaceBlend,strength);
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
});
