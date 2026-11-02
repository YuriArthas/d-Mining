import type { MessageId } from '../i18n/messages.ts';
import {roomSceneAsset} from '../content/rooms/sceneAssets.ts';
import {undergroundHall} from '../content/underground/halls.ts';
import type {RoomAnchor,RoomSceneAsset} from '../content/rooms/authoredRoom.ts';
import type {RestRoom} from './rooms.ts';
import {PAD_CURTAIN,type SceneryPlan,type V3,type Solid} from './sceneryKit.ts';
import {ENTRANCE_WORLD} from './entrance.ts';
import {CELL} from '../terrain/grid.ts';

import { tr } from '../i18n/i18n.ts';
export function authoredRoomPlan(room:RestRoom,providedAsset?:RoomSceneAsset):SceneryPlan {
  const definition=room.sceneDefinition;
  if(!definition)throw Error(`房间未配置独立场景: ${room.id}`);
  if(definition.hall&&!providedAsset)return hallPlan(room,definition.hall);
  const render=definition.render;
  if(!render||(!definition.asset&&!providedAsset))throw Error(`房间缺少场景配置: ${room.id}`);
  const {kit,layout}=providedAsset??roomSceneAsset(definition.asset!);
  const reference=definition.referenceSize;
  const scale:V3=[room.layout.widthCells*CELL/reference[0],room.layout.heightCells*CELL/reference[1],room.layout.depthCells*CELL/reference[2]];
  const origin:V3=[room.x,0,room.z];
  const anchor=(id:RoomAnchor):number[]=>{
    if(id==='room')return [0,0,0];
    const value=definition.facilities[id];
    if(!value)throw Error(`缺少场景位置基准 ${room.id}: ${id}`);
    return value.at;
  };
  const world=(at:readonly number[]):V3=>at.map((v,i)=>origin[i]+v*scale[i]) as V3;
  const canonical=(at:readonly number[]):V3=>at.map((v,i)=>(v-origin[i])/scale[i]) as V3;
  const instances:NonNullable<SceneryPlan['authored']>['instances'][number][]=[],solids:Solid[]=[],lamps:number[][]=[],lightSolids:Solid[]=[];
  const ids=new Set<string>();
  const vector=(v:readonly number[])=>v.length===3&&v.every(Number.isFinite);
  const atlas=render.atlas;
  if(layout.textureSize!==kit.texture.size||kit.texture.size%atlas.columns||kit.texture.size%atlas.rows||Math.min(kit.texture.size/atlas.columns,kit.texture.size/atlas.rows)<=atlas.gutter*2)throw Error(`图集尺寸与场景配置不符: ${room.id}`);
  for(const material of Object.values(layout.materials))if(!Number.isInteger(material.tile)||material.tile<0||material.tile>=atlas.columns*atlas.rows)throw Error(`无效图集单元: ${room.id}`);
  for(const group of layout.groups){
    if(ids.has(group.id)||!vector(group.offset))throw Error(`无效场景组件组: ${group.id}`);
    // A layer without a shop (only layers 2 and 4 have one) leaves out the shop's stall, like its ring and sign.
    if(group.anchor==='shop'&&!room.shop){ids.add(group.id);continue;}
    ids.add(group.id);
    const base=anchor(group.anchor).map((v,i)=>v+group.offset[i]);
    const position=(at:readonly number[]):V3=>{if(!vector(at))throw Error(`无效组件坐标: ${group.id}`);return at.map((v,i)=>v+base[i]) as V3;};
    for(const p of group.instances){
      if(!kit.meshes[p.mesh]||!layout.materials[p.material]||!vector(p.scale)||p.scale.some(v=>v<=0)||!vector(p.rotation))throw Error(`无效场景实例: ${p.name}`);
      instances.push({...p,at:position(p.at),scale:[...p.scale],rotation:[...p.rotation]});
    }
    for(const s of group.solids){
      if(!vector(s.half)||s.half.some(v=>v<=0)||!Number.isFinite(s.yaw))throw Error(`无效场景碰撞: ${group.id}`);
      const local=position(s.at);
      const resolved={at:s.fixed?local:world(local),half:(s.fixed?[...s.half]:s.half.map((v,i)=>v*scale[i])) as V3,yaw:s.yaw};
      solids.push(resolved);
      lightSolids.push({at:canonical(resolved.at),half:resolved.half.map((v,i)=>v/scale[i]) as V3,yaw:s.yaw});
    }
    for(const lamp of group.lamps){const local=position(lamp.at);lamps.push(lamp.fixed?canonical(local):local);}
  }
  const minX=room.x-room.layout.widthCells*CELL/2,maxX=room.x+room.layout.widthCells*CELL/2;
  const minZ=room.z-room.layout.depthCells*CELL/2,maxZ=room.z+room.layout.depthCells*CELL/2;
  const shaft=ENTRANCE_WORLD;
  const rectangles:Record<string,number[]>={west:[minX,shaft.minX,minZ,maxZ],east:[shaft.maxX,maxX,minZ,maxZ],north:[shaft.minX,shaft.maxX,minZ,shaft.minZ],south:[shaft.minX,shaft.maxX,shaft.maxZ,maxZ]};
  for(const p of instances)if(p.floor){
    const rectangle=rectangles[p.floor];
    if(!rectangle||!p.fixed)throw Error(`无效入口地板: ${p.name}`);
    const [x0,x1,z0,z1]=rectangle;
    p.at=[(x0+x1)/2,p.at[1],(z0+z1)/2];p.scale=[x1-x0,p.scale[1],z1-z0];
  }
  for(const s of solids){
    const c=Math.abs(Math.cos(s.yaw)),n=Math.abs(Math.sin(s.yaw)),hx=c*s.half[0]+n*s.half[2],hz=n*s.half[0]+c*s.half[2];
    if(s.at[0]+hx>shaft.minX&&s.at[0]-hx<shaft.maxX&&s.at[2]+hz>shaft.minZ&&s.at[2]-hz<shaft.maxZ)throw Error(`休整层布景占用垂直入口: ${room.id}`);
  }
  const at=(id:RoomAnchor,offset:readonly number[])=>world(anchor(id).map((v,i)=>v+offset[i]));
  // Sign text from the scene file, in the page's language (tools/i18n-scan.mjs reads the scene files' sign text).
  const text=(value:MessageId)=>tr(value,{name:room.name,number:String(room.number).padStart(2,'0'),depth:room.depth});
  return {
    shapes:definition.rings.filter(r=>r.anchor!=='shop'||room.shop).map(r=>{
      const zone=r.anchor==='sell'?room.sell:room.shop!;
      return {type:'pad',at:at(r.anchor,r.offset),size:[zone.radius,PAD_CURTAIN,zone.radius],color:r.color,interaction:true};
    }),
    solids,
    signs:definition.signs.filter(s=>s.anchor!=='shop'||room.shop).map(s=>({at:at(s.anchor,s.offset),width:s.width,title:text(s.title),subtitle:text(s.subtitle),color:s.color,background:s.background})),
    authored:{kit,materials:layout.materials,render,referenceSize:reference,origin,scale,instances,lightSolids,lamps},
  };
}

