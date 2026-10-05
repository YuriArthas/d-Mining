import {BufferGeometry,Float32BufferAttribute,Matrix4,Mesh,Plane,Vector3,type Group} from 'three';
import {compactSceneryGeometry} from './compactSceneryGeometry.ts';
import type {QuarryPlacement} from '../world/QuarryLayout.ts';

// Bake cuts into geometry so beauty, shadows and raycasts share the same surface.
// Interpolate original UVs and normals; never stretch the texture to hide a seam.
export function clipBoundaryGeometry(source:BufferGeometry,planes:readonly Plane[]):BufferGeometry{
 const names=Object.keys(source.attributes),attributes=names.map(n=>source.getAttribute(n));
 const offsets:number[]=[];let stride=0;
 for(const a of attributes){offsets.push(stride);stride+=a.itemSize;}
 const position=offsets[names.indexOf('position')],output=names.map(()=>[] as number[]);
 const read=(index:number)=>attributes.flatMap(a=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(index,c)));
 const distance=(v:number[],p:Plane)=>p.normal.x*v[position]+p.normal.y*v[position+1]+p.normal.z*v[position+2]+p.constant;
 const out=new BufferGeometry();let count=0;
 const sourceCount=source.index?.count??source.getAttribute('position').count;
 const groups=source.groups.length?source.groups:[{start:0,count:sourceCount,materialIndex:0}];
 for(const group of groups){
  const start=count;
  for(let t=group.start;t<Math.min(sourceCount,group.start+group.count);t+=3){
   let polygon=[0,1,2].map(i=>read(source.index?source.index.getX(t+i):t+i));
   for(const plane of planes){
    const clipped:number[][]=[];
    for(let i=0;i<polygon.length;i++){
     const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a,plane),db=distance(b,plane),insideA=da>=0,insideB=db>=0;
     if(insideA)clipped.push(a);
     if(insideA!==insideB){const u=da/(da-db);clipped.push(a.map((v,c)=>v+(b[c]-v)*u));}
    }
    polygon=clipped;if(polygon.length<3)break;
   }
   for(let i=1;i+1<polygon.length;i++){
    const triangle=[polygon[0],polygon[i],polygon[i+1]];
    const p=triangle.map(v=>new Vector3(v[position],v[position+1],v[position+2]));
    if(p[1].sub(p[0]).cross(p[2].sub(p[0])).lengthSq()<1e-20)continue;
    for(const v of triangle){attributes.forEach((a,j)=>{for(let c=0;c<a.itemSize;c++)output[j].push(v[offsets[j]+c]);});count++;}
   }
  }
  if(count>start)out.addGroup(start,count-start,group.materialIndex);
 }
 names.forEach((name,i)=>out.setAttribute(name,new Float32BufferAttribute(output[i],attributes[i].itemSize)));
 if(out.hasAttribute('normal'))out.normalizeNormals();
 const compact=compactSceneryGeometry(out);compact.computeBoundingBox();compact.computeBoundingSphere();return compact;
}

export class BoundaryStitcher{
 private cache=new Map<string,BufferGeometry>();
 readonly stats={version:'midpoint-cut-v1',meshes:0,variants:0,triangles:0,maxOutsideError:0,bytes:0};
 apply(instance:Group,p:QuarryPlacement){
  if(!p.boundaryClip)return;
  const b=p.boundaryClip,planes:Plane[]=[];
  if(b.minX!==undefined)planes.push(new Plane(new Vector3(1,0,0),-b.minX));
  if(b.maxX!==undefined)planes.push(new Plane(new Vector3(-1,0,0),b.maxX));
  if(b.minZ!==undefined)planes.push(new Plane(new Vector3(0,0,1),-b.minZ));
  if(b.maxZ!==undefined)planes.push(new Plane(new Vector3(0,0,-1),b.maxZ));
  if(b.maxY!==undefined)planes.push(new Plane(new Vector3(0,-1,0),b.maxY));
  instance.updateMatrixWorld(true);
  instance.traverse(o=>{
   if(!(o instanceof Mesh))return;
   const inverse=new Matrix4().copy(o.matrixWorld).invert();
   const local=planes.map(p=>p.clone().applyMatrix4(inverse));
   const key=o.geometry.uuid+':'+local.map(p=>[...p.normal.toArray(),p.constant].map(n=>String(Math.round(n*1e6)/1e6)).join(',')).sort().join(';');
   let geometry=this.cache.get(key);
   if(!geometry){
    geometry=clipBoundaryGeometry(o.geometry,local);this.cache.set(key,geometry);this.stats.variants++;
    this.stats.bytes+=(geometry.index?.array.byteLength??0)+Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0);
   }
   o.geometry=geometry;this.stats.meshes++;this.stats.triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;
   const position=geometry.getAttribute('position'),point=new Vector3();
   for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);for(const plane of planes)this.stats.maxOutsideError=Math.max(this.stats.maxOutsideError,-plane.distanceToPoint(point));}
  });
 }
}
