import bank from '../assets/ground-details/pond-bank.json' with {type:'json'};
import type {Solid} from './sceneryKit.ts';

// One shared cell layout drives authored meshes, bed paint, planting and collision.
export const SURFACE_PONDS=[{id:'west-pond',x:-11,z:21,sign:1},{id:'east-pond',x:11,z:21,sign:-1}] as const;
export const POND={halfX:6,halfZ:5,waterY:bank.waterY,bankHeight:bank.bankHeight,bedY:bank.bedY,depth:bank.waterY-bank.bedY} as const;
function rowDistance(x:number,z:number,row:readonly number[]){
 const [rz,lo,hi]=row,dx=Math.abs(x-(lo+hi)/2)-(hi-lo)/2,dz=Math.abs(z-rz-.5)-.5;
 return Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0);
}
// Water-only signed distance. Plants also clear the one-metre grass bank.
export function pondDistance(x:number,z:number){
 return Math.min(...SURFACE_PONDS.flatMap(p=>bank.waterRows.map(row=>rowDistance((x-p.x)*p.sign,(z-p.z)*p.sign,row))));
}
const glsl=(n:number)=>n.toFixed(6);
export const POND_DISTANCE_GLSL=`
float pondRowDistance(vec2 p,vec2 center,vec2 halfSize){
 vec2 q=abs(p-center)-halfSize;return length(max(q,0.))+min(max(q.x,q.y),0.);
}
float gardenPondDistance(vec2 p){
 float d=10000.;
 ${SURFACE_PONDS.map(p=>`{
  vec2 q=(p-vec2(${glsl(p.x)},${glsl(p.z)}))*${glsl(p.sign)};
  ${bank.waterRows.map(([z,lo,hi])=>`d=min(d,pondRowDistance(q,vec2(${glsl((lo+hi)/2)},${glsl(z+.5)}),vec2(${glsl((hi-lo)/2)},.5)));`).join('\n')}
 }`).join('\n')}
 return d;
}`;
// Merge contiguous bank cells per row; no full-pond box or render-mesh coupling.
const rows=new Map<number,number[]>();
for(const [x,z] of bank.shoreCells){if(!rows.has(z))rows.set(z,[]);rows.get(z)!.push(x);}
const segments:{z:number;lo:number;hi:number}[]=[];
for(const [z,xs] of rows){
 xs.sort((a,b)=>a-b);let lo=xs[0],hi=lo+1;
 for(const x of xs.slice(1)){if(x===hi)hi++;else{segments.push({z,lo,hi});lo=x;hi=x+1;}}
 segments.push({z,lo,hi});
}
export const POND_SOLIDS:readonly Solid[]=SURFACE_PONDS.flatMap(p=>segments.map(r=>({
 at:[p.x+(r.lo+r.hi)/2*p.sign,POND.bankHeight/2,p.z+(r.z+.5)*p.sign] as [number,number,number],
 half:[(r.hi-r.lo)/2,POND.bankHeight/2,.5] as [number,number,number],yaw:0,
})));
