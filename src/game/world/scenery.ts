import { ENTRANCE_WORLD } from './entrance.ts';
import { THEMES, themeById } from '../content/themes.ts';
import { type RestRoom } from './rooms.ts';
import { Planner, WOOD, DARK, METAL, CREAM, type SceneryPlan } from './sceneryKit.ts';
export type { V3, Shape, Solid, Sign, SceneryPlan } from './sceneryKit.ts';
export { surfacePlan } from './SurfaceAssetPlan.ts';
import { polishRoom } from './undergroundArt.ts';
import { authoredRoomPlan } from './authoredRoomPlan.ts';
function buildRoomPlan(room:RestRoom):SceneryPlan {
  const p=new Planner(),t=themeById(room.theme);p.rim(t);
  p.booth(room.sell.x,0,room.sell.z,t,false,room.sell.radius);
  if(room.shop)p.booth(room.shop.x,0,room.shop.z,t,true,room.shop.radius);
  const sideSign=t.motif==='fossil'||t.motif==='core';
  p.sign([sideSign?-7.5:0,6.2,-18.8],sideSign?6:9,t.name,`${String(THEMES.indexOf(t)+1).padStart(2,'0')}  /  ${room.depth} M`,t);
  // Wall footings and supports leave both circulation and the open mine ceiling clear.
  for(const x of [-18.7,18.7])for(const z of [-14,-4,6,16]){
    p.box([x,4,z],[.75,8,.75],t.wood,true);
    p.box([x,.4,z],[1.2,.8,1.2],t.rock,true);
    p.lantern(x*.97,3.7,z,t);
  }
  for(const z of [-14,6]){
    p.box([0,9,z],[38.4,.65,.65],t.wood);
    for(const x of [-18.6,18.6])p.beam([x,6.7,z],[x-Math.sign(x)*2.5,8.8,z],.5,t.wood);
  }
  for(const x of [-15,15])p.crate(x,0,16,1.25);
  if(t.motif==='mushroom')for(const [x,z,h] of [[-14,-13,5],[13,-14,6],[-15,1,3],[14,1,2.5],[-11,-16,2.5]]){
    p.shape('cylinder',[x,h*.4,z],[.45,h*.8,.45],'#d4c7b4');
    p.plan.solids.push({at:[x,h*.35,z],half:[.45,h*.35,.45],yaw:0});
    p.shape('cap',[x,h*.8,z],[h*.55,h*.18,h*.55],h>4?'#bb8398':'#9bd6b6');
    for(const dx of [-.6,.5])p.shape('rock',[x+dx,h*.8+h*.18*Math.sqrt(1-(dx/(h*.55))**2-(.1/(h*.55))**2),z+.1],[.3,.08,.3],CREAM);
  }
  if(['crystal','ice','core'].includes(t.motif))for(const [x,z,h] of [[-14,-14,5],[14,-13,6],[-15,1,3],[15,1,2.7]]){
    p.crystal(x,0,z,h,t.accent);p.crystal(x-1.2,0,z+1,h*.52,t.rock);p.crystal(x+1,0,z+.6,h*.7,t.accent);
    p.plan.solids.push({at:[x,h*.3,z],half:[h*.25,h*.3,h*.25],yaw:0});
  }
  if(t.motif==='ruins')for(const x of [-13,13]){
    p.box([x,.5,-13],[3.5,1,3.5],t.rock,true);
    p.shape('cylinder',[x,4.2,-13],[1.1,6.6,1.1],'#cbb28b');
    p.plan.solids.push({at:[x,4.2,-13],half:[1.1,3.3,1.1],yaw:0});
    p.box([x,7.6,-13],[3.5,.6,3.5],CREAM);
  }
  if(t.motif==='lava')for(const x of [-14,14]){
    p.shape('rock',[x,2.3,-13],[3.2,4.6,3.3],t.rock);
    p.plan.solids.push({at:[x,1.8,-13],half:[2,1.8,2],yaw:0});
    for(let i=0;i<4;i++)p.box([x+(i%2)*.4,1+i*.7,-9.9],[.22,.9,.06],t.accent,false,[0,0,.35],true);
  }
  if(t.motif==='fossil'){
    for(const x of [-13,13])for(const z of [-14,-10,-6]){
      p.beam([x,0,z],[x,4,z],.8,t.accent);p.beam([x,4,z],[x-Math.sign(x)*3,6,z],.75,t.accent);
      p.plan.solids.push({at:[x,2,z],half:[.45,2,.45],yaw:0});
    }
    p.shape('rock',[0,3.4,-16],[4.2,3.3,2.7],CREAM);
    for(const x of [-1.7,1.7])p.shape('rock',[x,3.8,-13.7],[.7,.85,.12],DARK);
    p.plan.solids.push({at:[0,2,-16],half:[3,2,2],yaw:0});
  }
  if(t.motif==='machine'){
    for(const x of [-13,13]){
      p.box([x,2,-13],[4,4,3],t.wood,true);
      p.shape('cylinder',[x,4.8,-13],[1.6,2,1.6],t.accent,[0,0,0],true);
      p.shape('ring',[x,6.2,-13],[2.3,.35,2.3],METAL);
      p.box([x,7,-13],[.65,2,.65],t.wood,true);
    }
  }
  if(t.motif==='core'){
    p.shape('cylinder',[0,.4,-15],[3.5,.8,3.5],t.wood);
    p.crystal(0,1,-15,6,t.accent);
    p.plan.solids.push({at:[0,2.5,-15],half:[2,2.5,2],yaw:0});
    p.shape('ring',[0,4,-15],[4,.06,4],t.accent,[.4,0,.15],true);
  }
  const floor=Number.parseInt(t.floor.slice(1),16);
  const shade='#'+[16,8,0].map(shift=>Math.round(((floor>>shift)&255)*.87).toString(16).padStart(2,'0')).join('');
  for(const solid of [...p.plan.solids])if(solid.at[1]-solid.half[1]<.1 && Math.max(solid.half[0],solid.half[2])>.6){
    p.shape('cylinder',[solid.at[0],.013,solid.at[2]],[solid.half[0]*1.3,.025,solid.half[2]*1.3],shade);
  }
  polishRoom(p,t,room);
  return p.plan;
}

