import type {Solid,V3} from './sceneryKit.ts';

// Same 2m unit as the mine voxels. Only placements are authored here;
// the three authored Blender components share exact dimensions and small atlases.
export const MINE_GRID=2;
// Sub-centimetre overlap seals tiny bevels; placement pitch stays exactly 2m.
export const MINE_JOIN=.012;
const JOIN=MINE_JOIN;
export const MINE_BLOCK_ASSETS=['grid-mine-timber-blender','grid-mine-trim-blender','grid-mine-roof-blender'] as const;
type Block={asset:typeof MINE_BLOCK_ASSETS[number];x:number;z:number;width:number;depth:number;height:number;y:number};
const blocks:Block[]=[];
function block(asset:Block['asset'],x:number,y:number,z:number,height=2){
 blocks.push({asset,x,y:y-JOIN/2,z,width:2+JOIN,depth:2+JOIN,height:height+JOIN});
}
// Four square posts, four log cubes tall. Ivory footings and capitals.
for(const x of [-10,10])for(const z of [-10,10]){
 for(let y=0;y<8;y+=2)block(y===0?'grid-mine-trim-blender':'grid-mine-timber-blender',x,y,z);
}
// Continuous rectangular beam ring, one cube per voxel; no duplicated corners.
for(let x=-10;x<=10;x+=2)for(const z of [-10,10])block('grid-mine-timber-blender',x,8,z);
for(let z=-8;z<=8;z+=2)for(const x of [-10,10])block('grid-mine-timber-blender',x,8,z);
// Complete stepped gable roof. Half-height courses are Minecraft-style slabs.
// Adjacent courses overlap vertically: the roof has no cracks to the sky.
for(let x=-12;x<=12;x+=2){
 const y=9+(12-Math.abs(x))/2;
 for(let z=-12;z<=12;z+=2)block('grid-mine-roof-blender',x,y,z,2);
 for(const z of [-12,12])block('grid-mine-trim-blender',x,y-1,z,1);
}
// Timber gable faces, assembled in the same grid; keep the space below 8m open.
for(let x=-8;x<=8;x+=2){
 const ceiling=9+(12-Math.abs(x))/2;
 for(let y=10;y<ceiling;y+=2)for(const z of [-10,10])block('grid-mine-timber-blender',x,y,z,Math.min(2,ceiling-y));
}
export const MINE_PAVILION_PLACEMENTS:readonly Block[]=blocks;
// Physics remains an independent coarse shell: four posts, four beams and
// gable infill and thirteen roof strips, rather than one collider for every visible block.
export const MINE_PAVILION_SOLIDS:Solid[]=[
 ...[-10,10].flatMap(x=>[-10,10].map(z=>({at:[x,4,z] as V3,half:[1+JOIN/2,4+JOIN/2,1+JOIN/2] as V3,yaw:0}))),
 ...[-10,10].map(z=>({at:[0,9,z] as V3,half:[11+JOIN/2,1+JOIN/2,1+JOIN/2] as V3,yaw:0})),
 ...[-10,10].map(x=>({at:[x,9,0] as V3,half:[1+JOIN/2,1+JOIN/2,9+JOIN/2] as V3,yaw:0})),
 ...[-10,10].flatMap(z=>Array.from({length:9},(_,i)=>{
  const x=-8+2*i,height=9+(12-Math.abs(x))/2-10;
  return {at:[x,10+height/2,z] as V3,half:[1+JOIN/2,height/2+JOIN/2,1+JOIN/2] as V3,yaw:0};
 })),
 ...Array.from({length:13},(_,i)=>{
  const x=-12+2*i,y=9+(12-Math.abs(x))/2;
  return {at:[x,y+.5,0] as V3,half:[1+JOIN/2,1.5+JOIN/2,13+JOIN/2] as V3,yaw:0};
 }),
];
