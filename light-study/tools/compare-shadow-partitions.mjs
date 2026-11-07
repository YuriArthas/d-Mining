// Offline geometry submission estimate; not a GPU timing or visual test.
import fs from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const data=fs.readFileSync(resolve(import.meta.dirname,'../public/assets/street.glb'));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const tris=[];const v=new THREE.Vector3();gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse(o=>{if(!o.isMesh||o.material.name==='lampglass')return;const p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<(ix?.count??p.count);i+=3){const vs=[];for(let j=0;j<3;j++)vs.push(v.fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(o.matrixWorld).clone());tris.push(vs);}});
const results=[];
for(const axes of ['xyz','xz'])for(const size of [6,8,10,12]){
 const cells=new Map();for(const vs of tris){const c=vs.reduce((s,v)=>s.add(v),new THREE.Vector3()).divideScalar(3);const key=[c.x,...(axes==='xyz'?[c.y]:[]),c.z].map(n=>Math.floor(n/size)).join('/');const b=cells.get(key)??{box:new THREE.Box3(),triangles:0};vs.forEach(v=>b.box.expandByPoint(v));b.triangles++;cells.set(key,b);}
 const spheres=[...cells.values()].map(b=>({...b,sphere:b.box.getBoundingSphere(new THREE.Sphere())}));
 const counts=[];for(const z of [7,-3,-13]){const cam=new THREE.PerspectiveCamera(90,1,.08,9);cam.coordinateSystem=THREE.WebGPUCoordinateSystem;cam.updateProjectionMatrix();cam.position.set(.65,1.12,z);let draws=0,triangles=0;
 for(const [x,y,z] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){cam.up.set(0,y?0:1,y?1:0);cam.lookAt(cam.position.clone().add(new THREE.Vector3(x,y,z)));cam.updateMatrixWorld(true);const fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),THREE.WebGPUCoordinateSystem);for(const b of spheres)if(fr.intersectsBox(b.box)){draws++;triangles+=b.triangles;}}
 counts.push({draws,triangles});}
 results.push({axes,size,cells:cells.size,counts});
}
console.log(JSON.stringify(results,null,2));
