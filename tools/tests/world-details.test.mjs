import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh} from 'three';
import {createWorldText} from '../../src/game/presentation/WorldText.ts';
import {createSelectionOutline} from '../../src/game/presentation/SelectionOutline.ts';
import {disposeScenery} from '../../src/game/presentation/disposeScenery.ts';
import {roomPlan,surfacePlan} from '../../src/game/world/scenery.ts';
import {ROOMS} from '../../src/game/world/rooms.ts';

test('all world signs are genuine extruded glyphs with fronts, backs and sides',()=>{
 for(const sign of [surfacePlan(),...ROOMS.map(roomPlan)].flatMap(p=>p.signs)){
  const group=createWorldText(sign);
  try{
   assert.ok(group.children.length>0);
   for(const mesh of group.children){assert.ok(mesh instanceof Mesh);assert.equal(mesh.geometry.type,'TextGeometry');const size=new Box3().setFromBufferAttribute(mesh.geometry.attributes.position);assert.ok(size.max.z-size.min.z>.05);assert.equal(mesh.material.length,2);assert.equal(mesh.geometry.groups.length,2);assert.equal(mesh.geometry.groups.reduce((n,g)=>n+g.count,0),mesh.geometry.index.count);assert.ok(mesh.material.every(m=>!m.map));}
  }finally{disposeScenery(group);}
 }
});
test('selection uses a thick black screen-space outline with depth testing',()=>{
 const outline=createSelectionOutline();
 try{assert.equal(outline.material.color.getHex(),0x101010);assert.equal(outline.material.linewidth,3);assert.equal(outline.material.worldUnits,false);assert.equal(outline.material.depthTest,true);assert.equal(outline.material.depthWrite,false);}
 finally{outline.geometry.dispose();outline.material.dispose();}
});
