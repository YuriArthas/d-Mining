/** The three worlds: each is a surface plus six rest layers, built from the layer templates with its own
 *  blocks and ores. World 1 keeps the original layer ids; later worlds' rooms sit at their world's Z offset. */
import { LAYERS, type Layer } from './layers.ts';
import { roomsFor } from '../world/rooms.ts';
import { WORLD_REQUIREMENTS } from './worldJourney.ts';

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
