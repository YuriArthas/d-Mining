import { PAD_CURTAIN, type SceneryPlan, type V3 } from '../world/sceneryKit.ts';
import { worldRequirement } from './worldJourney.ts';
import { TECH_BASE } from './world2/techBase.ts';
import techBaseSolids from './underground/tech-base.json' with { type: 'json' };
import { STAR_BASE } from './world3/starBase.ts';
import starBaseSolids from './underground/star-base.json' with { type: 'json' };
import { tr } from '../i18n/i18n.ts';

type Base = Readonly<{
  worldZ: number;
  kiosks: Readonly<Record<'sell' | 'shop', Readonly<{ yaw: number; ring: readonly number[]; sign: readonly number[] }>>>;
  station: Readonly<{ x: number; z: number; yaw: number }>;
  portal: Readonly<{ yaw: number; sign: readonly number[] }>;
}>;
/** A later world's surface: its authored base brings its own ground, buildings, portal, station and their colliders
 *  (built by tools/build-underground.mjs from surface-game-art/tools/underground/<base>Hall.ts); the plan adds the
 *  service rings and the signs on the buyer's and the shop's boards, over the portal and the station, and the
 *  world's name (world 2: on the drill tower's screen; world 3: on the crater arch's keystone). */
function basePlan(base: Base, solids: SceneryPlan['solids'], name: { at: readonly number[]; title: string }, colors: { sell: string; shop: string }): SceneryPlan {
  const z=base.worldZ,at=(v:readonly number[],y=v[1]):V3=>[v[0],y,v[2]+z];
  const rings=(ring:readonly number[],color:string)=>[{type:'pad' as const,at:at(ring,.12),size:[3,PAD_CURTAIN,3] as V3,color,interaction:true}];
  const {sell,shop}=base.kiosks,st=base.station,pt=base.portal;
  const sign=(v:readonly number[],yaw:number,width:number,title:string,color:string)=>({at:at(v),width,title,subtitle:'',color,background:'#16283a',yaw});
  return {
    shapes:[...rings(sell.ring,colors.sell),...rings(shop.ring,colors.shop)],
    solids:solids.map(s=>({...s,at:[s.at[0],s.at[1],s.at[2]+z] as V3})),
    signs:[sign(pt.sign,pt.yaw,4.6,tr('世界传送门'),'#ffe7a8'),sign(sell.sign,sell.yaw,4.4,'SELL','#ffe08a'),sign(shop.sign,shop.yaw,4.4,'UPGRADE','#9ff7e6'),
      sign([st.x,7.4,st.z],st.yaw,4.4,tr('传送站'),'#9ff4ff'),
      sign(name.at,0,4.4,name.title,'#ffe7a8')],
  };
}
/** World 2's or world 3's surface plan, in world coordinates. */
export function baseSurfacePlan(world: 2 | 3): SceneryPlan {
  return world === 2
    ? basePlan(TECH_BASE,techBaseSolids.solids as SceneryPlan['solids'],{at:TECH_BASE.rig.sign,title:worldRequirement(2).name},{sell:'#ffb21e',shop:'#80efd0'})
    : basePlan(STAR_BASE,starBaseSolids.solids as SceneryPlan['solids'],{at:STAR_BASE.arch.sign,title:worldRequirement(3).name},{sell:'#ffb21e',shop:'#c9b4ff'});
}
