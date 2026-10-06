import coreKit from '../../assets/rooms/core-v1.json' with {type:'json'};
import coreLayout from './core.layout.json' with {type:'json'};
import machineryKit from '../../assets/rooms/machinery-v1.json' with {type:'json'};
import machineryLayout from './machinery.layout.json' with {type:'json'};
import fossilKit from '../../assets/rooms/fossil-v1.json' with {type:'json'};
import fossilLayout from './fossil.layout.json' with {type:'json'};
import volcanicKit from '../../assets/rooms/volcanic-v1.json' with {type:'json'};
import volcanicLayout from './volcanic.layout.json' with {type:'json'};
import frozenKit from '../../assets/rooms/frozen-v1.json' with {type:'json'};
import frozenLayout from './frozen.layout.json' with {type:'json'};
import ruinsKit from '../../assets/rooms/ruins-v1.json' with {type:'json'};
import ruinsLayout from './ruins.layout.json' with {type:'json'};
import crystalKit from '../../assets/rooms/crystal-v1.json' with {type:'json'};
import crystalLayout from './crystal.layout.json' with {type:'json'};
import fungalKit from '../../assets/rooms/fungal-v1.json' with {type:'json'};
import fungalLayout from './fungal.layout.json' with {type:'json'};
import kit from '../../assets/rooms/old-mine-v2.json' with {type:'json'};
import layout from './oldMine.layout.json' with {type:'json'};
import type {RoomSceneAsset, RoomLayoutData} from './authoredRoom.ts';
// Heavy content is imported only by scene planning, never by terrain occupancy queries.
const ASSETS: Readonly<Record<string,RoomSceneAsset>> = {
  'ruins-v1': {kit:ruinsKit,layout:ruinsLayout as RoomLayoutData},
  'frozen-v1': {kit:frozenKit,layout:frozenLayout as RoomLayoutData},
  'volcanic-v1': {kit:volcanicKit,layout:volcanicLayout as RoomLayoutData},
  'fossil-v1': {kit:fossilKit,layout:fossilLayout as RoomLayoutData},
  'machinery-v1': {kit:machineryKit,layout:machineryLayout as RoomLayoutData},
  'core-v1': {kit:coreKit,layout:coreLayout as RoomLayoutData},
  'old-mine-v2': {kit,layout:layout as RoomLayoutData},
  'fungal-v1': {kit:fungalKit,layout:fungalLayout as RoomLayoutData},
  'crystal-v1': {kit:crystalKit,layout:crystalLayout as RoomLayoutData},
};
export function roomSceneAsset(id:string):RoomSceneAsset {
  const asset=ASSETS[id];
  if(!asset)throw Error(`未知房间资产: ${id}`);
  return asset;
}
