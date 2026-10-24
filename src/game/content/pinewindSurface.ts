import authored from './pinewind/authored.json' with {type:'json'};
import type {CampContent, SurfaceContent} from './campContent.ts';
import type {SessionContent} from '../application/SessionContent.ts';
import type {Solid, V3} from '../world/sceneryKit.ts';
import {JOURNEY_CAMP,JOURNEY_GENERATION} from './journeyCamp.ts';
import {CatmullRomCurve3,Vector3} from 'three';
import {CELL} from '../terrain/grid.ts';
import {
 PINEWIND_SERVICES, PINEWIND_PORTAL_SLOTS, PINEWIND_PORTAL_RADIUS, PINEWIND_EGG_DISPLAYS, PINEWIND_EGG_TIERS,
 PINEWIND_TERRACE, PINEWIND_STAIR_STEPS, PINEWIND_CREEK,
} from './pinewind/hubLayout.ts';
import type {AuthoredInstance, AuthoredLight} from './authoredSurface.ts';

type Root = {node:string;at:V3;rotation:[number,number,number,number];scale:V3};
const roots=authored.roots as Root[];
const root=(name:string)=>{const p=roots.find(r=>r.node===name);if(!p)throw Error(`Missing authored surface node ${name}`);return p;};
const instance=(name:string):AuthoredInstance=>({...root(name),asset:'pinewind-architecture',at:[...root(name).at],rotation:[...root(name).rotation],scale:[...root(name).scale]});
const rotation=(yaw:number):[number,number,number,number]=>[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];

/** Daytime light over the valley, chosen side by side on the public build (tools/check-lighting-tone):
 *  a strong warm-white sun from behind the arriving player, and a weak, nearly neutral sky/ground fill
 *  so shaded sides stay readable without the old cyan haze. Intensities assume exposure 1.08. */
export const PINEWIND_DAY={
 moonPosition:[-35,60,35] as [number,number,number],moonColor:'#ffeed2',moonIntensity:3.18,
 skyColor:'#d9e4ea',groundColor:'#867f5c',ambientIntensity:.38,environmentIntensity:.163,
} as const;

/** Terrace and stair shells; the egg terraces render as authored blocks. */
export const PINEWIND_TERRACE_SOLIDS:readonly Solid[]=[
 ...PINEWIND_EGG_TIERS.map(t=>({at:[t.x,t.y/2,(PINEWIND_TERRACE.minZ+PINEWIND_TERRACE.maxZ)/2],half:[PINEWIND_TERRACE.width/2,t.y/2,(PINEWIND_TERRACE.maxZ-PINEWIND_TERRACE.minZ)/2],yaw:0} as Solid)),
 ...PINEWIND_STAIR_STEPS.map(s=>({at:[s.x,s.y/2,s.z],half:[s.width/2,s.y/2,s.depth/2],yaw:0} as Solid)),
];

/** The Pinewind hub owns world 1's surface: its art, collision and the interaction zones
 *  players use there (sale, the pickaxe and backpack shops, portals, egg stands). Rules, saves, rooms and the other
 *  worlds come unchanged from the base content. */
