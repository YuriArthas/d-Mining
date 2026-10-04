import { SURFACE_SALE, SURFACE_SHOP } from './surfaceLayout.ts';
import { QUARRY_SOLIDS } from './QuarryLayout.ts';
import type { SceneryPlan } from './sceneryKit.ts';
// Only gameplay indicators are code-drawn. All environment meshes come from Tripo.
export function surfacePlan():SceneryPlan {
 const s=SURFACE_SALE,u=SURFACE_SHOP;
 return {solids:QUARRY_SOLIDS,shapes:[
  {type:'ring',at:[u.x,.055,u.z],size:[u.radius,.08,u.radius],color:'#44cfff',glow:true},
  {type:'ring',at:[s.x,.055,s.z],size:[s.radius,.08,s.radius],color:'#ffe77d',glow:true},
 ],signs:[{at:[u.x,3.1,u.z-1.5],width:3.6,title:'装备升级',subtitle:'UPGRADES',color:'#ffffff',background:'#087cce'}, {at:[s.x,3.2,s.z-1.5],width:3.6,title:'矿石收购',subtitle:'ORE EXCHANGE',color:'#fff8cf',background:'#d47714'}]};
}
