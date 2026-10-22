import { createCampContent, type CampContent } from './campContent.ts';
import { LAYERS, type Layer } from './layers.ts';
import { roomsFor } from '../world/rooms.ts';
import { roomPlan } from '../world/scenery.ts';
import type { ScenerySite } from '../presentation/SceneryCollision.ts';
import { WORLD_REQUIREMENTS, worldSpawn, worldAtZ, type WorldId } from './worldJourney.ts';
import { PET_CONTENT } from './pets.ts';
import { JOURNEY_RESOURCES } from './journeyResources.ts';
import { EGG_STAGES } from './progression.ts';

export const JOURNEY_WORLDS = WORLD_REQUIREMENTS.map(world => {
  const templates = world.id===1 ? LAYERS.slice(0,7) : [LAYERS[0],LAYERS[7],LAYERS[8],LAYERS[3],LAYERS[4],LAYERS[5],LAYERS[9]];
  const layers: readonly Layer[] = templates.map((source,local) => {
    const index=(world.id-1)*7+local, base=64+index*4;
    return {...source,id:world.id===1?source.id:`world${world.id}.${local}`,from:local*400,base,deepKind:base+1,
      name:local===0?world.name+'矿场':source.name,
      ores:[{kind:base+2,weight:12},{kind:base+3,weight:10}],shop:local>0&&local%2===0};
  });
  const localRooms=roomsFor(layers);
  const rooms=localRooms.map(r=>({...r,z:r.z+world.z,spawn:[r.spawn[0],r.spawn[1],r.spawn[2]+world.z] as const,
    sell:{...r.sell,z:r.sell.z+world.z},shop:r.shop?{...r.shop,z:r.shop.z+world.z}:null,worldId:world.id}));
  return {...world,layers,rooms,localRooms};
});
export const JOURNEY_CAMP: CampContent = (() => {
  const first=createCampContent(JOURNEY_WORLDS[0].layers);
  const destinations=JOURNEY_WORLDS.flatMap(w=>w.rooms.map(r=>({...r,worldId:w.id,roomBounds:{minX:r.x-r.layout.widthCells,maxX:r.x+r.layout.widthCells,minZ:r.z-r.layout.depthCells,maxZ:r.z+r.layout.depthCells,floor:-r.depth,ceiling:-r.depth+r.layout.heightCells*2}})));
  const extraSites:ScenerySite[]=JOURNEY_WORLDS.slice(1).flatMap(w=>w.localRooms.map(r=>({id:r.id,depth:r.depth,z:w.z,plan:roomPlan(r)})));
  const laterEggs: Record<string,string> = {fossil:'world2.1',machinery:'world2.2',core:'world3.6'};
  return {...first,worlds:JOURNEY_WORLDS,extraSites,
    session:{...first.session,journey:true,destinations,
      petContent:{...PET_CONTENT,eggs:PET_CONTENT.eggs.map(e=>({...e,price:JOURNEY_RESOURCES[(EGG_STAGES[e.id][0]<=6?EGG_STAGES[e.id][0]:EGG_STAGES[e.id][0]===7?8:EGG_STAGES[e.id][0]===8?9:20)*4].price*100,requiredDestination:e.requiredDestination?(laterEggs[e.requiredDestination]??e.requiredDestination):undefined}))},
      sales:[...first.session.sales,...JOURNEY_WORLDS.slice(1).flatMap(w=>[{x:-16,y:0,z:w.z+44,radius:3,heightTolerance:.3,hysteresis:.3},...w.rooms.map(r=>r.sell)])],
      shops:[...first.session.shops,...JOURNEY_WORLDS.slice(1).flatMap(w=>[{id:`world${w.id}.shop`,zone:{x:16,y:0,z:w.z+44,radius:3,heightTolerance:.3,hysteresis:.3}},...w.rooms.filter(r=>r.shop).map(r=>({id:r.id,zone:r.shop!}))])],
      homes:WORLD_REQUIREMENTS.map(w=>({worldId:w.id,zone:{x:0,y:0,z:worldSpawn(w.id)[2],radius:6,heightTolerance:.3,hysteresis:.3}})),
    },
  };
})();
export function journeyLayersAt(z:number) { return JOURNEY_WORLDS[worldAtZ(z)-1].layers; }
export const JOURNEY_GENERATION = Object.freeze({version:11,seed:0,samples:false,layers:JOURNEY_CAMP.layers,worlds:JOURNEY_CAMP.worlds!});
