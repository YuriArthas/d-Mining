import {SURFACE_TRAILS} from './surfaceLayout.ts';
import {LAYERS,type Layer} from '../content/layers.ts';
import {themeById} from '../content/themes.ts';
export const HUB_ASSETS=['portal-timber','portal-fungal','portal-crystal','portal-frozen','portal-volcanic','portal-fossil','portal-core','egg-meadow'] as const;
const models=['portal-timber','portal-fungal','portal-crystal','portal-timber','portal-frozen','portal-volcanic','portal-fossil','portal-timber','portal-core'] as const;
// One destination per layer. Unlock depths remain content-owned, never duplicated.
export function portalsFor(layers:readonly Layer[]){return layers.slice(1).map((layer,i)=>({
 id:layer.id,name:layer.name,depth:layer.from,color:themeById(layer.theme).accent,
 model:models[i%models.length],x:33,z:-20+i*7,
 tint:layer.id==='ruins'?'#ffe4ad':layer.id==='machinery'?'#8db5bd':undefined,
 zone:{x:28.5,y:0,z:-20+i*7,radius:1.65,heightTolerance:.25,hysteresis:.3},
}));}
export const SURFACE_PORTALS=portalsFor(LAYERS);
export const PET_DISPLAYS=[
 {x:-28,z:25,color:'#9ce866'},
 {x:-22,z:25,color:'#a597ff'},
 {x:-16,z:25,color:'#ffa456'},
] as const;
export const HUB_PLACEMENTS=[
 ...SURFACE_PORTALS.map(p=>({asset:p.model,x:p.x,z:p.z,width:4.5,depth:2.8,height:3.8,y:0,yaw:-Math.PI/2,portalId:p.id,tint:p.tint})),
 ...PET_DISPLAYS.map((p,i)=>({asset:'egg-meadow' as const,x:p.x,z:p.z,width:3.7,depth:3.4,height:3.7,y:0,eggColor:i===0?undefined:p.color})),
];
// Keep browsing lanes and low interactive discs completely clear of scenery.
export function reserveHubSpace<T extends {asset:string;x:number;z:number;width:number}>(source:T):T{
 let p={...source};
 if(['crown-tree','oak-wide','oak-tall','maple-gold','maple-coral','birch-round','cedar-pillow','willow-dome'].includes(p.asset)&&p.x>17&&p.x<39&&p.z>18&&p.z<43)p={...p,x:38.2};
 if(['grass-tussock','flower-daisies','shrub-round','shrub-flower','shrub-berry','soft-shrub','mushroom-cluster'].includes(p.asset)){
  const d=Math.hypot(p.x,p.z-27),edge=11+p.width*.4;
  if(d<edge){const nx=d?p.x/d:1,nz=d?(p.z-27)/d:0;p={...p,x:nx*edge,z:27+nz*edge};}
  for(const trail of SURFACE_TRAILS)for(let i=1;i<trail.points.length;i++){
   const a=trail.points[i-1],b=trail.points[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
   const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[2])*dz)/(length*length)));
   const x=a[0]+dx*t,z=a[2]+dz*t,ox=p.x-x,oz=p.z-z,d=Math.hypot(ox,oz),edge=trail.width*.5+p.width*.45;
   if(d<edge)p={...p,x:x+(d?ox/d:-dz/length)*edge,z:z+(d?oz/d:dx/length)*edge};
  }
 }
 if(p.x>25&&p.x<39&&p.z>-25&&p.z<41)return {...p,x:38.2};
 if(p.x>-33&&p.x<-12&&p.z>19&&p.z<31)return {...p,z:38};
 return p;
}
