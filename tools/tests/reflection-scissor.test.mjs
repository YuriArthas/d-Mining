import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,PlaneGeometry,PerspectiveCamera,Vector3} from 'three';
import {reflectionScissor} from '../../src/game/presentation/reflectionScissor.ts';
function setup(){const mesh=new Mesh(new PlaneGeometry(4,4));mesh.rotation.x=-Math.PI/2;mesh.updateMatrixWorld(true);const camera=new PerspectiveCamera(60,16/9,.1,100);camera.position.set(0,8,12);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);return {mesh,camera};}
test('reflection rectangle covers all water samples plus ripple margin without lowering resolution',()=>{
 const {mesh,camera}=setup(),rect=reflectionScissor([mesh],camera,1024,576);
 assert.ok(rect.z*rect.w<1024*576*.2);
 for(let x=-2;x<=2;x+=.2)for(let z=-2;z<=2;z+=.2){const p=new Vector3(x,0,z).project(camera);const px=(p.x*.5+.5)*1024,py=(p.y*.5+.5)*576;assert.ok(px>=rect.x+2&&px<=rect.x+rect.z-2);assert.ok(py>=rect.y+2&&py<=rect.y+rect.w-2);}
});
test('water intersecting camera near plane gets a complete safe capture',()=>{
 const {mesh,camera}=setup();camera.position.set(0,.01,0);camera.lookAt(0,0,-5);camera.updateMatrixWorld(true);
 assert.deepEqual(reflectionScissor([mesh],camera,1024,576).toArray(),[0,0,1024,576]);
});
