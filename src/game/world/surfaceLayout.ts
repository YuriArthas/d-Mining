// Surface gameplay anchors. The ordinary ground comes from the voxel floor at y=0.
export const SURFACE_SPAWN = [0, .1, 26] as const;
export const SURFACE_HOME = {x:0,y:0,z:26,radius:4.5,heightTolerance:.3,hysteresis:.25} as const;
export const SURFACE_SHOP = {x:-18,y:0,z:15,radius:1.7,heightTolerance:.25,hysteresis:.25} as const;
export const SURFACE_SALE = {x:15,y:0,z:11,radius:1.7,heightTolerance:.25,hysteresis:.25} as const;
export type Trail = { points:[number,number,number][]; width:number };
export const SURFACE_TRAILS:Trail[]=[
  {points:[[-30,0,30],[-20,0,30],[0,0,27],[25.7,0,27]],width:4.5},
  {points:[[25.7,0,-23],[25.7,0,40]],width:4.2},
  {points:[[0,0,37],[0,0,10]],width:5.2},
  {points:[[-28,0,30],[-28,0,25]],width:3},
  {points:[[-22,0,30],[-22,0,25]],width:3},
  {points:[[-16,0,30],[-16,0,25]],width:3},
  {points:[[-14,0,19],[-18,0,15],[-19,0,12]],width:3.2},
  {points:[[0,0,29],[0,0,18],[0,0,10]],width:3.2},
  {points:[[-20,0,25],[-14,0,19],[0,0,15],[8,0,15],[15,0,11]],width:3.2},
  {points:[[-14,0,19],[-15,0,12],[-15,0,0],[-18,0,-8],[-20,0,-13]],width:2.6},
  {points:[[10,0,12],[12,0,5],[12,0,-6],[18,0,-16],[24,0,-22]],width:2.2},
];
// Used only to keep decorative grass off circulation and the actual shaft.
export function surfaceGrassAllowed(x:number,z:number){
  if(Math.abs(x)<9.2&&Math.abs(z)<9.2)return false;
  if(Math.hypot(x-SURFACE_SALE.x,z-SURFACE_SALE.z)<4.8)return false;
  if(Math.hypot(x-SURFACE_HOME.x,z-SURFACE_HOME.z)<2.6)return false;
  if(x<-12&&x>-25&&z<1&&z>-17)return false;
  if(Math.hypot((x-24)/1.4,z+22)<5)return false;
  for(const t of SURFACE_TRAILS)for(let i=1;i<t.points.length;i++){
    const a=t.points[i-1],b=t.points[i],dx=b[0]-a[0],dz=b[2]-a[2],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));
    if(Math.hypot(x-a[0]-u*dx,z-a[2]-u*dz)<t.width*.6+.25)return false;
  }
  return true;
}