export function withPinewindSurface(base:CampContent):CampContent {
 const shaft=base.surface.shaft;
 if(shaft.minX!==-8||shaft.maxX!==8||shaft.minZ!==-8||shaft.maxZ!==8)throw Error('Pinewind assets require the authored 16m square shaft; regenerate for changed dimensions');
 const eggIds=new Set((base.session.petContent?.eggs??[]).map(egg=>egg.id));
 const eggs=PINEWIND_EGG_DISPLAYS.filter(display=>eggIds.has(display.eggId));
 const portals=base.hub.portals.map(p=>{
  const slot=PINEWIND_PORTAL_SLOTS[p.id];if(!slot)throw Error(`Missing Pinewind portal slot: ${p.id}`);
  return {...p,...slot,zone:{...p.zone,x:slot.x,z:slot.z,radius:PINEWIND_PORTAL_RADIUS}};
 });
 const services=[PINEWIND_SERVICES.sale,PINEWIND_SERVICES.shop,PINEWIND_SERVICES.bags];
 const models=roots.filter(r=>!r.node.startsWith('Portal_')&&!r.node.startsWith('Egg_')).map(r=>instance(r.node));
 for(const [node,service] of [['Merchant_Store',PINEWIND_SERVICES.sale],['Copper_Forge',PINEWIND_SERVICES.shop],['Pack_Shop',PINEWIND_SERVICES.bags]] as const){
  const p=models.find(r=>r.node===node)!;p.at=[service.placement.x,0,service.placement.z];p.rotation=rotation(service.placement.yaw);
 }
 for(const p of eggs){const model=instance('Egg_'+p.id);model.at=[p.x,p.y,p.z];model.rotation=rotation(p.yaw);models.push(model);}
 // Each portal uses its own model: its baked light belongs to its own slot.
 for(const p of portals){const model=instance('Portal_'+p.id);model.at=[p.x,0,p.z];model.rotation=rotation(p.yaw);model.portalId=p.id;models.push(model);}
 for(const model of models)model.ground=model.node==='Creek_Bridge'||model.node?.startsWith('Terrace')===true;
 models.unshift({asset:'pinewind-landscape',at:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]});
 const solids:Solid[]=[...authored.solids as Solid[],...PINEWIND_TERRACE_SOLIDS,...services.map(s=>s.solid)];
 for(const p of eggs)solids.push({at:[p.x,p.y+1.5,p.z],half:[.95,1.5,.95],yaw:0});
 for(const p of portals)solids.push({at:[p.x,.08,p.z],half:[1.3,.08,1],yaw:p.yaw});
 for(const p of portals)for(const sign of [-1,1])solids.push({at:[p.x+Math.cos(p.yaw)*1.05*sign,1.5,p.z-Math.sin(p.yaw)*1.05*sign],half:[.25,1.5,.25],yaw:p.yaw});
 const surface:SurfaceContent={...base.surface,placements:[],profiles:{},
  authored:{version:'pinewind-plaza-v4',instances:models,groundAssets:['pinewind-landscape'],opensSpawnPassage:true,light:{...authored.light,sun:authored.light.sun as [number,number,number]} satisfies AuthoredLight},
  plan:{shapes:services.map(s=>s.ring),signs:services.map(s=>s.sign),solids},
 };
 // The first entries of sales/shops are world 1's surface services (see sessionContentFor); the backpack
 // shop joins right after the pickaxe shop and opens on its own counter.
 const surfaceShop=base.session.shops.findIndex(s=>s.id==='surface-upgrade');
 if(surfaceShop<0)throw Error('Base content lacks the surface shop');
 const session:SessionContent={...base.session,
  sunkenSurface:CREEK_CELLS,
  sales:[PINEWIND_SERVICES.sale.trigger,...base.session.sales.slice(1)],
  shops:base.session.shops.flatMap((s,i)=>i===surfaceShop?[{...s,zone:PINEWIND_SERVICES.shop.trigger,category:'tools' as const},{id:PINEWIND_SERVICES.bags.id,zone:PINEWIND_SERVICES.bags.trigger,category:'backpacks' as const}]:[s]),
  portals,
  eggStations:eggs.map(p=>({id:p.id,eggId:p.eggId,promptAnchor:[p.x,p.y+4.85,p.z] as const,
   // Stand in front of the egg (eggs face the plaza along their yaw).
   zone:{x:p.x+Math.sin(p.yaw)*2,y:p.y,z:p.z+Math.cos(p.yaw)*2,radius:1.3,heightTolerance:.35,hysteresis:.3}})),
 };
 return {...base,session,surface,hub:{...base.hub,portals,eggs},
  environment:{...base.environment,initialTime:'day',
   surface:{...base.environment.surface,day:{...base.environment.surface.day,...PINEWIND_DAY}},
   // The sky's sun disc and its image-based light follow the same sun.
   sky:{...base.environment.sky,lighting:{...base.environment.sky.lighting,day:{moonPosition:PINEWIND_DAY.moonPosition,environmentIntensity:PINEWIND_DAY.environmentIntensity}}}}};
}
/** The creek's floor cells: cut from the voxel meshes, and counted as surface when standing in the creek. */
const CREEK_CELLS=creekFloorCells();
export const PINEWIND_CAMP=withPinewindSurface(JOURNEY_CAMP);

/** Surface floor cells under the sunken creek and its banks: every cell whose square reaches the corridor,
 *  inside the authored ground (-96..104 m, which covers the cut from above). */
export function creekFloorCells(): number[] {
 const {points,width,bank}=PINEWIND_CREEK,line=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z))).getPoints(220);
 const reach=width.base+width.wave+bank+Math.SQRT2*CELL/2,cells=new Map<string,[number,number]>();
 for(let i=0;i<line.length-1;i++){
  const a=line[i],b=line[i+1],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz||1;
  for(let cx=Math.floor((Math.min(a.x,b.x)-reach)/CELL);cx<=Math.floor((Math.max(a.x,b.x)+reach)/CELL);cx++)
   for(let cz=Math.floor((Math.min(a.z,b.z)-reach)/CELL);cz<=Math.floor((Math.max(a.z,b.z)+reach)/CELL);cz++){
    if(cx<-48||cx>51||cz<-48||cz>51)continue;
    const x=(cx+.5)*CELL,z=(cz+.5)*CELL,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length2));
    if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<reach)cells.set(cx+','+cz,[cx,cz]);
   }
 }
 return [...cells.values()].flat();
}
/** World 1's terrain with the creek bed cut out of the voxel floor meshes (version unchanged: saves still fit). */
export const PINEWIND_GENERATION=Object.freeze({...JOURNEY_GENERATION,surfaceCut:CREEK_CELLS});
