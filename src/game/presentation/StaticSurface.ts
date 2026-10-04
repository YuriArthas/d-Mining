import { Box3, Group, Mesh, MeshStandardMaterial, Texture, CompressedTexture, RGBAFormat, RGBFormat, Vector3, type WebGLRenderer } from 'three';
import { fetchAssetParts } from '../assets/fetchAssetParts.ts';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { QUARRY_PLACEMENTS, type QuarryAsset } from '../world/QuarryLayout.ts';
import { surfacePlan } from '../world/SurfaceAssetPlan.ts';
import { createScenery, disposeScenery } from './SceneryMesh.ts';
import { stabilizeShadows } from './stableShadow.ts';
import { uploadSurfaceTexture } from './uploadSurfaceTexture.ts';
import { surfaceTextureMemory } from './surfaceTextureMemory.ts';
import { paintCampGround } from './campGround.ts';
const urls=import.meta.glob('../assets/camp/*.part',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const manifests=import.meta.glob('../assets/camp/*.manifest.json',{eager:true,import:'default'}) as Record<string,{parts:string[];bytes:number;taskId:string;source:string}>;

// New Tripo text-to-model assets. Generated topology is retained unchanged.
// Normalize models once; repeated scene instances share geometry and textures.
export async function loadStaticSurface(renderer:WebGLRenderer,signal:AbortSignal,onProgress?:(done:number,total:number)=>void):Promise<Group>{
 const start=performance.now(),group=new Group();group.name='camp-tripo-v2';
 const names=[...new Set(QUARRY_PLACEMENTS.map(p=>p.asset))],templates=new Map<QuarryAsset,Group>(),stats:Record<string,unknown>[]=[];
 const ktx=new KTX2Loader().setWorkerLimit(1).detectSupport(renderer);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
 const textures=new Set<Texture>();
 const cleanup=()=>{const abandoned=new Group();abandoned.add(group,...templates.values());disposeScenery(abandoned);templates.clear();};
 try {
  // Keep just one model decoder and one texture transcoder active. All scenery
  // remains resident after loading; only the temporary loading work is bounded.
  for(const name of names){
   signal.throwIfAborted();
   const manifest=manifests[`../assets/camp/${name}.manifest.json`];if(!manifest)throw new Error(`缺少矿场模型: ${name}`);
   const parts=manifest.parts.map(part=>{const url=urls[`../assets/camp/${part}`];if(!url)throw new Error(`缺少模型资源块: ${part}`);return url;});
   const began=performance.now(),body=fetchAssetParts(parts,signal);
   let bytes=0;
   const counted=body.pipeThrough(new TransformStream({transform(chunk,controller){bytes+=chunk.byteLength;controller.enqueue(chunk);}}));
   const buffer=await new Response(counted.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),downloadMs=performance.now()-began;
   if(bytes!==manifest.bytes)throw new Error(`模型资源长度不匹配: ${name}`);
   signal.throwIfAborted();
   const decodeStart=performance.now(),gltf=await loader.parseAsync(buffer,''),root=new Group();
   templates.set(name,root);
   gltf.scene.rotation.y=-Math.PI/2;root.add(gltf.scene);root.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(root),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
   gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);
   root.userData.width=size.x;root.userData.height=size.y;root.userData.depth=size.z;let triangles=0;const pendingTextures=new Set<Texture>();
   root.traverse(o=>{
    if(!(o instanceof Mesh))return;
    o.castShadow=true;o.receiveShadow=true;
    for(const m of (Array.isArray(o.material)?o.material:[o.material]) as MeshStandardMaterial[]){
     // Tripo's ORM is retained. Bound specular response for painted wood/stone;
     // generated metal masks must not turn limestone and foliage into metal.
     m.metalness=0;m.roughness=Math.max(m.roughness,.9);m.envMapIntensity=.45;
     stabilizeShadows(m);
     for(const v of Object.values(m))if(v instanceof Texture){
      if(!(v instanceof CompressedTexture)||Number(v.format)===RGBAFormat||Number(v.format)===RGBFormat)throw new Error('当前显卡未使用 GPU 压缩纹理，停止加载以避免内存耗尽');
      v.anisotropy=8;if(!textures.has(v))pendingTextures.add(v);textures.add(v);
     }
    }
    triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
   });
   for(const texture of pendingTextures)await uploadSurfaceTexture(renderer,texture,signal);
   signal.throwIfAborted();onProgress?.(templates.size,names.length);stats.push({name,taskId:manifest.taskId,source:manifest.source,bytes,triangles,downloadMs,decodeMs:performance.now()-decodeStart,normalizedFront:'+Z',originalSize:size.toArray(),instances:QUARRY_PLACEMENTS.filter(p=>p.asset===name).length});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 } catch(error){cleanup();throw error;}
 finally{ktx.dispose();}
 if(signal.aborted){cleanup();signal.throwIfAborted();}
 const groundMaterials=new Set<MeshStandardMaterial>();
 try { for(const p of QUARRY_PLACEMENTS){
  const source=templates.get(p.asset)!,instance=source.clone(true),scale=p.width/source.userData.width;
  instance.name=`${p.asset}@${p.x},${p.z}`;
  instance.scale.set(scale,p.height===undefined?scale:p.height/source.userData.height,p.depth===undefined?scale:p.depth/source.userData.depth);
  instance.rotation.y=p.yaw??0;instance.position.set(p.x,p.y??-.08,p.z);
  if(p.asset==='meadow-base'||p.asset==='terrain-slab')instance.traverse(o=>{
   if(!(o instanceof Mesh))return;
   o.castShadow=false;o.userData.surfaceGround=true;
   for(const m of (Array.isArray(o.material)?o.material:[o.material]) as MeshStandardMaterial[]){
    if(groundMaterials.has(m))continue;
    groundMaterials.add(m);
    const compile=m.onBeforeCompile;
    m.onBeforeCompile=(shader,renderer)=>{
     compile.call(m,shader,renderer);
     shader.vertexShader='varying vec3 campWorld;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncampWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
     shader.fragmentShader='varying vec3 campWorld;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(abs(campWorld.x)<8.0 && abs(campWorld.z)<8.0)discard;');
    };
    m.customProgramCacheKey=()=> 'camp-tripo-ground-shaft-v2';
    if(p.asset==='meadow-base')paintCampGround(m);
   }
   // Mirror the shader's shaft cut in diagnostic raycasts; no mesh is created.
   const raycast=o.raycast;
   o.raycast=function(ray,hits){const collected:typeof hits=[];raycast.call(this,ray,collected);hits.push(...collected.filter(h=>Math.abs(h.point.x)>=8||Math.abs(h.point.z)>=8));};
  });
  group.add(instance);
 }
 } catch(error){cleanup();throw error;}
 group.add(createScenery(surfacePlan()));
 group.userData.surfaceShading={version:'camp-tripo-v2',asset:'new-tripo-components',generator:'Tripo v3.1 new text/image tasks',assets:stats,instances:QUARRY_PLACEMENTS.length,bytes:stats.reduce((n,s)=>n+Number(s.bytes),0),prepareMs:performance.now()-start,runtimeOcclusionProbes:0,compression:'KTX2 UASTC + Meshopt + gzip',textureMemory:surfaceTextureMemory(textures),maxConcurrentModelDecodes:1,maxTextureWorkers:1,distanceUnloading:false};
 return group;
}
