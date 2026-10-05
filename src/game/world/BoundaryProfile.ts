import {SURFACE_SITE} from './SurfaceSite.ts';
import type {Solid} from './sceneryKit.ts';
const b=SURFACE_SITE.boundary;
export type BoundaryRect={left:number;right:number;back:number;front:number};
const first={left:b.left+b.module/2,right:b.right-b.module/2,back:b.back+b.module/2,front:b.front-b.module/2};
export const expandBoundary=(r:BoundaryRect,d:number):BoundaryRect=>({left:r.left-d,right:r.right+d,back:r.back-d,front:r.front+d});
export const BOUNDARY_TIERS=Array.from({length:b.levels},(_,level)=>({
 inner:expandBoundary(first,level*b.setback),
 outer:expandBoundary(first,level===b.levels-1?level*b.setback+b.module:(level+1)*b.setback),
 top:b.base+level*b.rise+3.6,base:b.base,
}));
// Continuous annular solids, separate from decorative panels and render topology.
export const TERRACE_SOLIDS:Solid[]=BOUNDARY_TIERS.flatMap(({inner:i,outer:o,top,base})=>{
 const rects=[[o.left,o.right,o.back,i.back],[o.left,o.right,i.front,o.front],[o.left,i.left,i.back,i.front],[i.right,o.right,i.back,i.front]];
 return rects.map(([l,r,n,f])=>({at:[(l+r)/2,(top+base)/2,(n+f)/2],half:[(r-l)/2,(top-base)/2,(f-n)/2],yaw:0}));
});
