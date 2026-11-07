import * as THREE from 'three/webgpu';
import {attribute,texture,uv,uniform,materialEmissive,materialColor,emissive,vec4,Fn} from 'three/tsl';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadJSON,loadResource} from './resourceLoading.ts';
import type {StreetLamp} from './streetModel.ts';

type DistrictLayout={name:string;size:number;roadWidth:number;blocks:{id:string;center:number[];bounds:number[]}[];houses:unknown[];lamps:StreetLamp[];atlasSize:number};
type LightmapMetadata={encoding:string;size:number;range:number;lampCount:number;modelSha256:string;layoutSha256:string};
const resource=(name:string,revision:string)=>{const url=new URL(`./assets/${name}`,document.baseURI);url.searchParams.set('v',revision);return url.href;};

export async function loadDistrict(base:Record<string,THREE.MeshStandardMaterial>){
  const modelURL=resource('district.glb',__DISTRICT_REVISION__),atlasURL=resource('district-light.webp',__DISTRICT_LIGHT_REVISION__);
  const [gltf,layout,metadata,atlas]=await Promise.all([
    loadResource(modelURL,()=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelURL)),
    loadJSON<DistrictLayout>(resource('district-layout.json',__DISTRICT_LAYOUT_REVISION__)),
    loadJSON<LightmapMetadata>(resource('district-light.json',__DISTRICT_LIGHT_META_REVISION__)),
    loadResource(atlasURL,()=>new THREE.TextureLoader().loadAsync(atlasURL)),
  ]);
  if(layout.blocks.length!==4||layout.houses.length!==16||layout.lamps.length!==12||layout.lamps.some((l,i)=>l.id!==i||!l.position.every(Number.isFinite)))throw Error('Invalid district layout');
  if(metadata.modelSha256!==__DISTRICT_SOURCE_REVISION__||metadata.layoutSha256!==__DISTRICT_LAYOUT_REVISION__||metadata.lampCount!==layout.lamps.length||!Number.isFinite(metadata.range)||metadata.range<=0||atlas.image.width!==metadata.size||atlas.image.height!==metadata.size)throw Error('District lightmap does not match its geometry/layout');
  atlas.name='Combined stationary-lamp diffuse radiance RGBM';atlas.colorSpace=THREE.NoColorSpace;atlas.flipY=false;
  // No mipmaps across atlas islands; 12 px baked gutters cover linear sampling.
  atlas.minFilter=atlas.magFilter=THREE.LinearFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
  const enabled=uniform(1),sample=texture(atlas,uv(1));
  const irradiance=sample.rgb.mul(sample.a).mul(metadata.range*Math.PI).mul(enabled);
  const owned:THREE.Material[]=[];
  const materials={...base};
  const flat=(name:string,color:string,roughness:number)=>{const m=new THREE.MeshStandardMaterial({name,color,roughness});materials[name]=m;owned.push(m);};
  flat('roof','#465968',.87);flat('roof_red','#84564a',.87);flat('leaf_light','#81935d',.94);flat('canvas_red','#8b5142',.94);flat('canvas_cream','#c7b38a',.94);
  const rose=base.plaster_ivory.clone();rose.name='warm rose plaster';rose.color.set('#b79d89');materials.plaster_rose=rose;owned.push(rose);
  flat('windowglass','#8c7150',.44);materials.windowglass.emissive.set('#ffc681');materials.windowglass.emissiveIntensity=.32;
  const nodeLibrary=new THREE.StandardNodeLibrary();
  const nodes:Record<string,THREE.MeshStandardNodeMaterial>={};
  for(const [name,source] of Object.entries(materials)){
    const material=nodeLibrary.fromMaterial(source) as THREE.MeshStandardNodeMaterial;
    material.userData.haloSign=name==='windowglass'?-1:0;
    material.lightMap=atlas;material.shadowSide=THREE.DoubleSide;
    material.setupLightMap=()=>new THREE.IrradianceNode(irradiance);
    // The custom setupLightMap override is invisible to automatic node-key
    // discovery. Keep a distinct builder key for each authored material.
    const key=material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey=()=>key()+':district-baked/'+name;
    nodes[name]=material;owned.push(material);
  }
  const glass=new THREE.MeshStandardNodeMaterial({name:'district frosted lantern glass',color:'#ffe5ac',roughness:.28,emissive:'#ffe8bc',emissiveIntensity:7.5});
  glass.userData.haloSign=1;
  const offset=attribute('lampOffset','vec3'),across=offset.x.abs().min(offset.z.abs()).div(.105),vertical=offset.y.div(.14);
  glass.emissiveNode=materialEmissive.mul(across.mul(across).add(vertical.mul(vertical)).negate().exp().mul(2).add(.06));owned.push(glass);
  // Deliberately incomplete diagnostic: keep albedo/atlas/emission, remove
  // normal/roughness sampling, BRDF, sky and directional-light shading.
  // A fragmentNode skips those computations rather than multiplying them by 0.
  const diagnosticMaterials=[...Object.values(nodes),glass];
  const bakedFragments=new Map(diagnosticMaterials.map(material=>[material,Fn(()=>{
    emissive.assign(material.emissiveNode??materialEmissive);
    const diffuse=materialColor.rgb.mul(material===glass?1:sample.rgb.mul(sample.a).mul(metadata.range).mul(enabled));
    return vec4(diffuse.add(emissive),emissive.r.mul(Number(material.userData.haloSign??0)).add(1));
  })()]));
  const originalFragments=new Map(diagnosticMaterials.map(m=>[m,m.fragmentNode]));
  const group=new THREE.Group();group.name='Pinewind four-block district';
  const buckets=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[];emission:boolean}>();
  const oldMaterials=new Set<THREE.Material>();let triangles=0,sourceMeshes=0,bytes=0;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    if(Array.isArray(object.material)||!object.geometry.hasAttribute('uv1')||!object.geometry.hasAttribute('uv'))throw Error('District geometry requires material UV and lightmap UV');
    const name=object.material.name,emission=name==='lampglass';
    if(!emission&&!nodes[name])throw Error('Unknown district material: '+name);
    const geometry=object.geometry.clone();
    // Quantized positions live in a normalized scene grid. Expand before
    // baking the glTF dequantization transform into a world-space batch.
    // Common float attributes also keep every quadrant's merge compatible.
    for(const name of ['position','normal','uv','uv1','color']){
      const source=geometry.getAttribute(name);if(!source)continue;
      if(source.array instanceof Float32Array&&!source.normalized&&!('isInterleavedBufferAttribute' in source))continue;
      const values=new Float32Array(source.count*source.itemSize);
      for(let i=0;i<source.count;i++)for(let k=0;k<source.itemSize;k++)values[i*source.itemSize+k]=source.getComponent(i,k);
      geometry.setAttribute(name,new THREE.BufferAttribute(values,source.itemSize));
    }
    geometry.applyMatrix4(object.matrixWorld);
    for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv','uv1','color'].includes(key))geometry.deleteAttribute(key);
    const position=geometry.getAttribute('position');
    if(emission){
      const id=Number(/^DistrictLamp_(\d+)_/.exec(object.name)?.[1]);const lamp=layout.lamps[id];if(!lamp)throw Error('Lamp glass has no source');
      const local=new Float32Array(position.count*3);
      for(let i=0;i<position.count;i++)local.set([position.getX(i)-lamp.position[0],position.getY(i)-lamp.position[1],position.getZ(i)-lamp.position[2]],i*3);
      geometry.setAttribute('lampOffset',new THREE.BufferAttribute(local,3));
    }
    geometry.computeBoundingBox();const center=geometry.boundingBox!.getCenter(new THREE.Vector3());
    const key=`${name}/${Number(center.x>=0)}/${Number(center.z>=0)}`;
    const bucket=buckets.get(key)??{material:emission?glass:nodes[name],geometries:[],emission};bucket.geometries.push(geometry);buckets.set(key,bucket);
    triangles+=(geometry.index?.count??position.count)/3;sourceMeshes++;oldMaterials.add(object.material);object.geometry.dispose();
  });
  for(const [key,bucket] of buckets){
    const geometry=mergeGeometries(bucket.geometries);if(!geometry)throw Error('Incompatible authored district batch: '+key);
    bucket.geometries.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
    bytes+=Object.values(geometry.attributes).reduce((total,a)=>total+a.array.byteLength,0)+(geometry.index?.array.byteLength??0);
    const mesh=new THREE.Mesh(geometry,bucket.material);mesh.name=key;mesh.castShadow=!bucket.emission;mesh.receiveShadow=true;group.add(mesh);
  }
  oldMaterials.forEach(m=>m.dispose());
  const bounds=new THREE.Box3().setFromObject(group);
  return {group,layout,glass:[glass],windowglass:nodes.windowglass,revision:__DISTRICT_REVISION__,
    setBakedEnabled:(value:boolean)=>{enabled.value=value?1:0;},
    setBakedMaterialDiagnostic:(value:boolean)=>{
      for(const material of diagnosticMaterials){
        const fragment=value?bakedFragments.get(material)!:originalFragments.get(material)!;
        if(material.fragmentNode!==fragment){material.fragmentNode=fragment;material.needsUpdate=true;}
      }
    },
    lightmap:{encoding:metadata.encoding,size:metadata.size,range:metadata.range,lamps:metadata.lampCount,revision:__DISTRICT_LIGHT_REVISION__},
    stats:{triangles,sourceMeshes,batches:buckets.size,geometryBytes:bytes,buildings:layout.houses.length,blocks:layout.blocks.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},
    dispose:()=>{new Set(owned).forEach(m=>m.dispose());atlas.dispose();},
  };
}
