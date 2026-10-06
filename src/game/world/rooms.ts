import {roomScene, ROOM_SCENES, LEGACY_ROOM_REFERENCE, LEGACY_ROOM_FACILITIES} from '../content/rooms/sceneDefinitions.ts';
import type {RoomSceneDefinition, RoomZone} from '../content/rooms/authoredRoom.ts';
import {ROOM_LAYOUT} from '../content/roomLayout.ts';
import { SURFACE_HOME, SURFACE_SALE } from './surfaceLayout.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
import { CELL } from '../terrain/grid.ts';
import {ENTRANCE_WORLD} from './entrance.ts';
import type { ZoneConfig } from '../logic/ZoneDetector.ts';

export function roomsFor(layers: readonly Layer[],definitions:Readonly<Record<string,RoomSceneDefinition>>=ROOM_SCENES) {
 return Object.freeze(layers.slice(1).map((l,index)=>{
  const layout=l.room??ROOM_LAYOUT,x=layout.centerX*CELL,z=layout.centerZ*CELL;
  const sceneDefinition=l.scene?roomScene(l.scene,definitions):undefined;
  const reference=sceneDefinition?.referenceSize??LEGACY_ROOM_REFERENCE;
  const scale=[layout.widthCells*CELL/reference[0],layout.heightCells*CELL/reference[1],layout.depthCells*CELL/reference[2]];
  const facilities=sceneDefinition?.facilities??LEGACY_ROOM_FACILITIES;
  if(l.shop&&!facilities.shop)throw Error(`房间缺少商店位置: ${l.id}`);
  const point=(at:readonly number[])=>[x+at[0]*scale[0],-l.from+at[1]*scale[1],z+at[2]*scale[2]] as const;
  if(sceneDefinition)for(const [name,facility] of Object.entries(facilities)){
    if(!facility||(name==='shop'&&!l.shop))continue;
    const [px,py,pz]=point(facility.at);
    if(Math.abs(px-x)>=layout.widthCells*CELL/2||Math.abs(pz-z)>=layout.depthCells*CELL/2||py< -l.from||py>= -l.from+layout.heightCells*CELL)throw Error(`房间功能点越界 ${l.id}: ${name}`);
    if(px>ENTRANCE_WORLD.minX&&px<ENTRANCE_WORLD.maxX&&pz>ENTRANCE_WORLD.minZ&&pz<ENTRANCE_WORLD.maxZ)throw Error(`房间功能点占用垂直入口 ${l.id}: ${name}`);
  }
  const zone=(source:RoomZone):ZoneConfig=>{const [x,y,z]=point(source.at);return {x,y,z,radius:source.radius,heightTolerance:source.heightTolerance,hysteresis:source.hysteresis};};
  const spawn=point(facilities.spawn.at);
  return Object.freeze({id:l.id,name:l.name,number:index+2,depth:l.from,x,z,width:layout.widthCells,height:layout.heightCells,
   layout,theme:l.theme,scene:l.scene,sceneDefinition,spawn:[spawn[0],spawn[1]+facilities.spawn.clearance,spawn[2]] as const,
   sell:zone(facilities.sell),shop:l.shop?zone(facilities.shop!):null});
 }));
}
export const ROOMS = roomsFor(LAYERS);
export type RestRoom = typeof ROOMS[number];
export const HOME_ZONE: ZoneConfig = SURFACE_HOME;
// Query only procedural occupancy. No voxel allocation or excavation records.
// A floor bounds the air just above it. Look up the layer 10 cells below the sample;
// this avoids scanning all rooms on every procedural voxel query.
const footprintBounds=new WeakMap<readonly Layer[],{minX:number;maxX:number;minZ:number;maxZ:number}>();
function insideAnyRoomBounds(x:number,z:number,layers:readonly Layer[]){
 let bounds=footprintBounds.get(layers);
 if(!bounds){
  const rooms=layers.slice(1).map(l=>l.room??ROOM_LAYOUT);
  bounds={minX:Math.min(...rooms.map(r=>r.centerX-r.widthCells/2)),maxX:Math.max(...rooms.map(r=>r.centerX+r.widthCells/2)),minZ:Math.min(...rooms.map(r=>r.centerZ-r.depthCells/2)),maxZ:Math.max(...rooms.map(r=>r.centerZ+r.depthCells/2))};
  footprintBounds.set(layers,bounds);
 }
 return x>=bounds.minX&&x<bounds.maxX&&z>=bounds.minZ&&z<bounds.maxZ;
}
// Room below this cell: lower-bound lookup avoids a fixed-height assumption or scanning all layers.
function layerBelowCell(y:number,layers:readonly Layer[]){
 const depth=-y*CELL;let lo=1,hi=layers.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(layers[mid].from<depth)lo=mid+1;else hi=mid;}
 return layers[lo];
}
function inRoomFootprint(x:number,z:number,layout:typeof ROOM_LAYOUT){
 return x>=layout.centerX-layout.widthCells/2&&x<layout.centerX+layout.widthCells/2
  &&z>=layout.centerZ-layout.depthCells/2&&z<layout.centerZ+layout.depthCells/2;
}
export function roomAir(x:number,y:number,z:number,layers:readonly Layer[]=LAYERS){
 if(!insideAnyRoomBounds(x,z,layers))return false;
 const l=layerBelowCell(y,layers);if(!l)return false;
 const layout=l.room??ROOM_LAYOUT,floor=-l.from/CELL;
 return inRoomFootprint(x,z,layout)&&y>=floor&&y<floor+layout.heightCells;
}
export function onRoomFloor(x:number,y:number,z:number,layers:readonly Layer[]=LAYERS){
 const l=layerAtDepth(-(y+1)*CELL,layers);
 return l.from>0&&y===-l.from/CELL-1&&inRoomFootprint(x,z,l.room??ROOM_LAYOUT);
}

export const SURFACE_SELL = Object.freeze(SURFACE_SALE);
