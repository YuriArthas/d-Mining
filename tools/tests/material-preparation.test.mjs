import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Texture,ShaderLib} from 'three';
import {pruneInactiveMaps} from '../../src/game/presentation/MaterialPreparation.ts';
import {stabilizeShadows,compileStableShadow} from '../../src/game/presentation/stableShadow.ts';

test('pruning keeps packed roughness and active normal channels, removes only zero multipliers',()=>{
 const packed=new Texture(),normal=new Texture(),m=new MeshStandardMaterial({metalness:0,metalnessMap:packed,roughnessMap:packed,normalMap:normal});
 assert.equal(pruneInactiveMaps(m),1);assert.equal(m.roughnessMap,packed);assert.equal(m.normalMap,normal);
 m.normalScale.set(0,0);m.aoMap=packed;m.aoMapIntensity=0;assert.equal(pruneInactiveMaps(m),2);
 assert.equal(m.normalMap,null);assert.equal(m.aoMap,null);assert.equal(m.roughnessMap,packed);
 const metallic=new MeshStandardMaterial({metalness:1,metalnessMap:packed});pruneInactiveMaps(metallic);assert.equal(metallic.metalnessMap,packed);
 m.dispose();metallic.dispose();packed.dispose();normal.dispose();
});
test('material and portal copies retain one shader cache identity after repeated decoration',()=>{
 const a=stabilizeShadows(new MeshStandardMaterial()),key=a.customProgramCacheKey();
 for(let i=0;i<4;i++)stabilizeShadows(a);assert.equal(a.customProgramCacheKey(),key);
 const b=a.clone();b.onBeforeCompile=a.onBeforeCompile;b.customProgramCacheKey=a.customProgramCacheKey;stabilizeShadows(b);assert.equal(b.customProgramCacheKey(),key);a.dispose();b.dispose();
});
test('spotlight loop preserves Three lighting and one bounded uniform loop without ten copies',()=>{
 const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
 compileStableShadow(shader);compileStableShadow(shader);
 assert.equal(shader.uniforms.miningSpotCount.value,10);
 assert.equal((shader.fragmentShader.match(/i < miningSpotCount/g)||[]).length,1);
 assert.ok(shader.fragmentShader.includes('getSpotLightInfo( spotLight, geometryPosition, directLight )'));
 assert.equal((shader.fragmentShader.match(/uniform int miningSpotCount/g)||[]).length,1);
});
