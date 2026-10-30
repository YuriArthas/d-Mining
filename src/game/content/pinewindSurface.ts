import authored from './pinewind/authored.json' with {type:'json'};
import type {HubEgg, SurfaceContent} from './gameContent.ts';
import type {Solid, V3} from '../world/sceneryKit.ts';
import type {RestRoom} from '../world/rooms.ts';
import {ENTRANCE_WORLD} from '../world/entrance.ts';
import {CatmullRomCurve3,Vector3} from 'three';
import {CELL} from '../terrain/grid.ts';
import {PINEWIND_SERVICES, PINEWIND_STATION, PINEWIND_STATION_SIGN, PINEWIND_PORTAL_SIGN, PINEWIND_CREEK} from './pinewind/hubLayout.ts';
import type {AuthoredInstance, AuthoredLight} from './authoredSurface.ts';
import {worldAtZ} from './worldJourney.ts';
import {placeProp, placement, type PropCollision} from '../world/propCollision.ts';

/** A Blender model of the valley (build_architecture.py) and its collision in its own frame (collision.py). */
type Root = {node:string;at:V3;rotation:[number,number,number,number];scale:V3;collision:PropCollision};
const roots=authored.roots as Root[];
const root=(name:string)=>{const p=roots.find(r=>r.node===name);if(!p)throw Error(`Missing authored surface node ${name}`);return p;};
const instance=(name:string):AuthoredInstance=>{const r=root(name);return {node:r.node,asset:'pinewind-architecture',at:[...r.at],rotation:[...r.rotation],scale:[...r.scale]};};
const rotation=(yaw:number):[number,number,number,number]=>[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];

/** World 1's surface: the authored Pinewind valley (its art, collision, signs and service rings) and the
 *  rest halls built with the same pipeline in their rooms below (world 1's load with it, the later worlds' when
 *  the player first goes there). Every model brings its colliders, placed where the model stands; the gate's
 *  doors are left out (the portal sheet closes the opening). */
export function pinewindSurface(rooms:readonly RestRoom[],eggs:readonly HubEgg[]):SurfaceContent {
 const services=[PINEWIND_SERVICES.sale,PINEWIND_SERVICES.shop,PINEWIND_SERVICES.bags];
 const models=roots.filter(r=>!r.node.startsWith('Egg_')&&!r.node.startsWith('World_Gate_Door')).map(r=>instance(r.node));
 {const p=models.find(r=>r.node==='Teleport_Station');if(!p)throw Error('Missing authored surface node Teleport_Station');p.at=[PINEWIND_STATION.x,0,PINEWIND_STATION.z];p.rotation=rotation(PINEWIND_STATION.yaw);}
 for(const [node,service] of [['Merchant_Store',PINEWIND_SERVICES.sale],['Copper_Forge',PINEWIND_SERVICES.shop],['Pack_Shop',PINEWIND_SERVICES.bags]] as const){
  const p=models.find(r=>r.node===node)!;p.at=[service.placement.x,0,service.placement.z];p.rotation=rotation(service.placement.yaw);
 }
 for(const p of eggs){const model=instance('Egg_'+p.id);model.at=[p.x,p.y,p.z];model.rotation=rotation(p.yaw);models.push(model);}
 for(const model of models)model.ground=model.node==='Creek_Bridge'||model.node?.startsWith('Terrace')===true;
 for(const room of rooms){const hall=room.sceneDefinition?.hall;if(hall)models.push({asset:hall,at:[room.x,-room.depth,room.z],rotation:[0,0,0,1],scale:[1,1,1],world:worldAtZ(room.z)});}
 models.unshift({asset:'pinewind-landscape',at:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]});
 // The landscape's ground, trunks and cliffs, then every model's colliders where it stands.
 const solids:Solid[]=[...authored.solids as Solid[],...models.flatMap(m=>m.node?placeProp(m.node,root(m.node).collision,placement(m.at,m.rotation,m.scale)):[])];
 return {
  authored:{version:'pinewind-plaza-v4',instances:models,light:{...authored.light,sun:authored.light.sun as [number,number,number]} satisfies AuthoredLight},
  plan:{shapes:services.map(s=>s.ring),signs:[...services.map(s=>s.sign),PINEWIND_STATION_SIGN,PINEWIND_PORTAL_SIGN],solids},
  shaft:ENTRANCE_WORLD,
 };
}
/** The creek's floor cells: cut from the voxel meshes, and counted as surface when standing in the creek. */
export const CREEK_CELLS=creekFloorCells();
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
