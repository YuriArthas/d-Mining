import {GRASS_CONFIG} from '../content/grass.ts';
import {SURFACE_SITE} from './SurfaceSite.ts';
import {surfaceGrassAllowed} from './surfaceLayout.ts';
import {QUARRY_SOLIDS} from './QuarryLayout.ts';
import {pondDistance} from './SurfacePonds.ts';
export type GrassPlacement={x:number;z:number;scale:number;yaw:number;variant:number;tone:number;batch:number};
const obstacles=QUARRY_SOLIDS.filter(s=>s.at[1]-s.half[1]<.3&&s.at[1]+s.half[1]>.25);
export function grassAllowed(x:number,z:number){
 if(pondDistance(x,z)<1.35)return false;
 const b=SURFACE_SITE.construction;
 if(x<b.minX+.5||x>b.maxX-.5||z<b.minZ+.5||z>b.maxZ-.5||!surfaceGrassAllowed(x,z))return false;
 if(Math.abs(x)<14&&Math.abs(z)<14)return false;
 for(const a of [SURFACE_SITE.pet,SURFACE_SITE.portal])if(x>a.minX-.5&&x<a.maxX+.5&&z>a.minZ-.5&&z<a.maxZ+.5)return false;
 for(const s of obstacles){const dx=x-s.at[0],dz=z-s.at[2],c=Math.cos(s.yaw??0),n=Math.sin(s.yaw??0);if(Math.abs(c*dx-n*dz)<s.half[0]+.38&&Math.abs(n*dx+c*dz)<s.half[2]+.38)return false;}
 return true;
}
export function planGrass(count:number=GRASS_CONFIG.count):readonly GrassPlacement[]{
 let seed:number=GRASS_CONFIG.seed;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const result:GrassPlacement[]=[],cells=new Map<string,GrassPlacement[]>();const cellSize=GRASS_CONFIG.cellSize;
 for(let attempt=0;attempt<GRASS_CONFIG.attempts&&result.length<count;attempt++){
  const cx=GRASS_CONFIG.patches.minX+random()*GRASS_CONFIG.patches.width,cz=GRASS_CONFIG.patches.minZ+random()*GRASS_CONFIG.patches.depth;
  // Broken patches, never a uniformly spaced carpet. Stable seed and transforms.
  const patch=Math.sin(cx*.27+Math.sin(cz*.15))*Math.cos(cz*.24);
  if(patch<-.1)continue;
  for(let j=0;j<GRASS_CONFIG.patches.blades&&result.length<count;j++){
   const a=random()*Math.PI*2,r=Math.sqrt(random())*GRASS_CONFIG.patches.radius,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
   if(!grassAllowed(x,z))continue;
   const gx=Math.floor(x/cellSize),gz=Math.floor(z/cellSize);let close=false;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(cells.get(`${gx+dx},${gz+dz}`)?.some(p=>Math.hypot(p.x-x,p.z-z)<GRASS_CONFIG.spacing))close=true;
   if(close)continue;
   const variant=result.length%2,batch=(Math.min(2,Math.floor((x+34)/27))*2+(z<30?0:1))*2+variant;
   const p={x,z,scale:GRASS_CONFIG.scale.min+random()*GRASS_CONFIG.scale.range,yaw:random()*Math.PI*2,variant,tone:random(),batch};
   const key=`${gx},${gz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(p);result.push(p);
  }
 }
 if(result.length!==count)throw Error(`草簇可用区域不足: ${result.length}/${count}`);
 return result;
}
