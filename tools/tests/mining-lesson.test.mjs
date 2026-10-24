import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { MiningLessonHighlight } from '../../src/game/presentation/MiningLessonHighlight.ts';
import { selectCell } from '../../src/game/terrain/selection.ts';
import { ORE_ITEMS } from '../../src/game/application/items.ts';
test('lesson proactively highlights a visible, reachable, unlocked real block and hides when disabled',()=>{
 const camera=new PerspectiveCamera(55,1.6,.08,100);camera.position.set(0,6,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const feet=[0,0,5],element={style:{},dataset:{},querySelector:()=>({textContent:''})};
 const terrain={cell:([x,y,z])=>y===-1&&Math.abs(x)<=2&&Math.abs(z)<=2?64:0,canMine(c){return this.cell(c)>0;}};
 const lesson=new MiningLessonHighlight();
 try {
  lesson.update(camera,feet,null,terrain,1,element,true);
  assert.ok(lesson.cell);assert.equal(lesson.group.visible,true);assert.equal(element.dataset.hasTarget,'true');
  const center=new Vector3(...lesson.anchor);
  assert.deepEqual(selectCell(camera.position.toArray(),center.sub(camera.position).normalize().toArray(),[0,1,5],c=>terrain.cell(c)),lesson.cell);
  lesson.update(camera,feet,null,terrain,1,element,false);assert.equal(lesson.group.visible,false);assert.equal(lesson.cell,null);
 } finally {lesson.dispose();}
});
test('lesson never highlights protected, locked, or missing blocks',()=>{
 const camera=new PerspectiveCamera(55,1.6,.08,100);camera.position.set(0,6,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const locked=ORE_ITEMS.find(r=>(r.requiredLevel??0)>1).kind;
 for(const kind of [0,7,locked]) {
  const lesson=new MiningLessonHighlight(),terrain={cell:([,y])=>y===-1?kind:0,canMine(c){return this.cell(c)>0&&kind!==7;}};
  try {lesson.update(camera,[0,0,5],null,terrain,1,{style:{},dataset:{},querySelector:()=>({})},true);assert.equal(lesson.cell,null);assert.equal(lesson.group.visible,false);}finally{lesson.dispose();}
 }
});
