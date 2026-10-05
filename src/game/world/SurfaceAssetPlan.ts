import { SURFACE_SALE, SURFACE_SHOP, SURFACE_BUILDINGS } from './surfaceLayout.ts';
import { QUARRY_SOLIDS } from './QuarryLayout.ts';
import {CURB_SOLIDS} from './SurfaceRoads.ts';
import {POND_SOLIDS} from './SurfacePonds.ts';
import type { SceneryPlan } from './sceneryKit.ts';
// Gameplay indicators are code-drawn. Environment assets have explicit provenance.
export function surfacePlan():SceneryPlan {
 const s=SURFACE_SALE,u=SURFACE_SHOP;
 return {solids:[...QUARRY_SOLIDS,...CURB_SOLIDS,...POND_SOLIDS],shapes:[
  {type:'ring',at:[u.x,.055,u.z],size:[u.radius,.08,u.radius],color:'#44cfff',glow:true},
  {type:'ring',at:[s.x,.055,s.z],size:[s.radius,.08,s.radius],color:'#ffe77d',glow:true},
 ],signs:[
  {at:[43,8.4,30],yaw:-Math.PI/2,width:6,title:'PETS',subtitle:'宠物蛋展示',color:'#d9a1ff',background:'#613494'},
  {at:[-29.2,4.4,32],yaw:Math.PI/2,width:5,title:'TELEPORT',subtitle:'',color:'#73dfff',background:'#27607f'},
  ...([{p:u,b:SURFACE_BUILDINGS.shop,title:'SHOP',color:'#40deff'},{p:s,b:SURFACE_BUILDINGS.sale,title:'SELL',color:'#ffe35c'}]).map(({p,b,title,color})=>({at:[p.x,4.5,p.z] as [number,number,number],yaw:b.yaw,width:3.6,title,subtitle:'',color,background:'#18283d'})),
 ]};
}
