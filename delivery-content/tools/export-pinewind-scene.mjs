// Offline authoring only. Runtime consumes packaged assets and plain descriptors.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { buildLandscape } from '../surface-game-art/tools/terrain/landscape.ts';
import { bakeLight, LIGHT_BAKE, OCCLUDER } from '../surface-game-art/tools/terrain/bakeLight.mjs';
import { batchStatic } from '../surface-game-art/tools/terrain/kit.ts';
const require=createRequire(new URL('../surface-game-art/package.json',import.meta.url));
const {createCanvas,loadImage,ImageData,Image}=require('@napi-rs/canvas');
const {NodeIO,TextureInfo}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
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
// Cliff columns collide as their own convex hulls (world-space points from the landscape builder).
const hullSolid=points=>{const bounds=new THREE.Box3().setFromPoints(points.map(p=>new THREE.Vector3(...p))),center=bounds.getCenter(new THREE.Vector3()),half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
 return {at:center.toArray(),half:half.toArray(),yaw:0,hull:points.flatMap(p=>[p[0]-center.x,p[1]-center.y,p[2]-center.z].map(v=>+v.toFixed(4)))};};
// The ground is marked as such (the collider view leaves it out); trunks and cliff columns are not.
const colliders=[];built.group.traverse(o=>{if(!o.isMesh)return;if(o.userData.hull)colliders.push(hullSolid(o.userData.hull));else if(o.userData.surfaceGround)colliders.push({...solid(o),ground:true});else if(/trunk/i.test(o.name))colliders.push(solid(o));});

// Light bake casters: every static model except the distant mountains (far beyond any shadow) and the two
// gate doors (they swing open, so they must not leave a door-shaped shadow behind). The open meadow and
// paths only occlude at contact; creek banks and turf lips occlude like any solid.
const casters=[],groundMeshes=[];
built.group.updateMatrixWorld(true);architecture.updateMatrixWorld(true);
// The distant ridges get their own material so their batches stay apart from the baked props.
let ridgeMaterial=null;
built.group.traverse(o=>{if(o.isMesh&&o.name==='Angular distant mountain ridge'){ridgeMaterial??=Object.assign(o.material.clone(),{name:'Distant ridge (unbaked)'});o.material=ridgeMaterial;}});
built.group.traverse(o=>{
 if(!o.isMesh||o.material===ridgeMaterial)return;
 if(o.userData.surfaceGround)groundMeshes.push(o);
 casters.push({mesh:o,kind:/Flowing meadow|Inset polygon/.test(o.name)?OCCLUDER.floor:OCCLUDER.solid});
});
const architectureMeshes=[];
architecture.traverse(o=>{if(!o.isMesh)return;architectureMeshes.push(o);for(let p=o;p;p=p.parent)if(p.name.startsWith('World_Gate_Door'))return;casters.push({mesh:o,kind:OCCLUDER.solid});});

const batched=batchStatic(built.group);batched.group.add(...built.water);
const vertexMeshes=batched.group.children.filter(o=>o.isMesh&&!o.userData.surfaceGround&&!o.userData.keepDynamic&&o.material!==ridgeMaterial);
const baked=await bakeLight({casters,ground:groundMeshes,lightmap:architectureMeshes,vertex:vertexMeshes});

// Ground and creek water read the top-down bake through a planar second UV set.
const G=LIGHT_BAKE.ground;
const groundLight=new THREE.DataTexture(baked.groundImage,G.resolution,G.resolution);
groundLight.name='Pinewind baked ground light';groundLight.channel=1;groundLight.flipY=false;
groundLight.magFilter=THREE.LinearFilter;groundLight.minFilter=THREE.LinearMipmapLinearFilter;groundLight.generateMipmaps=true;groundLight.needsUpdate=true;
const planar=g=>{const p=g.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-G.x0)/G.size;uv[i*2+1]=(p.getZ(i)-G.z0)/G.size;}g.setAttribute('uv1',new THREE.BufferAttribute(uv,2));};
// GLTF PBR is the existing game's material contract. A matte response preserves the palette; one converted
// material per source material.
const converted=new Map();
const convert=(m,bake)=>{
 const key=m.uuid+':'+bake;if(converted.has(key))return converted.get(key);
 const out=m.isMeshLambertMaterial?new THREE.MeshStandardMaterial({color:m.color,map:m.map,vertexColors:m.vertexColors,roughness:1,metalness:0,side:m.side}):m.clone();
 out.name=m.name;
 if(bake==='map'){out.aoMap=groundLight;out.aoMapIntensity=1;}
 if(bake==='vertex')out.userData.bakedLight='vertex';
 converted.set(key,out);return out;
};
let neutralVertices=0;
batched.group.traverse(o=>{
 if(!o.isMesh)return;
 if(o.userData.surfaceGround||o.userData.keepDynamic){planar(o.geometry);o.material=convert(o.material,'map');return;}
 const bake=baked.vertexBakes.get(o);
 // The distant mountains share the props' material; they stay fully lit and open to the sky.
 const values=bake??new Uint8Array(o.geometry.attributes.position.count*4).fill(255);
 if(!bake)neutralVertices+=o.geometry.attributes.position.count;
 o.geometry.setAttribute('bake',new THREE.BufferAttribute(values,4,true));
 o.material=convert(o.material,'vertex');
});
const glb=await new GLTFExporter().parseAsync(batched.group,{binary:true,onlyVisible:true});
writeFileSync(`${dir}/landscape.glb`,Buffer.from(glb));

