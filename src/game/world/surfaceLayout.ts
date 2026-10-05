// Shared anchors keep visual buildings, interactions, lighting and collision aligned.
export const SURFACE_SPAWN = [0, .1, 46] as const;
export const SURFACE_HOME = {x:SURFACE_SPAWN[0],y:0,z:SURFACE_SPAWN[2],radius:4.5,heightTolerance:.3,hysteresis:.25} as const;
export const SURFACE_BUILDINGS={
 sale:{x:-12,z:56,yaw:Math.PI},shop:{x:12,z:56,yaw:Math.PI},
} as const;
const doorstep=(p:{x:number;z:number;yaw:number})=>({x:p.x+Math.sin(p.yaw)*6.7,y:0,z:p.z+Math.cos(p.yaw)*6.7,radius:1.7,heightTolerance:.25,hysteresis:.25});
export const SURFACE_SHOP=doorstep(SURFACE_BUILDINGS.shop);
export const SURFACE_SALE=doorstep(SURFACE_BUILDINGS.sale);
export type Trail = { points:[number,number,number][]; width:number };
export const SURFACE_TRAILS:Trail[]=[
 {points:[[0,0,12],[0,0,51.3]],width:6},
 {points:[[-24,0,30],[25,0,30]],width:4},
 {points:[[-14,0,49.3],[14,0,49.3]],width:4},
 // Right: browsing apron and two unobstructed side stair landings.
 {points:[[22,0,14],[22,0,46]],width:6},
 ...[15.5,44.5].map(z=>({points:[[22,0,z],[25,0,z]] as [number,number,number][],width:3})),
 // Left: safe continuous lane; short branches alone enter destination triggers.
 {points:[[-22,0,14],[-22,0,50]],width:4},
 ...Array.from({length:9},(_,i)=>({points:[[-22,0,16+i*4],[-27,0,16+i*4]] as [number,number,number][],width:1.6})),
];
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
