import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_POINT_SOURCES,POINT_GRID,localPointLighting} from '../../src/game/presentation/LocalPointLighting.ts';
import {SceneLightingRig} from '../../src/game/presentation/SceneLightingRig.ts';

test('point index includes every contributing light without truncation or position-dependent popping',()=>{
 const g=POINT_GRID;assert.equal(LOCAL_POINT_SOURCES.length,26);assert.ok(g.maxLights<=2);assert.ok(g.data.byteLength<10000);
 let seed=53;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<30000;i++){
  const x=g.minX+rand()*g.width*g.cellSize,z=g.minZ+rand()*g.height*g.cellSize,y=-2+rand()*18;
  const tx=Math.floor((x-g.minX)/g.cellSize),tz=Math.floor((z-g.minZ)/g.cellSize),offset=(tz*g.width+tx)*4;
  const ids=Array.from(g.data.slice(offset,offset+4)).filter(Boolean).map(n=>n-1);
  const contributes=l=>Math.hypot(x-l.position[0],y-l.position[1],z-l.position[2])<l.distance;
  const expected=LOCAL_POINT_SOURCES.flatMap((l,id)=>contributes(l)?[id]:[]);
  assert.deepEqual(ids.filter(id=>contributes(LOCAL_POINT_SOURCES[id])),expected);
 }
});
test('local sources never enter the global Three light loop, and day/depth extinguish illumination',()=>{
 const rig=new SceneLightingRig();
 try{
  rig.setTime('night');assert.equal(rig.diagnostics().activeLights,12);assert.equal(rig.group.children.filter(l=>l.isPointLight).length,2);
  assert.equal(rig.wallLights.length,22);assert.ok(rig.wallLights.every(l=>!l.parent));assert.equal(localPointLighting.enabled.value,1);
  rig.setSurfaceActive(false);assert.equal(localPointLighting.enabled.value,0);
  rig.setSurfaceActive(true);assert.equal(localPointLighting.enabled.value,1);
  rig.setTime('day');assert.equal(localPointLighting.enabled.value,0);
 }finally{rig.dispose();}
});

test('repeated material styling installs one local-light shader block',async()=>{
 const {compileLocalPointLights}=await import('../../src/game/presentation/LocalPointLighting.ts');
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <lights_fragment_begin>'};
 for(let i=0;i<4;i++)compileLocalPointLights(shader);
 assert.equal((shader.vertexShader.match(/varying vec3 localPointWorld/g)||[]).length,1);
 assert.equal((shader.fragmentShader.match(/uniform sampler2D localPointIndex/g)||[]).length,1);
});