// Buildings: the lightmap goes into a copy of the Blender export as the occlusion texture on TEXCOORD_1.
const encodePng=async(image,size)=>{const canvas=createCanvas(size,size);const data=canvas.getContext('2d').createImageData(size,size);data.data.set(image);canvas.getContext('2d').putImageData(data,0,0);return canvas.encode('png');};
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(`${dir}/architecture.glb`);
// The game reads the models' collision from authored.json, not from the shipped art.
for(const node of doc.getRoot().listNodes()){const {collision,...extras}=node.getExtras();node.setExtras(extras);}
const lightPng=await encodePng(baked.lightImage,LIGHT_BAKE.lightmapSize);
const lightTexture=doc.createTexture('Pinewind baked building light').setImage(lightPng).setMimeType('image/png');
for(const material of doc.getRoot().listMaterials()){
 material.setOcclusionTexture(lightTexture);
 material.getOcclusionTextureInfo().setTexCoord(1).setMagFilter(TextureInfo.MagFilter.LINEAR).setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR).setWrapS(TextureInfo.WrapMode.CLAMP_TO_EDGE).setWrapT(TextureInfo.WrapMode.CLAMP_TO_EDGE);
}
await io.write(`${dir}/architecture-lit.glb`,doc);
mkdirSync('surface-game-art/artifacts/light-bake',{recursive:true});
writeFileSync('surface-game-art/artifacts/light-bake/ground-light.png',await encodePng(baked.groundImage,G.resolution));
// Characters read this small map on the CPU (sun visibility above the floor, floor height).
const standingPng=await encodePng(baked.standingImage,LIGHT_BAKE.standing.resolution);
writeFileSync('src/game/assets/scene/pinewind-standing-light.png',standingPng);
writeFileSync('surface-game-art/artifacts/light-bake/building-light.png',lightPng);

// Each model with the collision its Blender function gave it (collision.py), in its own frame: the game places
// it with the model (pinewindSurface.ts). A model colliding with its own triangles carries them.
const ownTriangles=root=>{
 const toRoot=root.matrixWorld.clone().invert(),vertices=[],indices=[];
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,base=vertices.length/3,m=toRoot.clone().multiply(o.matrixWorld);
  for(let i=0;i<p.count;i++)vertices.push(...new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m).toArray().map(x=>+x.toFixed(6)));
  if(o.geometry.index)for(const i of o.geometry.index.array)indices.push(base+i);else for(let i=0;i<p.count;i++)indices.push(base+i);});
 const bounds=new THREE.Box3();for(let i=0;i<vertices.length;i+=3)bounds.expandByPoint(new THREE.Vector3(vertices[i],vertices[i+1],vertices[i+2]));
 const c=bounds.getCenter(new THREE.Vector3()),half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
 return {at:c.toArray(),half:[half.x,Math.max(.01,half.y),half.z],yaw:0,triangles:{vertices:vertices.map((v,i)=>+(v-c.getComponent(i%3)).toFixed(6)),indices}};
};
const roots=architecture.children.map(node=>{
 if(typeof node.userData.collision!=='string')throw Error(`${node.name}: no collision (rebuild build_architecture.py)`);
 const {solids=[],mesh,passable}=JSON.parse(node.userData.collision);
 return {node:node.name,at:node.position.toArray(),rotation:node.quaternion.toArray(),scale:node.scale.toArray(),collision:passable?{passable}:{solids:[...solids,...mesh?[ownTriangles(node)]:[]]}};
});
const light={version:LIGHT_BAKE.version,sun:LIGHT_BAKE.sun,sunRadiusDeg:LIGHT_BAKE.sunRadiusDeg,aoRadius:LIGHT_BAKE.aoRadius,ground:G,lightmapSize:LIGHT_BAKE.lightmapSize,standing:{...LIGHT_BAKE.standing,sha256:createHash('sha256').update(standingPng).digest('hex')}};
mkdirSync('src/game/content/pinewind',{recursive:true});
writeFileSync('src/game/content/pinewind/authored.json',JSON.stringify({version:1,roots,solids:colliders,landscape:batched.stats,light},null,0)+'\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
writeFileSync('surface-game-art/artifacts/landscape-asset.json',JSON.stringify({source:'surface-study procedural landscape adapted to the square gameplay shaft',triangles:batched.stats.triangles,textureSizes:[512,64,64,64,G.resolution],sha256:sha(Buffer.from(glb)),collisionParts:colliders.length},null,2));
writeFileSync('surface-game-art/artifacts/light-bake.json',JSON.stringify({...light,generator:'surface-game-art/tools/terrain/bakeLight.mjs (BVH ray tracing, Node worker threads)',samples:{sun:LIGHT_BAKE.sunSamples,sky:LIGHT_BAKE.aoSamples},floorContact:LIGHT_BAKE.floorContact,stats:baked.stats,neutralVertices,
 textures:{ground:{size:[G.resolution,G.resolution],channels:'R sky occlusion, G sun visibility',sha256:sha(baked.groundImage)},building:{size:[LIGHT_BAKE.lightmapSize,LIGHT_BAKE.lightmapSize],uv:'TEXCOORD_1 (Blender Lightmap layer)',channels:'R sky occlusion, G sun visibility',pngSha256:sha(lightPng)}},
 outputs:{landscape:sha(Buffer.from(glb)),architectureLit:sha(readFileSync(`${dir}/architecture-lit.glb`))}},null,2)+'\n');
console.log('Landscape:',batched.stats.triangles,'triangles;',colliders.length,'collision parts; architecture roots',roots.length);
