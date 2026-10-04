import { SURFACE_SALE, SURFACE_SHOP } from './surfaceLayout.ts';
import { QUARRY_SOLIDS } from './QuarryLayout.ts';
import type { SceneryPlan } from './sceneryKit.ts';
// Gameplay indicators are code-drawn. Environment assets have explicit provenance.
export function surfacePlan():SceneryPlan {
 const s=SURFACE_SALE,u=SURFACE_SHOP;
 return {solids:QUARRY_SOLIDS,shapes:[
  {type:'ring',at:[u.x,.055,u.z],size:[u.radius,.08,u.radius],color:'#44cfff',glow:true},
  {type:'ring',at:[s.x,.055,s.z],size:[s.radius,.08,s.radius],color:'#ffe77d',glow:true},
 ],signs:[{at:[-22,5.7,24],width:8,title:'PETS',subtitle:'宠物蛋展示',color:'#d9a1ff',background:'#613494'},{at:[30,6.8,10],yaw:-Math.PI/2,width:9,title:'TELEPORT',subtitle:'',color:'#73dfff',background:'#27607f'},{at:[u.x,3.1,u.z-1.5],width:3.6,title:'SHOP',subtitle:'',color:'#40deff',background:'#087cce'}, {at:[s.x,3.2,s.z-1.5],width:3.6,title:'SELL',subtitle:'',color:'#ffe35c',background:'#d47714'}]};
}
