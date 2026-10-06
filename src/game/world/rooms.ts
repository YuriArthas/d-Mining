import {ROOM_LAYOUT} from '../content/roomLayout.ts';
import { SURFACE_HOME, SURFACE_SALE } from './surfaceLayout.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
import { CELL } from '../terrain/grid.ts';
import type { ZoneConfig } from '../logic/ZoneDetector.ts';

const zone = (x: number, y: number, z: number): ZoneConfig => ({ x, y, z, radius: 1.7, heightTolerance: 0.25, hysteresis: 0.25 });
export function roomsFor(layers: readonly Layer[]) {
 return Object.freeze(layers.slice(1).map(l=>{
  const layout=l.room??ROOM_LAYOUT,x=layout.centerX*CELL,z=layout.centerZ*CELL;
  const sx=layout.widthCells/20,sz=layout.depthCells/20;
  return Object.freeze({id:l.id,name:l.name,depth:l.from,x,z,width:layout.widthCells,height:layout.heightCells,
   layout,theme:l.theme,spawn:[x,-l.from+.1,z+11*sz] as const,
   sell:zone(x-12*sx,-l.from,z+12*sz),shop:l.shop?zone(x+12*sx,-l.from,z+12*sz):null});
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
