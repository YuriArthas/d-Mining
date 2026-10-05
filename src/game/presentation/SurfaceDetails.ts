import {BufferGeometry,Color,DataTexture,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,LinearFilter,LinearMipmapLinearFilter,MeshStandardMaterial,NearestFilter,NoColorSpace,Object3D,RedFormat,UnsignedByteType} from 'three';
import {WallTorchView} from './WallTorchView.ts';
import contactData from '../assets/ground-details/contact-shadow.json' with {type:'json'};
import atlasData from '../assets/ground-details/ground-atlas.json' with {type:'json'};
import postMask from '../assets/ground-details/lantern-post-emission.json' with {type:'json'};
import boxMask from '../assets/ground-details/pit-box-lantern-emission.json' with {type:'json'};
import grassData from '../assets/ground-details/grass.json' with {type:'json'};
import curbData from '../assets/ground-details/curb.json' with {type:'json'};
import {CURB,CURB_BLOCKS,CURB_SOLIDS} from '../world/SurfaceRoads.ts';
import {planGrass} from '../world/GrassLayout.ts';
import type {SurfaceTime} from '../world/SceneLighting.ts';
import {stabilizeShadows} from './stableShadow.ts';
import {createSurfacePonds} from './SurfacePondsView.ts';
function texture(data:{size:number;data:string},pixel=false){
 const raw=atob(data.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const t=new DataTexture(bytes,data.size,data.size,RedFormat,UnsignedByteType);
 t.colorSpace=NoColorSpace;t.magFilter=pixel?NearestFilter:LinearFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.flipY=false;t.needsUpdate=true;return t;
}
export class SurfaceDetails {
 readonly wallTorches=new WallTorchView();
 readonly bakedContact={texture:texture(contactData),strength:{value:.65},bounds:contactData.bounds,floorY:contactData.floorY};
 readonly night={value:1};readonly wind={value:0};readonly atlas=texture(atlasData,true);
 private readonly masks={post:texture(postMask),box:texture(boxMask)};
 private readonly lampMaterials:MeshStandardMaterial[]=[];
 private time:SurfaceTime='night';
 readonly stats={version:'pixel-meadow-v1',atlasSize:128,maskSize:128,detailTextureBytes:3*128*128*4/3,grassInstances:0,grassTriangles:0,grassBatches:0,grassBufferBytes:0,grassDrawCalls:0,grassDrawnTriangles:0,grassDrawnInstances:0,grassCastsShadow:false,grassHasCollision:false,distanceUnloading:false};
 constructor(){this.atlas.name='authored-pixel-ground-128';}
 createPonds(){return createSurfacePonds(this.wind,this.atlas);}
 createCurbs(){
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(curbData.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(curbData.normals,3));
  const material=stabilizeShadows(new MeshStandardMaterial({color:'#a89b7f',roughness:1,metalness:0,envMapIntensity:0}));
  const mesh=new InstancedMesh(geometry,material,CURB_BLOCKS.length),object=new Object3D();mesh.name='blender-modular-road-curbs';
  CURB_BLOCKS.forEach((p,i)=>{
   object.position.set(p.x,CURB.base,p.z);object.rotation.y=p.yaw;object.scale.set(p.length,1,1);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);
   const tone=.91+((i*37)%13)*.009;mesh.setColorAt(i,new Color(tone,tone,tone));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
 }
 installLamp(material:MeshStandardMaterial,kind:'post'|'box'){
  material.emissiveMap=this.masks[kind];material.emissive.set('#ffcc70');material.emissiveIntensity=2.5;this.lampMaterials.push(material);
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);
   shader.vertexShader='varying float lampLocalY;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlampLocalY=position.y;');
   shader.fragmentShader='varying float lampLocalY;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`totalEmissiveRadiance*=texture2D(emissiveMap,vEmissiveMapUv).r*smoothstep(-.20,-.12,lampLocalY);`);
  };
  material.customProgramCacheKey=()=>`lantern-pane-${kind}-v1`;
 }
 createGrass(){
  const root=new Group();root.name='instanced-wide-grass';const placements=planGrass();
  const geometries=grassData.map(p=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new Float32BufferAttribute(p.normals,3));g.setAttribute('color',new Float32BufferAttribute(p.colors,3));return g;});
  const material=stabilizeShadows(new MeshStandardMaterial({color:'#ffffff',vertexColors:true,side:DoubleSide,roughness:1,metalness:0,envMapIntensity:0}));
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);shader.uniforms.grassTime=this.wind;
   shader.vertexShader='uniform float grassTime;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float flex=pow(max(position.y,0.)/.5,2.);
    float phase=instanceMatrix[3].x*.8+instanceMatrix[3].z*.5;
    transformed.x+=sin(grassTime*1.3+phase)*.035*flex;
    transformed.z+=cos(grassTime*.9+phase)*.02*flex;`);
  };
  material.customProgramCacheKey=()=> 'wide-grass-instanced-v1';
  const object=new Object3D();let bytes=grassData.reduce((n,g)=>n+(g.positions.length+g.normals.length+g.colors.length)*4,0);
  for(let id=0;id<12;id++){
   const group=placements.filter(p=>p.batch===id);if(!group.length)continue;
   const mesh=new InstancedMesh(geometries[id%2],material,group.length);mesh.name='grass-patch-'+id;
   group.forEach((p,i)=>{object.position.set(p.x,.026,p.z);object.scale.setScalar(p.scale);object.rotation.y=p.yaw;object.updateMatrix();mesh.setMatrixAt(i,object.matrix);mesh.setColorAt(i,new Color().lerpColors(new Color('#58a832'),new Color('#91c44d'),p.tone));});
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;
   mesh.onBeforeRender=(_renderer,_scene,camera)=>{if(camera.userData.pondReflection)return;this.stats.grassDrawCalls++;this.stats.grassDrawnTriangles+=grassData[id%2].triangles*mesh.count;this.stats.grassDrawnInstances+=mesh.count;};
   mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.boundingBox!.expandByScalar(.06);mesh.boundingSphere!.radius+=.06;
   root.add(mesh);this.stats.grassBatches++;this.stats.grassTriangles+=grassData[id%2].triangles*group.length;bytes+=group.length*(16+3)*4;
  }
  this.stats.grassInstances=placements.length;this.stats.grassBufferBytes=bytes;
  return root;
 }
 beginDraw(){this.stats.grassDrawCalls=0;this.stats.grassDrawnTriangles=0;this.stats.grassDrawnInstances=0;}
 update(time:SurfaceTime,elapsed:number,bakedShadowsEnabled=true){
  this.bakedContact.strength.value=bakedShadowsEnabled ? .65 : 0;
  this.wind.value=elapsed;this.wallTorches.update(time,elapsed);
  if(time!==this.time){this.time=time;this.night.value=time==='night'?1:0;for(const m of this.lampMaterials)m.emissiveIntensity=time==='night'?2.5:0;}
 }
 diagnostics(){return {...this.stats,wallTorches:this.wallTorches.diagnostics(),bakedShadows:{enabled:this.bakedContact.strength.value>0,strength:this.bakedContact.strength.value,version:'selected-ground-contact-v1',sites:6,size:contactData.size,gpuBytesWithMipmaps:349525,drawCalls:0,receiver:'ground-only',realtimeShadowMaps:0},roads:{version:'block-paths-v1',curbInstances:CURB_BLOCKS.length,curbHeight:CURB.height,curbTriangles:curbData.triangles*CURB_BLOCKS.length,curbBatches:1,collisionEdges:CURB_SOLIDS.length},time:this.time,lampMaterialCount:this.lampMaterials.length,windowEmissiveIntensity:this.time==='night'?2.5:0,pendantEmissiveMultiplier:this.night.value};}
 dispose(){this.bakedContact.texture.dispose();this.atlas.dispose();this.masks.post.dispose();this.masks.box.dispose();}
}
