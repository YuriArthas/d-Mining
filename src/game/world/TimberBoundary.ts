import {SURFACE_SITE} from './SurfaceSite.ts';
import type {QuarryPlacement} from './QuarryLayout.ts';
import {TERRACE_SOLIDS} from './BoundaryProfile.ts';
export const BOUNDARY_ASSETS=['bank-timber','bank-braced','bank-turf','bank-steps','bank-fence'] as const;
// Retain authored bevels on exposed faces; cut shared overlap at the midpoint.
const placements:QuarryPlacement[]=[];

function ring(left:number,right:number,near:number,far:number,topBase:number,courseHeight:number,level:number,last=false){
 const pitch=SURFACE_SITE.boundary.pitch,sites=new Set<string>();
 for(let x=left;x<=right;x+=pitch){sites.add(`${x},${near}`);sites.add(`${x},${far}`);}
 for(let z=near+pitch;z<far;z+=pitch){sites.add(`${left},${z}`);sites.add(`${right},${z}`);}
 const place=(x:number,z:number,yaw:number,index:number)=>{
  // Keep the visible turf course at its authored proportions. One cheap solid
  // block fills the hidden lower column instead of repeated buried turf shells.
  const y=SURFACE_SITE.boundary.base,height=topBase+courseHeight-y;
  const asset=level>0?'bank-turf':index%3===0?'bank-braced':'bank-timber';
  const boundaryClip={maxY:topBase+courseHeight-.025,
   ...(sites.has(`${x-pitch},${z}`)?{minX:x-pitch/2}:{}),...(sites.has(`${x+pitch},${z}`)?{maxX:x+pitch/2}:{}),
   ...(sites.has(`${x},${z-pitch}`)?{minZ:z-pitch/2}:{}),...(sites.has(`${x},${z+pitch}`)?{maxZ:z+pitch/2}:{}),
  };
  placements.push({asset,x,z,yaw,width:8.6,depth:8.6,height:courseHeight,y:topBase,boundaryClip});
  if(last&&index%3!==1)placements.push({asset:'bank-fence',x,z,y:y+height-.12,yaw,width:7.8,depth:.45,height:1.15});
 };
 for(let x=left;x<=right;x+=8){const i=Math.round((x-left)/8);place(x,near,0,i);place(x,far,Math.PI,i+2);}
 for(let z=near+8;z<far;z+=8){const i=Math.round((z-near)/8);place(left,z,Math.PI/2,i+1);place(right,z,-Math.PI/2,i);}
}
// Expand the entire site envelope together; keep the same small terrain modules.
const b=SURFACE_SITE.boundary;
for(let level=0;level<b.levels;level++)ring(b.left-level*b.setback,b.right+level*b.setback,b.back-level*b.setback,b.front+level*b.setback,b.base+level*b.rise,3.6,level,level===b.levels-1);
export const BOUNDARY_PLACEMENTS:readonly QuarryPlacement[]=placements;
export const BOUNDARY_SOLIDS=TERRACE_SOLIDS;
