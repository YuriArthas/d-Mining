import type {Solid,V3} from './sceneryKit.ts';
// Independent collision fitted to the generated simulator-mine at 26×26×14m.
function roofSlope(side:-1|1):Solid {
 const at:V3=[side*6.5,10,0],hull:number[]=[];
 for(const z of [-13,13])for(const [x,bottom,top] of [[0,11.0,14],[side*13,6.0,8.4]])for(const y of [bottom,top])hull.push(x-at[0],y-at[1],z);
 return {at,half:[6.5,4,13],yaw:0,hull};
}
export const MINE_PAVILION_SOLIDS:Solid[]=[
 ...[-11,11].flatMap(x=>[-11,11].map(z=>({at:[x,4.1,z] as V3,half:[1,4.1,1] as V3,yaw:0}))),
 ...[-10.85,10.85].map(x=>({at:[x,1.7,0] as V3,half:[.4,1.7,11] as V3,yaw:0})),
 {at:[0,1.7,-11.5],half:[11,1.7,.4],yaw:0},
 {at:[0,7.2,11.5],half:[11,1.4,1.2],yaw:0},
 {at:[0,10,10.8],half:[2.5,3.7,2],yaw:0},
 {at:[0,10.7,-10.5],half:[.8,3,2],yaw:0},
 ...[-11,11].map(x=>({at:[x,6.9,0] as V3,half:[1.5,1.3,11.5] as V3,yaw:0})),
 {at:[0,6.6,-11.7],half:[11,.8,1],yaw:0},
 {at:[0,6.85,-6.1],half:[11,.6,.65],yaw:0},
 roofSlope(-1),roofSlope(1),
];
