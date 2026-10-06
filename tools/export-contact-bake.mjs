import {geometryHash} from './lib/glbBuffers.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Box3,Group,Mesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {QUARRY_PLACEMENTS} from '../src/game/world/QuarryLayout.ts';
const out='assets-source/quarry-v2/contact-bake';mkdirSync(out,{recursive:true});
const treeAssets=new Set(['crown-tree','oak-wide','oak-tall','maple-gold','maple-coral','birch-round','cedar-pillow','willow-dome']);
const trees=QUARRY_PLACEMENTS.filter(p=>treeAssets.has(p.asset)&&(p.y??-.08)<.1&&Math.abs(p.x)<43&&p.z>-20&&p.z<64).sort((a,b)=>Math.hypot(a.x,a.z-32)-Math.hypot(b.x,b.z-32)).slice(0,6);
const selected=QUARRY_PLACEMENTS.filter(p=>(p.asset.startsWith('grid-mine-')&&Math.abs(p.x)===10&&Math.abs(p.z)===10&&(p.y??0)<3)||p.asset==='simulator-exchange'||p.asset==='simulator-upgrade'||trees.includes(p));
const templates=new Map(),sources=[];const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for(const name of new Set(selected.map(p=>p.asset))){
 const m=JSON.parse(readFileSync(`src/game/assets/camp/${name}.manifest.json`));
 const binary=gunzipSync(Buffer.concat(m.parts.map(p=>readFileSync(`src/game/assets/camp/${p}`))));
 const jsonLength=binary.readUInt32LE(12),doc=JSON.parse(binary.subarray(20,20+jsonLength));
 // Geometry-only decode, keeping the exact shipped Meshopt data and node transforms.
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=doc.materials?.map(()=>({doubleSided:true}));
 const json=Buffer.from(JSON.stringify(doc));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const bin=binary.subarray(20+jsonLength);const glb=Buffer.alloc(20+padded.length+bin.length);
 glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);bin.copy(glb,20+padded.length);
 const gltf=await loader.parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 const root=new Group();gltf.scene.rotation.y=-Math.PI/2;root.add(gltf.scene);root.updateMatrixWorld(true);
 const box=new Box3().setFromObject(root),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
 gltf.scene.position.set(-center.x,-box.min.y,-center.z);root.userData.size=size.toArray();templates.set(name,root);
 sources.push({asset:name,geometrySha256:geometryHash(binary),transportSha256:m.sha256,taskId:m.taskId??null,source:m.source});
}
const objects=[];
for(const p of selected){
 const root=templates.get(p.asset).clone(true),[w,h,d]=root.userData.size,k=p.width/w;
 root.scale.set(k,p.height===undefined?k:p.height/h,p.depth===undefined?k:p.depth/d);root.rotation.y=p.yaw??0;root.position.set(p.x,p.y??-.08,p.z);root.updateMatrixWorld(true);
 const vertices=[],faces=[],v=new Vector3();
 root.traverse(mesh=>{if(!(mesh instanceof Mesh))return;const geometry=mesh.geometry,position=geometry.attributes.position,offset=vertices.length/3;
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);vertices.push(v.x,-v.z,v.y);}
  const ids=geometry.index?Array.from(geometry.index.array):Array.from({length:position.count},(_,i)=>i);
  for(let i=0;i<ids.length;i+=3)faces.push([offset+ids[i],offset+ids[i+1],offset+ids[i+2]]);
 });objects.push({name:`${p.asset}@${p.x},${p.z},${p.y??-.08}`,placement:p,vertices,faces});
}
const body=JSON.stringify({bounds:{minX:-48,maxX:48,minZ:-24,maxZ:68},floorY:.023,size:512,distance:2.5,objects,sources});
writeFileSync(`${out}/geometry.json`,body);writeFileSync(`${out}/selection.json`,JSON.stringify({selected,sources,geometrySha256:createHash('sha256').update(body).digest('hex')},null,2));
console.log(`Exported ${objects.length} pieces / ${trees.length} trees; ${objects.reduce((n,o)=>n+o.faces.length,0)} triangles`);
