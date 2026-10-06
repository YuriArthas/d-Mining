import {ROOM_LAYOUT,type RoomLayout} from './roomLayout.ts';
import { resourceByKind } from './resources.ts';
import { themeById } from './themes.ts';
export type Layer = Readonly<{ id: string; name: string; from: number; theme: string; scene?:string; base: number; ores: readonly Readonly<{kind:number;weight:number}>[]; shop: boolean; room?:RoomLayout }>;
export const WORLD_DEPTH = 4000;
// The sole depth schedule. IDs remain stable when a layer moves.
export const LAYERS: readonly Layer[] = Object.freeze([
  {id:'surface',name:'草地矿场',from:0,theme:'meadow_mine',base:1,ores:[{kind:8,weight:20},{kind:3,weight:10},{kind:4,weight:7},{kind:16,weight:3}],shop:false},
  {id:'old_mine',name:'老矿井',from:400,theme:'timber_mine',scene:'timber-station-v2',base:2,ores:[{kind:1,weight:12},{kind:3,weight:8},{kind:4,weight:10},{kind:16,weight:8},{kind:17,weight:5},{kind:5,weight:3}],shop:false},
  {id:'fungal',name:'蘑菇洞穴',from:800,theme:'mushroom_cave',scene:'fungal-station-v1',base:9,ores:[{kind:2,weight:10},{kind:4,weight:9},{kind:17,weight:9},{kind:18,weight:7},{kind:25,weight:5}],shop:true},
  {id:'crystal',name:'水晶洞穴',from:1200,theme:'crystal_cave',scene:'crystal-station-v1',base:2,ores:[{kind:9,weight:10},{kind:6,weight:16},{kind:19,weight:10},{kind:20,weight:7},{kind:22,weight:3}],shop:false},
  {id:'ruins',name:'地下遗迹',from:1600,theme:'buried_ruins',scene:'ruins-station-v1',base:10,ores:[{kind:5,weight:12},{kind:18,weight:10},{kind:21,weight:7},{kind:25,weight:9}],shop:true},
  {id:'frozen',name:'冰封矿洞',from:2000,theme:'frozen_cave',scene:'frozen-station-v1',base:11,ores:[{kind:17,weight:9},{kind:6,weight:14},{kind:20,weight:10},{kind:22,weight:5}],shop:false},
  {id:'volcanic',name:'熔岩矿洞',from:2400,theme:'lava_cave',scene:'volcanic-station-v1',base:12,ores:[{kind:16,weight:5},{kind:23,weight:12},{kind:24,weight:12},{kind:21,weight:6},{kind:28,weight:5}],shop:true},
  {id:'fossil',name:'巨型化石',from:2800,theme:'fossil_cave',scene:'fossil-station-v1',base:13,ores:[{kind:5,weight:8},{kind:25,weight:10},{kind:26,weight:15},{kind:22,weight:7}],shop:false},
  {id:'machinery',name:'古代机械',from:3200,theme:'ancient_machine',scene:'machinery-station-v1',base:14,ores:[{kind:16,weight:4},{kind:27,weight:10},{kind:28,weight:13},{kind:29,weight:13}],shop:true},
  {id:'core',name:'地心秘境',from:3600,theme:'core_sanctum',scene:'core-station-v1',base:15,ores:[{kind:22,weight:7},{kind:29,weight:10},{kind:30,weight:14},{kind:31,weight:9}],shop:true},
].map(l => Object.freeze({...l, ores:Object.freeze(l.ores.map(o=>Object.freeze(o)))})));
export function validateLayers(layers: readonly Layer[]) {
  const ids = new Set<string>();
  for (const [i,l] of layers.entries()) {
    if(ids.has(l.id) || !Number.isInteger(l.from/2) || l.from<0 || l.from>=WORLD_DEPTH || (i===0?l.from!==0:l.from<=layers[i-1].from+20)) throw new Error(`无效楼层 ${l.id}`);
    const room=l.room??ROOM_LAYOUT;
    if(![room.centerX,room.centerZ,room.widthCells,room.depthCells,room.heightCells].every(Number.isInteger)
      ||room.widthCells<20||room.depthCells<20||room.heightCells<10||room.widthCells%2||room.depthCells%2
      ||Math.abs(room.centerX)+room.widthCells/2>48||Math.abs(room.centerZ)+room.depthCells/2>48)
      throw Error(`无效休整层尺寸 ${l.id}`);
    if(i>0&&l.from-room.heightCells*2<=layers[i-1].from)throw Error(`休整层高度重叠 ${l.id}`);
    if(i>0&&(room.centerX-room.widthCells/2>-4||room.centerX+room.widthCells/2<4||room.centerZ-room.depthCells/2>-4||room.centerZ+room.depthCells/2<4))throw Error(`休整层必须包含垂直入口 ${l.id}`);
    ids.add(l.id); themeById(l.theme); resourceByKind(l.base);
    const kinds=new Set([l.base]); let sum=0;
    for(const ore of l.ores) { resourceByKind(ore.kind); if(kinds.has(ore.kind)||!Number.isFinite(ore.weight)||ore.weight<=0)throw new Error(`无效矿物分布 ${l.id}`); kinds.add(ore.kind);sum+=ore.weight; }
    if(!Number.isFinite(sum))throw new Error(`矿物权重总和无效 ${l.id}`);
  }
  if(!layers.length)throw new Error('楼层配置为空');
}
validateLayers(LAYERS);
export function layerAtDepth(depth: number, layers: readonly Layer[] = LAYERS): Layer {
  let lo=0,hi=layers.length;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(layers[mid].from<=depth)lo=mid;else hi=mid;}
  return layers[lo];
}
