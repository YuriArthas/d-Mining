import {BOUNDARY_SOLIDS} from './TimberBoundary.ts';
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
export const HUB_CLEARANCES:readonly Rect[]=[PET_AREA,PORTAL_AREA,SURFACE_SITE.plaza,SURFACE_SITE.sale,SURFACE_SITE.shop,
 {minX:-25,maxX:25,minZ:13,maxZ:17},
 {minX:-19,maxX:19,minZ:44,maxZ:62},
];
const trees=new Set(['crown-tree','oak-wide','oak-tall','maple-gold','maple-coral','birch-round','cedar-pillow','willow-dome','sapling-pair']);
// Place vegetation on the actual authored step height, including low timber steps.
function terraceHeight(x:number,z:number){
 let height=0;
 for(const s of BOUNDARY_SOLIDS){const dx=x-s.at[0],dz=z-s.at[2],c=Math.cos(s.yaw),n=Math.sin(s.yaw);
  if(Math.abs(c*dx-n*dz)<=s.half[0]&&Math.abs(n*dx+c*dz)<=s.half[2])height=Math.max(height,s.at[1]+s.half[1]);
 }
 return height;
}
const planting=new Set(['soft-shrub','shrub-round','shrub-flower','shrub-berry','flower-daisies','grass-tussock','mushroom-cluster']);
// Plan the complete decorative pass against measured model footprints, not
// centre points. Occupied gameplay bays are deliberately unavailable for props.
export function layoutDecorations(input:readonly QuarryPlacement[],fixed:readonly QuarryPlacement[]){
 const occupied=fixed.filter(p=>p.asset!=='meadow-base'&&!p.asset.startsWith('bank-')).map(p=>footprint(p,.3));
 const result:QuarryPlacement[]=[];let tree=0,plant=0;
 const b=SURFACE_SITE.boundary;
 const inset=b.module/2-b.setback/2;
 const treeSlots=[...[b.left+inset,b.right-inset].flatMap(x=>[-15,3,21,39,57].map(z=>({x,z}))),...[-23,-7,9,25,41].map(x=>({x,z:b.back+inset})),...[-15,9,33].map(x=>({x,z:b.front-inset}))];
 for(const p of input){
  if(trees.has(p.asset)){
   const at=treeSlots[tree++];if(!at)throw Error('Tree terrace capacity exceeded');
   result.push({...p,...at,y:terraceHeight(at.x,at.z)-.05});continue;
  }
  if(planting.has(p.asset)){
   const i=plant++,side=i%2?b.right-inset:b.left+inset,z=b.back+8+(Math.floor(i/2)%14)*(b.front-b.back-16)/13;
   const x=side+(i%2?-1:1)*(Math.floor(i/28)%2)*.5;
   result.push({...p,x,z,y:terraceHeight(x,z)-.03});continue;
  }
  const free=(candidate:QuarryPlacement)=>{
   const r=footprint(candidate,.35);
   return r.minX>=-32&&r.maxX<=49&&r.minZ>=-24&&r.maxZ<=64&&!HUB_CLEARANCES.some(a=>intersects(a,r))&&!occupied.some(a=>intersects(a,r));
  };
  let chosen:QuarryPlacement|undefined=free(p)?p:undefined;
  if(!chosen){
   // Rear workyard, then western service strip. Largest assets placed first.
   outer:for(let z=-22;z<=12;z+=2)for(let x=-30;x<=47;x+=2){
    const candidate={...p,x,z};if(free(candidate)){chosen=candidate;break outer;}
   }
  }
  if(!chosen)throw Error('No unobstructed layout position for '+p.asset);
  result.push(chosen);occupied.push(footprint(chosen,.35));
 }
 return result;
}
