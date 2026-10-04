// Shared anchors keep visual buildings, interactions, lighting and collision aligned.
export const SURFACE_SPAWN = [0, .1, 30] as const;
export const SURFACE_HOME = {x:0,y:0,z:30,radius:4.5,heightTolerance:.3,hysteresis:.25} as const;
export const SURFACE_BUILDINGS={
 sale:{x:-22,z:6,yaw:.3},shop:{x:22,z:6,yaw:-.3},
} as const;
const doorstep=(p:{x:number;z:number;yaw:number})=>({x:p.x+Math.sin(p.yaw)*6.7,y:0,z:p.z+Math.cos(p.yaw)*6.7,radius:1.7,heightTolerance:.25,hysteresis:.25});
export const SURFACE_SHOP=doorstep(SURFACE_BUILDINGS.shop);
export const SURFACE_SALE=doorstep(SURFACE_BUILDINGS.sale);
export type Trail = { points:[number,number,number][]; width:number };
export const SURFACE_TRAILS:Trail[]=[
 {points:[[0,0,38],[0,0,19],[0,0,10]],width:5.5},
 {points:[[-22,0,30],[0,0,30],[35,0,33]],width:5},
 {points:[[SURFACE_SALE.x,0,SURFACE_SALE.z],[0,0,17],[SURFACE_SHOP.x,0,SURFACE_SHOP.z]],width:3.8},
 // A single forecourt faces the raised display; two branches reach its side stairs.
 {points:[[-22,0,15.5],[-22,0,44.5]],width:4},
 {points:[[-22,0,15.5],[-25,0,15.5]],width:3},
 {points:[[-22,0,44.5],[-25,0,44.5]],width:3},
 // Safe circulation is separate from the short station entry spurs.
 {points:[[15,0,30],[35,0,30],[35,0,36],[15,0,36]],width:3.8},
 ...[15,24,33].flatMap(x=>[24,42].map(z=>({points:[[x,0,z<33?30:36],[x,0,z]] as [number,number,number][],width:2.4}))),
 ...[24,33,42].map(z=>({points:[[35,0,z],[42,0,z]] as [number,number,number][],width:2.4})),

];
export function surfaceGrassAllowed(x:number,z:number){
 if(Math.abs(x)<9.2&&Math.abs(z)<9.2)return false;
 for(const p of [SURFACE_SALE,SURFACE_SHOP,SURFACE_HOME])if(Math.hypot(x-p.x,z-p.z)<p.radius+1)return false;
 for(const t of SURFACE_TRAILS)for(let i=1;i<t.points.length;i++){
  const a=t.points[i-1],b=t.points[i],dx=b[0]-a[0],dz=b[2]-a[2],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));
  if(Math.hypot(x-a[0]-u*dx,z-a[2]-u*dz)<t.width*.6+.25)return false;
 }
 return true;
}
