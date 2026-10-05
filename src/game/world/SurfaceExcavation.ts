import {ENTRANCE,inEntrance} from './entrance.ts';
// Authored initial excavation: one depth per column, NOT allocated voxel edits.
// Rows run back (-Z) to the player approach (+Z). A broken rim and offset deeper
// pocket expose stepped faces without a regular funnel or a floating rock roof.
const DEPTHS=[
  [0,0,1,1,0,0,0,0],
  [0,1,1,2,2,1,0,0],
  [1,1,2,3,3,2,1,0],
  [0,1,2,3,4,3,2,1],
  [0,0,1,2,3,3,2,0],
  [0,1,1,2,2,1,1,0],
  [0,0,1,1,1,0,0,0],
  [0,0,0,1,0,0,0,0],
] as const;
export function initialExcavationDepth(x:number,z:number){
 return inEntrance(x,z)?DEPTHS[z-ENTRANCE.minZ][x-ENTRANCE.minX]:0;
}
export function surfaceExcavated(x:number,y:number,z:number){
 return y>=-4&&y<=-1&&-y<=initialExcavationDepth(x,z);
}
