import {SURFACE_SITE} from './SurfaceSite.ts';
const b=SURFACE_SITE.boundary;
export const WALL_TORCH_LEVEL=2; // Third visible terrace, zero based.
const offset=WALL_TORCH_LEVEL*b.setback;
const left=b.left-offset,right=b.right+offset,back=b.back-offset,front=b.front+offset;
const y=b.base+WALL_TORCH_LEVEL*b.rise+2;
// Redistribute on the actual ring; setbacks and along-wall module pitch are independent.
const slots=(start:number,end:number,count:number)=>Array.from({length:count},(_,i)=>start+Math.round(1+i*((end-start)/b.pitch-2)/(count-1))*b.pitch);
// Match module centres and avoid corners: 5 on each short wall, 6 on each long wall.
const anchors=[
 ...slots(left,right,5).flatMap(x=>[
  {x,z:back+4,yaw:0,side:'back'}, {x,z:front-4,yaw:Math.PI,side:'front'},
 ]),
 ...slots(back,front,6).flatMap(z=>[
  {x:left+4,z,yaw:Math.PI/2,side:'left'}, {x:right-4,z,yaw:-Math.PI/2,side:'right'},
 ]),
];
export const WALL_TORCHES=anchors.map((p,i)=>({
 id:`wall-torch-${i+1}`,side:p.side,level:WALL_TORCH_LEVEL+1,fixture:{...p,y},
 light:{position:[p.x+Math.sin(p.yaw)*.85,y+1,p.z+Math.cos(p.yaw)*.85] as const,color:'#ffbc60',intensity:14,distance:6,decay:2},
}));
