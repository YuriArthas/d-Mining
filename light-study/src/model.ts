import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

type Bucket={geometries:THREE.BufferGeometry[];material:string;fixture:'base'|'baseline'|'focused';cage:boolean};

export async function loadCourtyard(materials:Record<string,THREE.MeshStandardMaterial>,focusedGlass:THREE.MeshStandardNodeMaterial){
  const loader=new GLTFLoader();
  const resource=(file:string,revision:string)=>{const url=new URL(`./assets/${file}`,document.baseURI);url.searchParams.set('v',revision);return url.href;};
  const [courtyard,lantern]=await Promise.all([
    loader.loadAsync(resource('courtyard.glb',__MODEL_REVISION__)),
    loader.loadAsync(resource('focused-lantern.glb',__LAMP_REVISION__)),
  ]);
  const buckets=new Map<string,Bucket>(),sourceMaterials=new Set<THREE.Material>(),sourceGeometry=new Set<THREE.BufferGeometry>();
  let sourceMeshes=0,triangles=0;
  const tint=(name:string)=>{
    let hash=2166136261;for(const c of name)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
    const value=.69+((hash>>>8)&65535)/65535*.43;
    const warm=(hash&255)/255-.5;
    return [value*(1+.11*warm),value*(1+.025*warm),value*(1-.13*warm)];
  };
  for(const [gltf,isFocused] of [[courtyard,false],[lantern,true]] as const){
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      if(Array.isArray(object.material))throw Error(`Multiple materials on ${object.name}`);
      const name=object.material.name;
      if(!materials[name])throw Error(`Material ${name} is not authored in the sample library`);
      if(!object.geometry.hasAttribute('uv'))throw Error(`Missing surface UV on ${object.name}`);
      sourceMaterials.add(object.material);sourceGeometry.add(object.geometry);sourceMeshes++;
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      for(const attribute of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(attribute))geometry.deleteAttribute(attribute);
      const count=geometry.getAttribute('position').count;triangles+=count/3;
      // One linear colour per authored stone, not a material or draw per slab.
      // Baseline materials ignore this attribute; the crafted profile uses it.
      const varied=/^(Paving_|Back_plinth_|Return_plinth_|Back_coping_|Return_coping_)/.test(object.name);
      const color=varied?tint(object.name):[1,1,1],colors=new Float32Array(count*3);
      for(let i=0;i<count;i++)colors.set(color,i*3);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const fixture=isFocused?'focused':object.name.startsWith('Lantern_')?'baseline':'base';
      const cage=isFocused?object.name.startsWith('Focused_lantern_cage_'):fixture==='baseline'&&name==='iron';
      const key=`${fixture}/${name}/${cage?'cage':'solid'}`;
      const bucket:Bucket=buckets.get(key)??{geometries:[],material:name,fixture,cage};bucket.geometries.push(geometry);buckets.set(key,bucket);
    });
  }
  const group=new THREE.Group();group.name='Authored stone and plaster courtyard';
  const baselineFixture=new THREE.Group(),focusedFixture=new THREE.Group();
  baselineFixture.name='Original wall lantern';focusedFixture.name='Forward hanging lantern';focusedFixture.visible=false;group.add(baselineFixture,focusedFixture);
  let bytes=0;
  for(const [name,bucket] of buckets){
    const merged=mergeGeometries(bucket.geometries);if(!merged)throw Error(`Could not merge ${name}`);
    const geometry=mergeVertices(merged,1e-5);merged.dispose();for(const source of bucket.geometries)source.dispose();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    bytes+=Object.values(geometry.attributes).reduce((sum,attribute)=>sum+attribute.array.byteLength,0)+(geometry.index?.array.byteLength??0);
    const material=bucket.fixture==='focused'&&bucket.material==='lampglass'?focusedGlass:materials[bucket.material];
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=bucket.material!=='lampglass';mesh.receiveShadow=true;
    if(!bucket.cage&&bucket.material!=='lampglass')mesh.layers.enable(1);
    (bucket.fixture==='focused'?focusedFixture:bucket.fixture==='baseline'?baselineFixture:group).add(mesh);
  }
  for(const source of sourceGeometry)source.dispose();for(const source of sourceMaterials)source.dispose();
  const bounds=new THREE.Box3().setFromObject(group);
  let focused=false;
  return {
    group,
    setFocused(value:boolean){focused=value;baselineFixture.visible=!value;focusedFixture.visible=value;},
    fixture:()=>({focused,lightPosition:focused?[-2.65,2.75,-.45]:[.9,2.73,-1.74]}),
    stats:{sourceMeshes,triangles,batches:buckets.size,geometryBytes:bytes,countsIncludeBothFixtures:true,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},
    revision:__MODEL_REVISION__,lampRevision:__LAMP_REVISION__,
  };
}
