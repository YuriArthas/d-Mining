import {ROOM_LAYOUT,type RoomLayout} from './roomLayout.ts';
import { resourceByKind } from './resources.ts';
import { themeById } from './themes.ts';
import { message, type TextRef } from '../i18n/messages.ts';
/** `deepAt`: metres below `from` where the rock turns dense (`deepKind`); `oreChance`: the share of cells that are ore. */
export type Layer = Readonly<{ id: string; name: TextRef; from: number; theme: string; scene?:string; base: number; deepKind?: number; deepAt?: number | null;
  oreChance: number; ores: readonly Readonly<{kind:number;weight:number}>[]; shop: boolean; room?:RoomLayout }>;
export const WORLD_DEPTH = 4000;
/** The ten layer looks the worlds are built from: name, theme and rest-room scene. Each world picks seven
 *  (surface plus six rest layers) and gives them their own depths, blocks and ores (journeyWorlds.ts). */
/** `scene`: world 1's room scene (an authored hall); `laterScene`: the kit scene worlds 2 and 3 use instead. */
type LayerTemplate = Readonly<{ id: string; name: TextRef; theme: string; scene?: string; laterScene?: string }>;
export const LAYER_TEMPLATES: readonly LayerTemplate[] = Object.freeze([
  {id:'surface',name:message("msg.meadow_mine"),theme:'meadow_mine'},
  {id:'old_mine',name:message("msg.old_mine"),theme:'timber_mine',scene:'old-mine-hall'},
  {id:'fungal',name:message("msg.mushroom_cave"),theme:'mushroom_cave',scene:'fungal-hall'},
  {id:'crystal',name:message("msg.crystal_cave"),theme:'crystal_cave',scene:'crystal-hall',laterScene:'crystal-station-v1'},
  {id:'ruins',name:message("msg.buried_ruins"),theme:'buried_ruins',scene:'ruins-hall',laterScene:'ruins-station-v1'},
  {id:'frozen',name:message("msg.frozen_mine"),theme:'frozen_cave',scene:'frozen-hall',laterScene:'frozen-station-v1'},
  {id:'volcanic',name:message("msg.lava_mine"),theme:'lava_cave',scene:'volcanic-hall'},
  {id:'fossil',name:message("msg.giant_fossils"),theme:'fossil_cave',scene:'fossil-station-v1'},
  {id:'machinery',name:message("msg.ancient_machines"),theme:'ancient_machine',scene:'machinery-station-v1'},
  {id:'core',name:message("msg.core_sanctum"),theme:'core_sanctum',scene:'core-station-v1'},
  {id:'automine',name:message("msg.automated_mineway"),theme:'ancient_machine',scene:'automine-hall'},
  {id:'reactor',name:message("msg.core_reactor"),theme:'core_sanctum',scene:'reactor-hall'},
  {id:'gear',name:message("msg.giant_gear_works"),theme:'ancient_machine',scene:'gear-hall'},
  {id:'refinery',name:message("msg.crystal_refinery"),theme:'crystal_cave',scene:'refinery-hall'},
  {id:'survey',name:message("msg.ruins_survey_station"),theme:'buried_ruins',scene:'survey-hall'},
  {id:'cryo',name:message("msg.cryo_lab"),theme:'frozen_cave',scene:'cryo-hall'},
].map(l => Object.freeze(l)));
export function validateLayers(layers: readonly Layer[]) {
  const ids = new Set<string>(), bases = new Set<number>();
  for (const [i,l] of layers.entries()) {
    if(ids.has(l.id) || !Number.isInteger(l.from/2) || l.from<0 || l.from>=WORLD_DEPTH || (i===0?l.from!==0:l.from<=layers[i-1].from+20)) throw new Error(`无效楼层 ${l.id}`);
    const room=l.room??ROOM_LAYOUT;
    if(![room.centerX,room.centerZ,room.widthCells,room.depthCells,room.heightCells].every(Number.isInteger)
      ||room.widthCells<20||room.depthCells<20||room.heightCells<10||room.widthCells%2||room.depthCells%2
      ||Math.abs(room.centerX)+room.widthCells/2>48||Math.abs(room.centerZ)+room.depthCells/2>48)
      throw Error(`无效休整层尺寸 ${l.id}`);
    if(i>0&&l.from-room.heightCells*2<=layers[i-1].from)throw Error(`休整层高度重叠 ${l.id}`);
    if(i>0&&(room.centerX-room.widthCells/2>-4||room.centerX+room.widthCells/2<4||room.centerZ-room.depthCells/2>-4||room.centerZ+room.depthCells/2<4))throw Error(`休整层必须包含垂直入口 ${l.id}`);
    ids.add(l.id); themeById(l.theme);
    // A theme block belongs to exactly one layer; ore pools contain ores only.
    if(!resourceByKind(l.base).base) throw new Error(`楼层基础资源不是主题方块: ${l.id}`);
    if(bases.has(l.base)) throw new Error(`主题方块不能跨层复用: ${l.id}`);
    bases.add(l.base);
    const kinds=new Set([l.base]); let sum=0;
    for(const ore of l.ores) { if(resourceByKind(ore.kind).base)throw new Error(`矿物池不能包含主题方块: ${l.id}`); if(kinds.has(ore.kind)||!Number.isFinite(ore.weight)||ore.weight<=0)throw new Error(`无效矿物分布 ${l.id}`); kinds.add(ore.kind);sum+=ore.weight; }
    if(!Number.isFinite(sum)||!(l.oreChance>=0&&l.oreChance<1))throw new Error(`矿物权重或概率无效 ${l.id}`);
  }
  if(!layers.length)throw new Error('楼层配置为空');
}
export function layerAtDepth(depth: number, layers: readonly Layer[]): Layer {
  let lo=0,hi=layers.length;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(layers[mid].from<=depth)lo=mid;else hi=mid;}
  return layers[lo];
}