// A reusable room kit is authored around a canonical 20×20×10-cell cavity.
export function roomPlan(room:RestRoom):SceneryPlan {
 if(room.scene)return authoredRoomPlan(room);
 const sx=room.layout.widthCells/20,sy=room.layout.heightCells/10,sz=room.layout.depthCells/20;
 const canonical={...room,x:0,z:0,sell:{...room.sell,x:-12,z:12},shop:room.shop?{...room.shop,x:12,z:12}:null};
 const plan=buildRoomPlan(canonical);
 // Rim is aligned with the global 8×8 shaft, independently of room dimensions.
 const rim=new Planner();rim.rim(themeById(room.theme));
 const rimShapes=plan.shapes.splice(0,rim.plan.shapes.length),rimSolids=plan.solids.splice(0,rim.plan.solids.length);
 for(const shape of plan.shapes){shape.at=[room.x+shape.at[0]*sx,shape.at[1]*sy,room.z+shape.at[2]*sz];if(!shape.interaction&&(sx!==1||sy!==1||sz!==1))shape.worldScale=[sx,sy,sz];}
 for(const solid of plan.solids){solid.at=[room.x+solid.at[0]*sx,solid.at[1]*sy,room.z+solid.at[2]*sz];solid.half=[solid.half[0]*sx,solid.half[1]*sy,solid.half[2]*sz];}
 for(const sign of plan.signs){sign.at=[room.x+sign.at[0]*sx,sign.at[1]*sy,room.z+sign.at[2]*sz];sign.width*=sx;}
 // Reject blocked entrances; never silently relocate authored facilities.
 for(const solid of plan.solids){
  const c=Math.abs(Math.cos(solid.yaw)),s=Math.abs(Math.sin(solid.yaw));
  const hx=c*solid.half[0]+s*solid.half[2],hz=s*solid.half[0]+c*solid.half[2];
  if(solid.at[0]+hx>ENTRANCE_WORLD.minX&&solid.at[0]-hx<ENTRANCE_WORLD.maxX
   &&solid.at[2]+hz>ENTRANCE_WORLD.minZ&&solid.at[2]-hz<ENTRANCE_WORLD.maxZ)
   throw Error(`休整层布景占用垂直入口: ${room.id}`);
 }
 plan.shapes.unshift(...rimShapes);plan.solids.unshift(...rimSolids);return plan;
}