/** A room filled by an authored hall: rings and signs from the scene definition, colliders from the hall build;
 *  the art itself loads with the authored scene (pinewindSurface.ts). */
function hallPlan(room:RestRoom,hallId:string):SceneryPlan {
  const definition=room.sceneDefinition!,{solids}=undergroundHall(hallId);
  const reference=definition.referenceSize;
  const scale:V3=[room.layout.widthCells*CELL/reference[0],room.layout.heightCells*CELL/reference[1],room.layout.depthCells*CELL/reference[2]];
  const anchor=(id:RoomAnchor)=>id==='room'?[0,0,0]:definition.facilities[id]!.at;
  const at=(id:RoomAnchor,offset:readonly number[]):V3=>anchor(id).map((v,i)=>[room.x,0,room.z][i]+(v+offset[i])*scale[i]) as V3;
  // Sign text from the scene file, in the page's language (tools/i18n-scan.mjs reads the scene files' sign text).
  const text=(value:MessageId)=>tr(value,{name:room.name,number:String(room.number).padStart(2,'0'),depth:room.depth});
  return {
    shapes:definition.rings.filter(r=>r.anchor!=='shop'||room.shop).map(r=>{const zone=r.anchor==='sell'?room.sell:room.shop!;return {type:'pad',at:at(r.anchor,r.offset),size:[zone.radius,PAD_CURTAIN,zone.radius],color:r.color,interaction:true};}),
    solids:solids.map(s=>({...s,at:[s.at[0]+room.x,s.at[1],s.at[2]+room.z] as V3})),
    signs:definition.signs.filter(s=>s.anchor!=='shop'||room.shop).map(s=>({at:at(s.anchor,s.offset),width:s.width,title:text(s.title),subtitle:text(s.subtitle),color:s.color,background:s.background,...(s.yaw===undefined?{}:{yaw:s.yaw})})),
  };
}
