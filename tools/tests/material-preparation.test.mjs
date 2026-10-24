import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Texture} from 'three';
import {pruneInactiveMaps} from '../../src/game/presentation/MaterialPreparation.ts';

test('pruning keeps packed roughness and active normal channels, removes only zero multipliers',()=>{
 const packed=new Texture(),normal=new Texture(),m=new MeshStandardMaterial({metalness:0,metalnessMap:packed,roughnessMap:packed,normalMap:normal});
 assert.equal(pruneInactiveMaps(m),1);assert.equal(m.roughnessMap,packed);assert.equal(m.normalMap,normal);
 m.normalScale.set(0,0);m.aoMap=packed;m.aoMapIntensity=0;assert.equal(pruneInactiveMaps(m),2);
 assert.equal(m.normalMap,null);assert.equal(m.aoMap,null);assert.equal(m.roughnessMap,packed);
 const metallic=new MeshStandardMaterial({metalness:1,metalnessMap:packed});pruneInactiveMaps(metallic);assert.equal(metallic.metalnessMap,packed);
 m.dispose();metallic.dispose();packed.dispose();normal.dispose();
});
