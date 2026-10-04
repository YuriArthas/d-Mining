// Inspect generated geometry without decoding textures or starting a local game.
import {readFileSync,writeFileSync} from 'node:fs';
import {Box3,Vector3,Group,Raycaster,DoubleSide} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const source=readFileSync('assets-source/quarry-v2/shaft-kiln-frame/model.glb');
const n=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+n));
for(const mesh of doc.meshes)for(const p of mesh.primitives)delete p.material;
delete doc.materials;delete doc.textures;delete doc.images;
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=source.subarray(20+n);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const data=Buffer.concat([header,padded,bin]);const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const root=new Group();gltf.scene.rotation.y=-Math.PI/2;root.add(gltf.scene);root.updateMatrixWorld(true);
const bounds=new Box3().setFromObject(root),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);
const width=Number(process.env.FRAME_WIDTH??24),depth=Number(process.env.FRAME_DEPTH??24);
root.scale.set(width/size.x,9/size.y,depth/size.z);root.updateMatrixWorld(true);
root.traverse(o=>{if(o.isMesh)o.material.side=DoubleSide});
const ray=new Raycaster(),blocked=[];
for(let x=-7.99;x<=8;x+=.5)for(let z=-7.99;z<=8;z+=.5){ray.set(new Vector3(x,20,z),new Vector3(0,-1,0));if(ray.intersectObject(root,true).length)blocked.push([x,z]);}
const entrances=[];
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const d=new Vector3(Math.sin(yaw),0,Math.cos(yaw));ray.set(d.clone().multiplyScalar(18).setY(1),d.clone().negate());const hits=ray.intersectObject(root,true);entrances.push({yaw,distance:hits[0]?.distance});}
const report={width,depth,sourceSize:size.toArray(),blockedSamples:blocked.length,firstBlocked:blocked.slice(0,12),entrances};console.log(JSON.stringify(report,null,2));writeFileSync('artifacts/shaft-enclosure/geometry-clearance.json',JSON.stringify(report,null,2));
if(blocked.length)process.exitCode=1;
