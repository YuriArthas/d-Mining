import {SURFACE_ROADS,onSurfaceRoad} from './surfaceLayout.ts';
import type {Solid} from './sceneryKit.ts';
export const CURB={width:.28,height:.12,base:.016,module:1.05,joint:.012} as const;
type Edge={axis:'x'|'z';fixed:number;from:number;to:number};
// Extract the outside of the rectangle UNION; never line an intersection with curbs.
const xs=[...new Set([...SURFACE_ROADS.flatMap(r=>[r.minX,r.maxX]),-9,9])].sort((a,b)=>a-b);
const zs=[...new Set(SURFACE_ROADS.flatMap(r=>[r.minZ,r.maxZ]))].sort((a,b)=>a-b);
const occupied=(x:number,z:number)=>x>=0&&z>=0&&x<xs.length-1&&z<zs.length-1&&onSurfaceRoad((xs[x]+xs[x+1])/2,(zs[z]+zs[z+1])/2);
const raw:Edge[]=[];
for(let x=0;x<xs.length-1;x++)for(let z=0;z<zs.length-1;z++)if(occupied(x,z)){
 if(!occupied(x-1,z))raw.push({axis:'z',fixed:xs[x],from:zs[z],to:zs[z+1]});
 if(!occupied(x+1,z))raw.push({axis:'z',fixed:xs[x+1],from:zs[z],to:zs[z+1]});
 if(!occupied(x,z-1))raw.push({axis:'x',fixed:zs[z],from:xs[x],to:xs[x+1]});
 if(!occupied(x,z+1))raw.push({axis:'x',fixed:zs[z+1],from:xs[x],to:xs[x+1]});
}
// Open transitions into the mine, pet terraces, portal models and service doorsteps.
const kept=raw.filter(e=>!(e.axis==='x'&&Math.abs(e.fixed-12)<.001)&&!(e.axis==='z'&&(e.fixed===25||e.fixed===-27))&&!(e.axis==='x'&&Math.abs(e.fixed-51.3)<.001&&(e.from>=9||e.to<=-9)));
kept.sort((a,b)=>a.axis.localeCompare(b.axis)||a.fixed-b.fixed||a.from-b.from);
export const CURB_EDGES:Edge[]=[];
for(const e of kept){const last=CURB_EDGES.at(-1);if(last&&last.axis===e.axis&&last.fixed===e.fixed&&Math.abs(last.to-e.from)<.001)last.to=e.to;else CURB_EDGES.push({...e});}
export type CurbBlock={x:number;z:number;length:number;yaw:number};
const blocks:CurbBlock[]=[],corners=new Map<string,{x:number;z:number;count:number}>();
for(const e of CURB_EDGES)for(const end of [e.from,e.to]){
 const x=e.axis==='x'?end:e.fixed,z=e.axis==='z'?end:e.fixed,key=`${x},${z}`;
 const p=corners.get(key);if(p)p.count++;else corners.set(key,{x,z,count:1});
}
for(const e of CURB_EDGES){
 const corner=(t:number)=>corners.get(e.axis==='x'?`${t},${e.fixed}`:`${e.fixed},${t}`)!.count>1;
 const start=e.from+(corner(e.from)?CURB.width/2:0),end=e.to-(corner(e.to)?CURB.width/2:0),length=end-start;
 if(length<=.02)continue;
 const n=Math.ceil(length/CURB.module),step=length/n;
 for(let i=0;i<n;i++){const p=start+(i+.5)*step;blocks.push({x:e.axis==='x'?p:e.fixed,z:e.axis==='z'?p:e.fixed,length:step-CURB.joint,yaw:e.axis==='x'?0:Math.PI/2});}
}
for(const p of corners.values())if(p.count>1)blocks.push({x:p.x,z:p.z,length:CURB.width-CURB.joint,yaw:0});
export const CURB_BLOCKS:readonly CurbBlock[]=blocks;
// Physical edges merge the decorative stone joints; ordinary nearby collision owns residency.
export const CURB_SOLIDS:readonly Solid[]=CURB_EDGES.map(e=>({at:[e.axis==='x'?(e.from+e.to)/2:e.fixed,CURB.base+CURB.height/2,e.axis==='z'?(e.from+e.to)/2:e.fixed],half:[e.axis==='x'?(e.to-e.from)/2:CURB.width/2,CURB.height/2,e.axis==='z'?(e.to-e.from)/2:CURB.width/2],yaw:0}));
