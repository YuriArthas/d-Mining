import {SURFACE_TRAILS} from '../content/trails.ts';
import {SURFACE_FACILITIES} from '../content/surfaceFacilities.ts';
import {deriveFacility} from './deriveFacility.ts';
// Shared anchors keep visual buildings, interactions, lighting and collision aligned.
export const SURFACE_SPAWN = [0, .1, 46] as const;
export const SURFACE_HOME = {x:SURFACE_SPAWN[0],y:0,z:SURFACE_SPAWN[2],radius:4.5,heightTolerance:.3,hysteresis:.25} as const;
export const SURFACE_BUILDINGS={sale:SURFACE_FACILITIES.sale.anchor,shop:SURFACE_FACILITIES.shop.anchor};
export const SURFACE_SERVICES={sale:deriveFacility(SURFACE_FACILITIES.sale),shop:deriveFacility(SURFACE_FACILITIES.shop)};
export const SURFACE_SHOP=SURFACE_SERVICES.shop.trigger;
export const SURFACE_SALE=SURFACE_SERVICES.sale.trigger;
export {SURFACE_TRAILS,type Trail} from '../content/trails.ts';
export type RoadRect={minX:number;maxX:number;minZ:number;maxZ:number};
// Square-ended strips: the shader, curb union and grass exclusion share these bounds.
export const SURFACE_ROADS:readonly RoadRect[]=SURFACE_TRAILS.flatMap(t=>t.points.slice(1).map((b,i)=>{
 const a=t.points[i],horizontal=a[2]===b[2];
 if(!horizontal&&a[0]!==b[0])throw Error('Surface roads must follow the block grid');
 return {minX:Math.min(a[0],b[0])-(horizontal?0:t.width/2),maxX:Math.max(a[0],b[0])+(horizontal?0:t.width/2),minZ:Math.min(a[2],b[2])-(horizontal?t.width/2:0),maxZ:Math.max(a[2],b[2])+(horizontal?t.width/2:0)};
}));
export function onSurfaceRoad(x:number,z:number,margin=0){return SURFACE_ROADS.some(r=>x>=r.minX-margin&&x<=r.maxX+margin&&z>=r.minZ-margin&&z<=r.maxZ+margin);}
export function surfaceGrassAllowed(x:number,z:number){
 if(Math.abs(x)<9.2&&Math.abs(z)<9.2)return false;
 for(const p of [SURFACE_SALE,SURFACE_SHOP,SURFACE_HOME])if(Math.hypot(x-p.x,z-p.z)<p.radius+1)return false;
 if(onSurfaceRoad(x,z,.55))return false;
 return true;
}
