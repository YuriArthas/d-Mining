import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = readonly [number, number, number];
export const C = {
  ivory: '#fff1cc', plaster: '#fff0d4', wood: '#b87536', woodLight: '#efaf57', woodDark: '#243548',
  red: '#e86429', redLight: '#ff9445', teal: '#149da9', tealLight: '#68d9cf', metal: '#294357',
  stone: '#b9c5c7', stoneLight: '#e1dfc7', stoneDark: '#637e90', grass: '#62b54c', grassLight: '#a5d75d',
  leaf: '#338653', leafLight: '#8acb54', leafDark: '#205746', gold: '#ffca4b', glow: '#fff2b7',
};
export const materials = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 }) as THREE.Material,
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .5 }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, emissive: '#ffd297', emissiveIntensity: .35 }),
  crystal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .25 }),
};
export type Finish = keyof typeof materials;
export function useDiffuseLighting() {
  materials.matte.dispose();
  materials.matte=new THREE.MeshLambertMaterial({vertexColors:true});
}
const color = new THREE.Color();
export function paint(g: THREE.BufferGeometry, tint: string, variation = 0) {
  const p = g.getAttribute('position'); const a = new Float32Array(p.count * 3); color.set(tint);
  for (let i = 0; i < p.count; i++) { const f=1 + variation * Math.sin(p.getX(i)*1.7+p.getY(i)*2.1+p.getZ(i)*1.3); a[i*3]=color.r*f; a[i*3+1]=color.g*f; a[i*3+2]=color.b*f; }
  g.setAttribute('color', new THREE.BufferAttribute(a,3)); return g;
}
export class Kit {
  readonly group = new THREE.Group();
  mesh(g: THREE.BufferGeometry, tint: string, at: V3 = [0,0,0], rotation: V3 = [0,0,0], finish: Finish = 'matte') {
    const m = new THREE.Mesh(paint(g,tint),materials[finish]); m.position.set(...at); m.rotation.set(...rotation); m.castShadow=true; m.receiveShadow=true; this.group.add(m); return m;
  }
  box(at: V3, size: V3, tint: string, rotation: V3 = [0,0,0], bevel = .05, finish: Finish = 'matte') {
    const g=bevel>0 ? new RoundedBoxGeometry(size[0],size[1],size[2],1,Math.min(bevel,Math.min(...size)*.2)) : new THREE.BoxGeometry(...size);
    return this.mesh(g,tint,at,rotation,finish);
  }
  cylinder(at: V3, top: number, bottom: number, height: number, tint: string, sides = 10, rotation: V3 = [0,0,0], finish: Finish = 'matte') { return this.mesh(new THREE.CylinderGeometry(top,bottom,height,sides),tint,at,rotation,finish); }
  sphere(at: V3, scale: V3, tint: string, detail = 1, finish: Finish = 'matte') { const g=new THREE.IcosahedronGeometry(1,detail);g.scale(...scale);return this.mesh(g,tint,at,[0,0,0],finish); }
  beam(a: V3,b: V3,width: number,depth: number,tint: string,finish: Finish = 'matte') {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=this.box(av.clone().add(bv).multiplyScalar(.5).toArray() as [number,number,number],[width,d.length(),depth],tint,[0,0,0],.035,finish);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
  }
  add(child: THREE.Object3D, at: V3=[0,0,0], yaw=0) { child.position.set(...at);child.rotation.y=yaw;this.group.add(child);return child; }
}
export function rng(seed: number) { return () => { seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }

// Flatten the static authoring graph once. Materials remain shared; geometry is
// partitioned into spatial cells so frustum culling doesn't submit the whole valley.
export function batchStatic(root: THREE.Group) {
  root.updateMatrixWorld(true);const bins=new Map<string,{material:THREE.Material,geometries:THREE.BufferGeometry[],cast:boolean,receive:boolean}>();let sources=0;
  const sourceGeometries=new Set<THREE.BufferGeometry>();
  const geometryBuffers={sourceUnique:{vertices:0,bytes:0},beforeWeld:{vertices:0,bytes:0},batched:{vertices:0,bytes:0}};
  const recordBuffers=(g:THREE.BufferGeometry,total:{vertices:number,bytes:number})=>{
    total.vertices+=g.getAttribute('position').count;
    total.bytes+=Object.values(g.attributes).reduce((bytes,attribute)=>bytes+attribute.array.byteLength,0)+(g.index?.array.byteLength??0);
  };
  root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.userData.keepDynamic)return;const mat=o.material;if(Array.isArray(mat))throw Error('Static geometry must have one material');
    if(!sourceGeometries.has(o.geometry)){sourceGeometries.add(o.geometry);recordBuffers(o.geometry,geometryBuffers.sourceUnique);}
    const world=new THREE.Vector3();o.getWorldPosition(world);const key=`${mat.uuid}:${o.castShadow}:${o.receiveShadow}:${Math.floor(world.x/32)}:${Math.floor(world.z/32)}`;
    let bin=bins.get(key);if(!bin){bin={material:mat,geometries:[],cast:o.castShadow,receive:o.receiveShadow};bins.set(key,bin);}
    let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
    // Authored pixel atlases require their original UVs. Only untextured bins
    // can discard them; welding below also respects UV seams.
    if((mat as THREE.MeshLambertMaterial).map){if(!g.hasAttribute('uv'))throw Error(`Textured mesh ${o.name} has no UVs`);}else g.deleteAttribute('uv');
    for(const name of Object.keys(g.attributes))if(!['position','normal','color','uv'].includes(name))g.deleteAttribute(name);
    if(!g.hasAttribute('normal'))g.computeVertexNormals();if(!g.hasAttribute('color'))paint(g,'#ffffff');bin.geometries.push(g);sources++;
  });
  const output=new THREE.Group();output.name='Batched static valley';let triangles=0,texturedBatches=0,texturedTriangles=0;
  for(const bin of bins.values()){
    const expanded=mergeGeometries(bin.geometries);if(!expanded)throw Error('Static geometry merge failed');
    recordBuffers(expanded,geometryBuffers.beforeWeld);
    // Weld only matching position, normal, color and UV tuples. Hard normals,
    // authored color boundaries and atlas seams stay separate; no reduction.
    const g=mergeVertices(expanded,1e-5);expanded.dispose();
    recordBuffers(g,geometryBuffers.batched);g.computeBoundingSphere();
    const m=new THREE.Mesh(g,bin.material);m.castShadow=bin.cast;m.receiveShadow=bin.receive;output.add(m);
    triangles+=(g.index?.count??g.getAttribute('position').count)/3;
    if((bin.material as THREE.MeshLambertMaterial).map){texturedBatches++;texturedTriangles+=(g.index?.count??g.getAttribute('position').count)/3;}
    for(const old of bin.geometries)old.dispose();
  }
  root.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.keepDynamic)o.geometry.dispose();});
  return {group:output,stats:{sourceMeshes:sources,batches:bins.size,triangles,texturedBatches,texturedTriangles,geometryBuffers}};
}
