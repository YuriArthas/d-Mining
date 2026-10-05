import type {Solid} from './sceneryKit.ts';
// A three-tier display stand assembled from the approved authored block kit.
// Render uses repeated components; physics uses a shell per terrace and stair.
export const PET_TIERS=[
 {x:28,y:.4,tier:0},
 {x:34,y:2.2,tier:1},
 {x:40,y:4,tier:2},
] as const;
export const PET_COLUMNS=[20,24,28,32,36,40] as const;
export const PET_STAND={front:25,back:43,minZ:17,maxZ:43,stairWidth:3} as const;
type Part={asset:'grid-mine-timber-blender'|'grid-mine-trim-blender';x:number;y:number;z:number;width:number;depth:number;height:number};
const parts:Part[]=[],solids:Solid[]=[];
const block=(asset:Part['asset'],x:number,y:number,z:number,width:number,depth:number,height:number)=>parts.push({asset,x,y,z,width,depth,height});
for(const tier of PET_TIERS){
 for(let x=tier.x-2;x<=tier.x+2;x+=2)for(let z=18;z<=42;z+=2){
  const body=tier.y-.18;
  for(let y=0;y<body;y+=2)block('grid-mine-timber-blender',x,y,z,2.012,2.012,Math.min(2,body-y)+.006);
  block('grid-mine-trim-blender',x,tier.y-.18,z,2.012,2.012,.18);
 }
 solids.push({at:[tier.x,tier.y/2,30],half:[3,tier.y/2,13],yaw:0});
}
// Side staircases: 0.3m risers below the 0.45m character autostep threshold.
// Landings meet each level exactly; the display rows leave a 1.65m clear strip in front of the eggs.
export const PET_STAIR_STEPS:readonly {x:number;y:number;z:number;width:number;depth:number}[]=PET_TIERS.flatMap((tier,i)=>{
 const from=i===0?0:PET_TIERS[i-1].y;
 const count=i===0?2:6,run=6/count;
 return [15.5,44.5].flatMap(z=>Array.from({length:count},(_,j)=>({x:tier.x-3+(j+.5)*run,y:from+(tier.y-from)*(j+1)/count,z,width:run,depth:3})));
});
for(const step of PET_STAIR_STEPS){
 block('grid-mine-trim-blender',step.x,0,step.z,step.width+.006,step.depth,step.y);
 solids.push({at:[step.x,step.y/2,step.z],half:[step.width/2,step.y/2,step.depth/2],yaw:0});
}
export const PET_TERRACE_PLACEMENTS:readonly Part[]=parts;
export const PET_TERRACE_SOLIDS:readonly Solid[]=solids;
