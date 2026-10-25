/** The three worlds: each is a surface plus six rest layers, built from the layer templates with its own
 *  blocks and ores, and its depths, dense rock and ore share from economy.json. World 1 keeps the original layer ids; later worlds' rooms sit at their world's Z offset. */
import { LAYER_TEMPLATES, validateLayers, type Layer } from './layers.ts';
import { roomsFor } from '../world/rooms.ts';
import { WORLD_REQUIREMENTS } from './worldJourney.ts';
import { layerEconomy } from './economy.ts';

export const JOURNEY_WORLDS = WORLD_REQUIREMENTS.map(world => {
  const T = LAYER_TEMPLATES, templates = world.id===1 ? T.slice(0,7) : world.id===2 ? [T[0],T[10],T[12],T[13],T[14],T[15],T[11]] : [T[0],T[7],T[8],T[3],T[4],T[5],T[9]];
  const layers: readonly Layer[] = templates.map(({laterScene,...source},local) => {
    const index=(world.id-1)*7+local, base=64+index*4, numbers=layerEconomy(world.id,local);
    return {...source,scene:world.id===1?source.scene:laterScene??source.scene,id:world.id===1?source.id:`world${world.id}.${local}`,
      from:numbers.from,base,deepKind:base+1,deepAt:numbers.deepAt,oreChance:numbers.oreChance,
      name:local===0?world.name+'矿场':source.name,
      ores:numbers.ores.map((ore,j)=>({kind:base+2+j,weight:ore.weight})),shop:local>0&&local%2===0};
  });
  validateLayers(layers);
  const localRooms=roomsFor(layers);
  const rooms=localRooms.map(r=>({...r,z:r.z+world.z,spawn:[r.spawn[0],r.spawn[1],r.spawn[2]+world.z] as const,
    sell:{...r.sell,z:r.sell.z+world.z},shop:r.shop?{...r.shop,z:r.shop.z+world.z}:null,worldId:world.id}));
  return {...world,layers,rooms,localRooms};
});
