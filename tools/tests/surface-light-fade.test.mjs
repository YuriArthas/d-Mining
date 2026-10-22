import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceLightStrength, surfaceLightStrengthAtFeet, SURFACE_LIGHT_FADE} from '../../src/game/world/SurfaceLightFade.ts';
import {CELL} from '../../src/game/terrain/grid.ts';
import {SceneLightingRig} from '../../src/game/presentation/SceneLightingRig.ts';
import {localPointLighting, compileLocalPointLights} from '../../src/game/presentation/LocalPointLighting.ts';

test('entrance stays lit and the old two-block cutoff fades continuously to zero at 15 blocks',()=>{
 assert.equal(SURFACE_LIGHT_FADE.end,15*CELL);
 assert.equal(surfaceLightStrength(-5),1);
 assert.equal(surfaceLightStrength(2*CELL),1);
 assert.ok(surfaceLightStrength(2*CELL+.01)>.99999);
 assert.ok(surfaceLightStrength(3*CELL)>.98);
 assert.equal(surfaceLightStrength(8.5*CELL),.5);
 assert.ok(surfaceLightStrength(15*CELL-.01)<.00001);
 assert.equal(surfaceLightStrength(15*CELL),0);
 assert.equal(surfaceLightStrength(500),0);
 let previous=1;
 for(let depth=0;depth<=32;depth+=.02){
  const strength=surfaceLightStrength(depth);
  assert.ok(strength<=previous&&strength>=0);
  assert.ok(previous-strength<.002);
  previous=strength;
 }
});

test('descent and ascent scale every supplemental light and local shader together without shadows',()=>{
 const rig=new SceneLightingRig();
 try{
  rig.setTime('night');
  const lights=[rig.key,...rig.fills,...rig.streetLights,...rig.wallLights];
  const levels=lights.map(l=>l.intensity);
  for(const depth of [0,4,4.01,6,16,28,29.99,30,32,30,28,16,6,4,0]){
   const strength=surfaceLightStrength(depth);
   rig.setSurfaceStrength(strength);
   lights.forEach((l,i)=>{assert.equal(l.intensity,levels[i]*strength);assert.equal(l.castShadow,false);});
   assert.equal(localPointLighting.enabled.value,strength);
   assert.equal(rig.diagnostics().activeLights,strength>0?12:0);
   assert.equal(rig.diagnostics().activeShadowLights,0);
   assert.equal(rig.setSurfaceStrength(strength),false,'stationary frames skip light updates');
  }
  rig.setSurfaceStrength(.25);rig.setTime('day');
  assert.equal(rig.diagnostics().activeLights,0);assert.equal(localPointLighting.enabled.value,0);
  rig.setTime('night');assert.equal(localPointLighting.enabled.value,.25);
  assert.equal(rig.key.intensity,levels[0]*.25);
  rig.setSurfaceStrength(0);rig.setTime('day');rig.setTime('night');
  assert.equal(rig.diagnostics().activeLights,0);assert.equal(localPointLighting.enabled.value,0);
 }finally{rig.dispose();}
});

test('local lighting shader scales radiance and only skips evaluation at zero',()=>{
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <lights_fragment_begin>'};
 compileLocalPointLights(shader);
 assert.equal(shader.uniforms.localPointEnabled,localPointLighting.enabled);
 assert.match(shader.fragmentShader,/if\(localPointEnabled>0\.\)/);
 assert.match(shader.fragmentShader,/nearby.color=localPointColors\[id\]\*\(localPointEnabled\*/);
 assert.doesNotMatch(shader.fragmentShader,/localPointEnabled>\.5/);
});

// Measured grounded feet include Rapier's .025m skin and .002m contact slack.
test('15-block floor removes all lights despite contact margin and float32 rounding',()=>{
 for(const feet of [-29.97300033569336,-29.972999572753906,-30,-32])
  assert.equal(surfaceLightStrengthAtFeet(feet),0);
 assert.ok(surfaceLightStrengthAtFeet(-27.973)>.01);
});
