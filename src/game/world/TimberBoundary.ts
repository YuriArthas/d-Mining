import type {QuarryPlacement} from './QuarryLayout.ts';
import type {Solid} from './sceneryKit.ts';
export const BOUNDARY_ASSETS=['bank-timber','bank-braced','bank-turf','bank-steps','bank-fence'] as const;
// Small Tripo modules assembled on a square grid. Adjacent soil blocks overlap
// slightly to hide generated edge bevels. No model spans a complete boundary.
const placements:QuarryPlacement[]=[];
const solids:Solid[]=[];
function ring(left:number,right:number,near:number,far:number,y:number,height:number,level:number,last=false){
 const place=(x:number,z:number,yaw:number,index:number)=>{
  const asset=level>0?'bank-turf':index%5===2?'bank-steps':index%3===0?'bank-braced':'bank-timber';
  placements.push({asset,x,z,yaw,width:8.6,depth:8.6,height,y});
  // Collision uses an independent continuous cuboid per filled earth module.
  if(asset==='bank-steps'){
   solids.push({at:[x,y+height/4,z],half:[4.15,height/4,4.15],yaw});
   solids.push({at:[x-Math.sin(yaw)*2.1,y+height*.75,z-Math.cos(yaw)*2.1],half:[4.15,height/4,2.1],yaw});
  }else solids.push({at:[x,y+height/2,z],half:[4.15,height/2,4.15],yaw});
  for(let lower=0;lower<level;lower++){
   const base=-.25+lower*3.35;
   placements.push({asset:'bank-turf',x,z,yaw,width:8.6,depth:8.6,height:3.6,y:base});
   solids.push({at:[x,base+1.8,z],half:[4.15,1.8,4.15],yaw});
  }
  if(last&&index%3!==1)placements.push({asset:'bank-fence',x,z,y:y+height-.12,yaw,width:7.8,depth:.45,height:1.15});
 };
 for(let x=left;x<=right;x+=8){const i=Math.round((x-left)/8);place(x,near,0,i);place(x,far,Math.PI,i+2);}
 for(let z=near+8;z<far;z+=8){const i=Math.round((z-near)/8);place(left,z,Math.PI/2,i+1);place(right,z,-Math.PI/2,i);}
}
// Front gardens remain at ground level; the outer course rises behind the first.
ring(-44,44,-36,52,-.25,3.6,0);
ring(-52,52,-44,60,3.1,3.6,1);
ring(-60,60,-52,68,6.45,3.6,2);
ring(-68,68,-60,76,9.8,3.6,3,true);
export const BOUNDARY_PLACEMENTS:readonly QuarryPlacement[]=placements;
export const BOUNDARY_SOLIDS:readonly Solid[]=solids;
