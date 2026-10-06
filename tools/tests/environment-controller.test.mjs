import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, Color, Fog, HemisphereLight, DirectionalLight} from 'three';
import {EnvironmentController} from '../../src/game/presentation/EnvironmentController.ts';
import {ENVIRONMENT_CONFIG} from '../../src/game/world/environment.ts';
function setup(){
 const scene=new Scene(),background=new Color('#123456'),fog=new Fog('#234567',5,10);
 scene.background=background;scene.fog=fog;
 const ambient=new HemisphereLight(),key=new DirectionalLight();
 const sky={active:false,time:null,disposed:0,setTime(t){this.time=t;},setEnabled(v){this.active=v;if(v)scene.background=null;},dispose(){this.disposed++;},diagnostics(){return {};}};
 const lights={active:false,time:null,disposed:0,setTime(t){this.time=t;},setSurfaceActive(v){this.active=v;},dispose(){this.disposed++;},diagnostics(){return {};}};
 const env=new EnvironmentController(scene,ambient,key,sky,lights,ENVIRONMENT_CONFIG);
 return {scene,ambient,key,sky,lights,env,background,fog};
}
const surface={surface:true,surfaceLightingActive:true,time:'night',depth:0,sky:'#b8deeb',groundLight:'#b8d2c4',sceneryRevision:1};
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
 c.env.update({...surface,surface:false,surfaceLightingActive:false,depth:400,sky:'#414e55'},.1);
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
