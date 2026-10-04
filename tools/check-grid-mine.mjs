// Inspect generated geometry without decoding textures or starting a local game.
import {readFileSync,writeFileSync} from 'node:fs';
import {Box3,Vector3,Group,Raycaster,DoubleSide} from 'three';
import {ThirdPersonCamera} from '../src/game/ThirdPersonCamera.ts';
import {MINE_PAVILION_SOLIDS,MINE_PAVILION_PLACEMENTS} from '../src/game/world/MinePavilion.ts';
import {RAPIER,initPhysics} from '../src/game/validation/physics.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const output='artifacts/grid-mine';
const root=new Group();
for(const asset of [...new Set(MINE_PAVILION_PLACEMENTS.map(p=>p.asset))]){
const source=readFileSync(`assets-source/quarry-v2/${asset}/model.glb`);
const n=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+n));
for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
delete doc.materials;delete doc.textures;delete doc.images;
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=source.subarray(20+n);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const data=Buffer.concat([header,padded,bin]);const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const template=new Group();gltf.scene.rotation.y=-Math.PI/2;template.add(gltf.scene);template.updateMatrixWorld(true);
const bounds=new Box3().setFromObject(template),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);
for(const p of MINE_PAVILION_PLACEMENTS.filter(p=>p.asset===asset)){
 const instance=template.clone(true);instance.scale.set(p.width/size.x,p.height/size.y,p.depth/size.z);instance.position.set(p.x,p.y,p.z);root.add(instance);
}
}
root.updateMatrixWorld(true);
root.traverse(o=>{if(o.isMesh)o.material.side=DoubleSide});
const ray=new Raycaster(),blocked=[];
for(let x=-7.99;x<=8;x+=.5)for(let z=-7.99;z<=8;z+=.5){ray.set(new Vector3(x,6,z),new Vector3(0,-1,0));if(ray.intersectObject(root,true).length)blocked.push([x,z]);}
let covered=0,minCeiling=Infinity;
for(let x=-7.99;x<=8;x+=.5)for(let z=-7.99;z<=8;z+=.5){ray.set(new Vector3(x,1,z),new Vector3(0,1,0));const hits=ray.intersectObject(root,true);if(hits.length){covered++;minCeiling=Math.min(minCeiling,hits[0].point.y);}}
const entrances=[];
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const d=new Vector3(Math.sin(yaw),0,Math.cos(yaw));ray.set(d.clone().multiplyScalar(18).setY(1),d.clone().negate());const hits=ray.intersectObject(root,true);entrances.push({yaw,distance:hits[0]?.distance});}
const roofProfile=[-12,-10,-8,-6,0,6,8,10,12].map(x=>{ray.set(new Vector3(x,2,0),new Vector3(0,1,0));return [x,ray.intersectObject(root,true)[0]?.point.y]});
const columns=[-11,0,11].map(z=>{ray.set(new Vector3(0,3,z),new Vector3(1,0,0));return [z,ray.intersectObject(root,true)[0]?.point.toArray()]});
const crossBeams=[-12,-11,-10,-8,0,8,10,11,12].map(z=>{ray.set(new Vector3(0,2,z),new Vector3(0,1,0));return [z,ray.intersectObject(root,true)[0]?.point.y]});
await initPhysics();const world=new RAPIER.World({x:0,y:0,z:0}),cameraFailures=[];let cameraSamples=0;
try{
 for(const s of MINE_PAVILION_SOLIDS){const desc=s.hull?RAPIER.ColliderDesc.convexHull(new Float32Array(s.hull)):RAPIER.ColliderDesc.cuboid(...s.half);world.createCollider(desc.setTranslation(...s.at));}
 const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.35));world.step();
 for(const x of [-7,0,7])for(const z of [-7,0,7,11,14])for(const pitch of [.2,.8,1.3])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/4){
  const camera=new ThirdPersonCamera();camera.update(world,player,[x,0,z],yaw,pitch,1/60,16/9);cameraSamples++;
  const delta=camera.position.clone().sub(camera.target);ray.set(camera.target,delta.clone().normalize());ray.far=delta.length();
  const hit=ray.intersectObject(root,true)[0];if(hit)cameraFailures.push({x,z,yaw,pitch,hit:hit.point.toArray(),camera:camera.position.toArray()});
 }
}finally{world.free();}
const report={cameraSamples,cameraFailures,width:26,depth:26,roofProfile,columns,crossBeams,roofSamples:covered,minCeiling,blockedSamples:blocked.length,firstBlocked:blocked.slice(0,12),entrances};console.log(JSON.stringify(report,null,2));writeFileSync(`${output}/geometry-clearance.json`,JSON.stringify(report,null,2));
if(cameraFailures.length||blocked.length||covered!==1024||minCeiling<6)process.exitCode=1;
