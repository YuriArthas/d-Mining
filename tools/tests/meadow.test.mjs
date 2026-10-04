import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { createMeadowGround } from '../../src/game/presentation/MeadowGround.ts';
import { createSurfaceNoise } from '../../src/game/presentation/SurfaceMaterial.ts';
import { cutRockGeometry } from '../../src/game/presentation/surfaceGeometry.ts';

test('persistent scenery ground never covers the shaft, including its edges after excavation',()=>{
 const noise=createSurfaceNoise(),scene=createMeadowGround(noise),floor=scene.children[0];
 scene.updateMatrixWorld(true);
 const hits=(x,z)=>new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(floor).length;
 try{
  for(const x of [-7.999,-4,0,4,7.999])for(const z of [-7.999,-4,0,4,7.999])assert.equal(hits(x,z),0);
  for(const [x,z] of [[8.001,0],[-8.001,0],[0,8.001],[0,-8.001],[150,100],[-150,-100]])assert.ok(hits(x,z)>0);
 }finally{scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});noise.dispose()}
});
test('rounded boulders have continuous outward normals without an angular seam',()=>{
 const g=cutRockGeometry(),p=g.getAttribute('position'),n=g.getAttribute('normal');
 try{
  for(let i=0;i<p.count;i++){
   const y=p.getY(i);if(y<.2||y>.8)continue;
   const radial=new Vector3(p.getX(i)-.05,0,p.getZ(i)-.02).normalize();
   const normal=new Vector3(n.getX(i),n.getY(i),n.getZ(i));assert.ok(normal.dot(radial)>.45);
  }
 }finally{g.dispose()}
});
