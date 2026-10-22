// Offline authoring only. Runtime consumes packaged assets and plain descriptors.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { buildLandscape } from '../surface-game-art/tools/terrain/landscape.ts';
import { bakeShadows } from '../surface-game-art/tools/terrain/bakeShadows.mjs';
import { batchStatic } from '../surface-game-art/tools/terrain/kit.ts';
const require=createRequire(new URL('../surface-game-art/package.json',import.meta.url));
const {createCanvas,loadImage,ImageData,Image}=require('@napi-rs/canvas');
globalThis.self=globalThis;globalThis.ImageData=ImageData;globalThis.HTMLImageElement=Image;
globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.document={createElement(name){if(name!=='canvas')throw Error(name);const c=createCanvas(1,1);c.toBlob=async(callback,type)=>callback(new Blob([await c.encode(type==='image/jpeg'?'jpeg':'png')],{type}));return c;}};
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onloadend?.();});}};
const dir='surface-game-art/public/assets/pinewind';
const load=async file=>{const b=readFileSync(`${dir}/${file}`);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length), '')).scene;};
const nature=await load('nature.glb'),architecture=await load('architecture.glb');
const solid=root=>{
 root.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5),vertices=[],indices=[];
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,base=vertices.length/3;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).sub(center);vertices.push(...v.toArray().map(x=>+x.toFixed(6)));}if(o.geometry.index)for(const i of o.geometry.index.array)indices.push(base+i);else for(let i=0;i<p.count;i++)indices.push(base+i);});
 return {at:center.toArray(),half:[half.x,Math.max(.01,half.y),half.z],yaw:0,triangles:{vertices,indices}};
};
const built=buildLandscape(name=>{const node=nature.getObjectByName(name);if(!node)throw Error(name);return node.clone(true);});
const colliders=[];built.group.traverse(o=>{if(o.isMesh&&(o.userData.surfaceGround||/trunk/i.test(o.name)))colliders.push(solid(o));});
const shadow=bakeShadows(built.group,architecture,createCanvas);
const batched=batchStatic(built.group);batched.group.add(...built.water,shadow.group);
// GLTF PBR is the existing game's material contract. A matte response preserves the palette.
batched.group.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(m.isMeshLambertMaterial)o.material=new THREE.MeshStandardMaterial({color:m.color,map:m.map,vertexColors:m.vertexColors,roughness:1,metalness:0,side:m.side});});
const glb=await new GLTFExporter().parseAsync(batched.group,{binary:true,onlyVisible:true});
writeFileSync(`${dir}/landscape.glb`,Buffer.from(glb));
architecture.updateMatrixWorld(true);
const roots=architecture.children.map(node=>({node:node.name,at:node.position.toArray(),rotation:node.quaternion.toArray(),scale:node.scale.toArray()}));
for(const name of ['Creek_Bridge','Mine_Headframe']){const node=architecture.getObjectByName(name);if(!node)throw Error(name);colliders.push(solid(node));}
mkdirSync('src/game/content/pinewind',{recursive:true});
writeFileSync('src/game/content/pinewind/authored.json',JSON.stringify({version:1,roots,solids:colliders,landscape:batched.stats},null,0)+'\n');
writeFileSync('surface-game-art/artifacts/landscape-asset.json',JSON.stringify({source:'surface-study procedural landscape adapted to the square gameplay shaft',triangles:batched.stats.triangles,textureSizes:[512,64,64,64,shadow.textureSize],sha256:createHash('sha256').update(Buffer.from(glb)).digest('hex'),collisionParts:colliders.length},null,2));
console.log('Landscape:',batched.stats.triangles,'triangles;',colliders.length,'collision parts; architecture roots',roots.length);
