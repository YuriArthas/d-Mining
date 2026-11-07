import * as THREE from 'three/webgpu';
import {positionWorld,vec3,materialEmissive} from 'three/tsl';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {loadJSON,loadResource} from './resourceLoading.ts';

export type StreetLamp={id:number;position:[number,number,number];radius:number;distance:number;intensity:number};
type Layout={lamps:StreetLamp[];shops:unknown[];streetWidth:number;streetLength:number};
const resource=(name:string,revision:string)=>{const u=new URL(`./assets/${name}`,document.baseURI);u.searchParams.set('v',revision);return u.href;};
export async function loadStreet(base:Record<string,THREE.MeshStandardMaterial>){
  const modelURL=resource('street.glb',__STREET_REVISION__);
  const [gltf,layout]=await Promise.all([
    loadResource(modelURL,()=>new GLTFLoader().loadAsync(modelURL)),
    loadJSON<Layout>(resource('street-layout.json',__STREET_LAYOUT_REVISION__)),
  ]);
  if(layout.lamps.length!==3||layout.lamps.some((l,i)=>l.id!==i||l.radius!==.22||!l.position.every(Number.isFinite)))throw Error('Invalid authored street lamp layout');
  const materials={...base},owned:THREE.Material[]=[];
  const flat=(name:string,color:string,roughness:number)=>{const m=new THREE.MeshStandardMaterial({name,color,roughness});materials[name]=m;owned.push(m);};
  flat('roof','#465968',.87);flat('canvas_red','#8b5142',.94);flat('canvas_cream','#c7b38a',.94);
  const rose=base.plaster_ivory.clone();rose.name='warm rose plaster';rose.color.set('#b79d89');materials.plaster_rose=rose;owned.push(rose);
  const windowglass=new THREE.MeshStandardMaterial({name:'quiet shop windows',color:'#8c7150',roughness:.44,emissive:'#ffc681',emissiveIntensity:.32});materials.windowglass=windowglass;owned.push(windowglass);
  const glass=layout.lamps.map(l=>{
    const m=new THREE.MeshStandardNodeMaterial({name:`street lantern ${l.id}`,color:'#ffe5ac',roughness:.28,emissive:'#ffe8bc',emissiveIntensity:7.5});
    const offset=positionWorld.sub(vec3(...l.position));
    const across=offset.x.abs().min(offset.z.abs()).div(.105),vertical=offset.y.div(.14);
    m.emissiveNode=materialEmissive.mul(across.mul(across).add(vertical.mul(vertical)).negate().exp().mul(2).add(.06));
    owned.push(m);return m;
  });
  for(const m of Object.values(materials))m.shadowSide=THREE.DoubleSide;
  const buckets=new Map<string,{geometries:THREE.BufferGeometry[];material:THREE.Material;cage:number|null;emission:boolean}>();
  const sourceGeometry=new Set<THREE.BufferGeometry>(),sourceMaterial=new Set<THREE.Material>();
  let triangles=0,sourceMeshes=0;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    if(Array.isArray(o.material)||!materials[o.material.name]||!o.geometry.hasAttribute('uv'))throw Error(`Invalid authored material/UV: ${o.name}`);
    const name=o.material.name,fixture=/^StreetLamp_(\d+)_/.exec(o.name),id=fixture?Number(fixture[1]):null;
    const cage=o.name.includes('_cage_')?id:null,emission=name==='lampglass';
    if(emission&&id===null)throw Error('Lamp glass without owner');
    const material=emission?glass[id!]:materials[name];
    const key=`${name}/${emission?id:'all'}/${cage??'solid'}`;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);
    for(const a of Object.keys(g.attributes))if(!['position','normal','uv','uv1'].includes(a))g.deleteAttribute(a);
    if(!g.hasAttribute('uv1'))throw Error('Street is missing its static-shadow atlas UVs');
    const count=g.getAttribute('position').count,colors=new Float32Array(count*3);
    let hash=2166136261;for(const c of o.name)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
    const varied=/^(Paving_|Sidewalk_|Curb_)/.test(o.name),v=varied?.69+((hash>>>8)&65535)/65535*.43:1,w=varied?(hash&255)/255-.5:0;
    for(let i=0;i<count;i++)colors.set([v*(1+.11*w),v*(1+.025*w),v*(1-.13*w)],i*3);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const bucket=buckets.get(key)??{geometries:[],material,cage,emission};bucket.geometries.push(g);buckets.set(key,bucket);
    triangles+=count/3;sourceMeshes++;sourceGeometry.add(o.geometry);sourceMaterial.add(o.material);
  });
  const group=new THREE.Group();group.name='Newly authored mining town street';let bytes=0;
  for(const [key,b] of buckets){
    const merged=mergeGeometries(b.geometries);if(!merged)throw Error(`Street merge failed: ${key}`);
    const geometry=mergeVertices(merged,1e-5);merged.dispose();b.geometries.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
    bytes+=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(geometry.index?.array.byteLength??0);
    const mesh=new THREE.Mesh(geometry,b.material);mesh.name=key;mesh.castShadow=!b.emission;mesh.receiveShadow=true;
    // Cage excludes only its own lamp; the other lamps and moon still see it.
    for(const lamp of layout.lamps)if(!b.emission&&b.cage!==lamp.id)mesh.layers.enable(lamp.id+1);
    group.add(mesh);
  }
  sourceGeometry.forEach(g=>g.dispose());sourceMaterial.forEach(m=>m.dispose());
  const bounds=new THREE.Box3().setFromObject(group);
  return {group,layout,glass,windowglass,stats:{triangles,sourceMeshes,batches:buckets.size,geometryBytes:bytes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},revision:__STREET_REVISION__,dispose:()=>owned.forEach(m=>m.dispose())};
}
