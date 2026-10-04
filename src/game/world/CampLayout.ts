import {SURFACE_SITE} from './SurfaceSite.ts';
import sizes from './campModelBounds.json' with {type:'json'};
import {PET_AREA,PORTAL_AREA} from './SurfaceHub.ts';
import type {QuarryPlacement} from './QuarryLayout.ts';
export type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
export function footprint(p:QuarryPlacement,padding=0):Rect{
 const source=(sizes as Record<string,number[]>)[p.asset];
 if(!p.depth&&!source)throw Error('Missing measured dimensions: '+p.asset);
 const depth=p.depth??p.width*source[2]/source[0],yaw=p.yaw??0;
 const hx=(Math.abs(Math.cos(yaw))*p.width+Math.abs(Math.sin(yaw))*depth)/2+padding;
 const hz=(Math.abs(Math.sin(yaw))*p.width+Math.abs(Math.cos(yaw))*depth)/2+padding;
 return {minX:p.x-hx,maxX:p.x+hx,minZ:p.z-hz,maxZ:p.z+hz};
}
export const intersects=(a:Rect,b:Rect)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
export const HUB_CLEARANCES:readonly Rect[]=[PET_AREA,PORTAL_AREA,{minX:-16,maxX:11,minZ:14,maxZ:49},{minX:-25,maxX:25,minZ:11.5,maxZ:17}];
const trees=new Set(['crown-tree','oak-wide','oak-tall','maple-gold','maple-coral','birch-round','cedar-pillow','willow-dome','sapling-pair']);
const planting=new Set(['soft-shrub','shrub-round','shrub-flower','shrub-berry','flower-daisies','grass-tussock','mushroom-cluster']);
// Plan the complete decorative pass against measured model footprints, not
// centre points. Occupied gameplay bays are deliberately unavailable for props.
export function layoutDecorations(input:readonly QuarryPlacement[],fixed:readonly QuarryPlacement[]){
 const occupied=fixed.filter(p=>p.asset!=='meadow-base'&&!p.asset.startsWith('bank-')).map(p=>footprint(p,.3));
 const result:QuarryPlacement[]=[];let tree=0,plant=0;
 const b=SURFACE_SITE.boundary;
 const treeSlots=[...[b.left,b.right].flatMap(x=>[-28,-8,12,32,52].map(z=>({x,z}))),...[-40,-20,0,20,40].map(x=>({x,z:b.back})),...[-32,0,32].map(x=>({x,z:b.front}))];
 for(const p of input){
  if(trees.has(p.asset)){
   const at=treeSlots[tree++];if(!at)throw Error('Tree terrace capacity exceeded');
   result.push({...p,...at,y:3.3});continue;
  }
  if(planting.has(p.asset)){
   const i=plant++,side=i%2?b.right:b.left,z=b.back+8+Math.floor(i/2)%14*6.7;
   result.push({...p,x:side+(Math.floor(i/28)%2)*2,z,y:3.32});continue;
  }
  const free=(candidate:QuarryPlacement)=>{
   const r=footprint(candidate,.35);
   return r.minX>=-39.4&&r.maxX<=39.4&&r.minZ>=-31.4&&r.maxZ<=47.4&&!HUB_CLEARANCES.some(a=>intersects(a,r))&&!occupied.some(a=>intersects(a,r));
  };
  let chosen:QuarryPlacement|undefined=free(p)?p:undefined;
  if(!chosen){
   // Rear workyard, then western service strip. Largest assets placed first.
   outer:for(let z=-27;z<=15;z+=2)for(let x=-35;x<=35;x+=2){
    const candidate={...p,x,z};if(free(candidate)){chosen=candidate;break outer;}
   }
  }
  if(!chosen)throw Error('No unobstructed layout position for '+p.asset);
  result.push(chosen);occupied.push(footprint(chosen,.35));
 }
 return result;
}
