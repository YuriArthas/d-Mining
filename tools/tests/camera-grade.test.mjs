import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, PerspectiveCamera, Vector4} from 'three';
import {CameraGrade} from '../../src/game/presentation/CameraGrade.ts';
import {CAMERA_LOOKS} from '../../src/game/content/cameraLook.ts';
function setup(){
 const scene=new Scene(),camera=new PerspectiveCamera(),grade=new CameraGrade(),calls=[];
 const renderer={
  width:1280,height:720,autoClear:true,scissorTest:true,viewport:new Vector4(0,0,1280,720),scissor:new Vector4(0,0,5,5),
  getRenderTarget:()=>null,
  getDrawingBufferSize(v){return v.set(this.width,this.height);},
  render(s){s.traverse(o=>{if(o.geometry){o.geometry.computeBoundingSphere();assert.ok(Number.isFinite(o.geometry.boundingSphere.radius));}});calls.push(s===scene?'scene':'grade');if(s!==scene&&this.fail)throw Error('draw failed');},
  copyFramebufferToTexture(t){calls.push('copy');this.texture=t;},
  getViewport(v){return v.copy(this.viewport);},setViewport(v){this.viewport.copy(v);},
  getScissor(v){return v.copy(this.scissor);},setScissor(v){this.scissor.copy(v);},
  getScissorTest(){return this.scissorTest;},setScissorTest(v){this.scissorTest=v;},
  compileAsync:async()=>{},
 };
 return {grade,renderer,calls,scene,camera,draw:on=>grade.draw(renderer,scene,camera,on,CAMERA_LOOKS.night)};
}
test('grade renders the world once, copies display pixels once, and bypasses all extra work when off',()=>{
 const c=setup();c.draw(false);assert.deepEqual(c.calls,['scene']);assert.equal(c.grade.diagnostics().allocations,0);
 c.calls.length=0;c.draw(true);assert.deepEqual(c.calls,['scene','copy','grade']);
 assert.equal(c.grade.diagnostics().estimatedColorBytes,1280*720*4);
 assert.equal(c.renderer.texture.generateMipmaps,false);assert.equal(c.renderer.texture.colorSpace,'');
 assert.equal(c.renderer.autoClear,true);assert.equal(c.renderer.scissorTest,true);
 c.draw(true);assert.equal(c.grade.diagnostics().allocations,1);
 c.grade.dispose();
});
test('resize frees the old buffer, error restores renderer state, disposal is idempotent',()=>{
 const c=setup();c.draw(true);let oldReleased=0;c.renderer.texture.addEventListener('dispose',()=>oldReleased++);
 c.renderer.width=800;c.renderer.height=450;c.draw(true);assert.equal(oldReleased,1);
 assert.equal(c.grade.diagnostics().estimatedColorBytes,800*450*4);
 c.renderer.fail=true;assert.throws(()=>c.draw(true),/draw failed/);
 assert.equal(c.renderer.autoClear,true);assert.equal(c.renderer.scissorTest,true);
 let released=0;c.renderer.texture.addEventListener('dispose',()=>released++);c.grade.dispose();c.grade.dispose();assert.equal(released,1);
 assert.throws(()=>c.draw(true),/disposed/);
});
test('cancelled prewarm cannot mark the output pass as ready',async()=>{
 const c=setup(),abort=new AbortController();c.renderer.compileAsync=async()=>abort.abort();
 await assert.rejects(c.grade.prepare(c.renderer,abort.signal),{name:'AbortError'});c.grade.dispose();
});
