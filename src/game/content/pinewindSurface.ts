import authored from './pinewind/authored.json' with {type:'json'};
import type {CampContent, SurfaceContent} from './campContent.ts';
import type {Solid, V3} from '../world/sceneryKit.ts';
import {SURFACE_SERVICES} from '../world/surfaceLayout.ts';
import {PET_TERRACE_SOLIDS} from '../world/PetTerraces.ts';
import {JOURNEY_CAMP} from './journeyCamp.ts';

import type {AuthoredInstance} from './authoredSurface.ts';
type Root = {node:string;at:V3;rotation:[number,number,number,number];scale:V3};
const roots=authored.roots as Root[];
const root=(name:string)=>{const p=roots.find(r=>r.node===name);if(!p)throw Error(`Missing authored surface node ${name}`);return p;};
const instance=(name:string):AuthoredInstance=>({...root(name),asset:'pinewind-architecture',at:[...root(name).at],rotation:[...root(name).rotation],scale:[...root(name).scale]});
const rotation=(yaw:number):[number,number,number,number]=>[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];

/** Presentation-only composition. Session, save, terrain, tutorial and world data
 * are borrowed unchanged. Instances and collision receive the same injected hubs. */
export function withPinewindSurface(base:CampContent):CampContent {
 const shaft=base.surface.shaft;
 if(shaft.minX!==-8||shaft.maxX!==8||shaft.minZ!==-8||shaft.maxZ!==8)throw Error('Pinewind assets require the authored 16m square shaft; regenerate for changed dimensions');
 const models=roots.filter(r=>!r.node.startsWith('Portal_')&&!r.node.startsWith('Egg_')).map(r=>instance(r.node));
 for(const [node,service] of [['Merchant_Store',SURFACE_SERVICES.sale],['Copper_Forge',SURFACE_SERVICES.shop]] as const){
  const p=models.find(r=>r.node===node)!;p.at=[service.placement.x,0,service.placement.z];p.rotation=rotation(service.placement.yaw);
 }
 for(const p of base.hub.eggs){const model=instance('Egg_'+p.id);model.at=[p.x,p.y,p.z];model.rotation=rotation(p.yaw);models.push(model);}
 for(const p of base.hub.portals){const model=instance('Portal_old_mine');model.at=[p.x,0,p.z];model.rotation=rotation(p.yaw);model.portalId=p.id;models.push(model);}
 for(const model of models)model.ground=model.node==='Creek_Bridge'||model.node?.startsWith('Terrace')===true;
 models.unshift({asset:'pinewind-landscape',at:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]});
 const solids:Solid[]=[...authored.solids as Solid[],...PET_TERRACE_SOLIDS,...Object.values(SURFACE_SERVICES).map(s=>s.solid),{at:[34,3,8],half:[4.5,3,3.5],yaw:0}];
 for(const p of base.hub.eggs)solids.push({at:[p.x,p.y+1.5,p.z],half:[.95,1.5,.95],yaw:0});
 for(const p of base.hub.portals)solids.push({at:[p.x,.08,p.z],half:[1.3,.08,1],yaw:p.yaw});
 for(const p of base.hub.portals)for(const sign of [-1,1])solids.push({at:[p.x+Math.cos(p.yaw)*1.05*sign,1.5,p.z-Math.sin(p.yaw)*1.05*sign],half:[.25,1.5,.25],yaw:p.yaw});
 const services=Object.values(SURFACE_SERVICES);
 const surface:SurfaceContent={...base.surface,placements:[],profiles:{},
  authored:{version:'pinewind-master-v2',instances:models,groundAssets:['pinewind-landscape'],opensSpawnPassage:true},
  plan:{shapes:services.map(s=>s.ring),signs:services.map(s=>s.sign),solids},
 };
 return {...base,surface,environment:{...base.environment,initialTime:'day',surface:{...base.environment.surface,day:{...base.environment.surface.day,moonPosition:[-35,65,45],moonColor:'#fff2d9',moonIntensity:2.15,skyColor:'#c6e7ff',groundColor:'#78954e',ambientIntensity:1.25}}}};
}
export const PINEWIND_CAMP=withPinewindSurface(JOURNEY_CAMP);
