import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfaceDetails} from '../../src/game/presentation/SurfaceDetails.ts';
import {planGrass,grassAllowed} from '../../src/game/world/GrassLayout.ts';
import {MeshStandardMaterial} from 'three';
import {disposeScenery} from '../../src/game/presentation/disposeScenery.ts';
import {SceneLightingRig} from '../../src/game/presentation/SceneLightingRig.ts';

test('grass respects functionality, bounded batches and opaque geometry without per-frame transforms',()=>{
 const placements=planGrass();assert.equal(placements.length,780);assert.deepEqual(placements,planGrass());
 assert.ok(placements.every(p=>grassAllowed(p.x,p.z)));
 const details=new SurfaceDetails(),grass=details.createGrass();
 try{
  assert.ok(details.stats.grassBatches<=12);assert.ok(details.stats.grassTriangles<=22000);assert.ok(details.stats.grassBufferBytes<100000);
  const arrays=grass.children.map(m=>Array.from(m.instanceMatrix.array));
  details.update('night',123);
  for(const [i,m] of grass.children.entries()){assert.equal(m.castShadow,false);assert.equal(m.material.transparent,false);assert.equal(m.material.map,null);assert.deepEqual(Array.from(m.instanceMatrix.array),arrays[i]);}
 }finally{disposeScenery(grass);details.dispose();}
});

test('day extinguishes all surface lamps, night restores them in place; textures released',()=>{
 const details=new SurfaceDetails(),lamp=new MeshStandardMaterial(),rig=new SceneLightingRig();details.installLamp(lamp,'post');
 let released=0;details.atlas.addEventListener('dispose',()=>released++);lamp.emissiveMap.addEventListener('dispose',()=>released++);
 const texture=lamp.emissiveMap;
 details.update('day',0);assert.equal(lamp.emissiveIntensity,0);assert.equal(details.night.value,0);assert.equal(rig.key.intensity,0);assert.ok(rig.fills.every(l=>l.intensity===0));
 details.update('night',1);rig.setTime('night');assert.equal(lamp.emissiveIntensity,2.5);assert.equal(details.night.value,1);assert.ok(rig.key.intensity>0);assert.ok(rig.fills.every(l=>l.intensity>0));assert.equal(lamp.emissiveMap,texture);
 details.dispose();assert.equal(released,2);rig.dispose();lamp.dispose();
});

test('wall torch instances stay resident; day extinguishes flame and real unshadowed lights',()=>{
 const details=new SurfaceDetails(),rig=new SceneLightingRig();
 const view=details.wallTorches,body=view.group.children[0];
 assert.equal(view.diagnostics().count,22);assert.equal(view.diagnostics().trianglesPerTorch,192);assert.equal(view.diagnostics().textureBytes,0);
 assert.equal(rig.wallLights.length,22);
 details.update('day',1);rig.setTime('day');
 assert.equal(view.diagnostics().flamesVisible,false);assert.equal(body.visible,true);
 assert.ok(rig.wallLights.every(l=>!l.visible&&l.intensity===0&&!l.castShadow));
 details.update('night',2);rig.setTime('night');
 assert.equal(view.diagnostics().flamesVisible,true);assert.ok(rig.wallLights.every(l=>l.visible&&l.intensity===14&&l.distance===6&&!l.castShadow));
 rig.setSurfaceActive(false);assert.equal(rig.diagnostics().activeLights,0);assert.equal(view.group.visible,true);
 disposeScenery(view.group);details.dispose();rig.dispose();
});
