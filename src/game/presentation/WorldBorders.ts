import { Group, type Object3D } from 'three';
import { RAPIER, type CharacterPhysics } from '../validation/physics.ts';
import { STATION_LOCAL, WORLD_REQUIREMENTS, worldGateZ, worldPortal, worldRequirement, type WorldId } from '../content/worldJourney.ts';
import type { SceneryPlan, V3 } from '../world/sceneryKit.ts';
import { Planner } from '../world/sceneryKit.ts';
import { themeById } from '../content/themes.ts';
import { PINEWIND_GATE } from '../content/pinewind/hubLayout.ts';
import { TECH_BASE } from '../content/world2/techBase.ts';
import techBaseSolids from '../content/underground/tech-base.json' with { type: 'json' };

/** A later world's portal frame (until its surface authors one): a platform, two pillars and a lintel round the
 *  portal disc TeleportStations draws 2.9 m up. */
function portalFrame(p:Planner,id:WorldId,z0:number){
  const pt=worldPortal(id),x=pt.x,z=pt.z-z0,across=(d:number,y:number):V3=>[x+Math.cos(pt.yaw)*d,y,z-Math.sin(pt.yaw)*d],t=themeById('core_sanctum');
  p.shape('cylinder',[x,.2,z],[3.4,.4,3.4],'#5b6478');
  for(const side of [-1,1]){p.box(across(side*2.45,2.7),[.9,5.4,.9],'#3a414c',true,[0,pt.yaw,0]);p.box(across(side*2.45,5.6),[1.2,.4,1.2],'#f2c230',false,[0,pt.yaw,0]);}
  p.box([x,5.75,z],[5.9,.7,1.1],'#24324a',false,[0,pt.yaw,0]);
  p.sign([x,7.5,z],4.6,'世界传送门','',t);
}
/** World 2's surface: the authored desert colony brings its own ground, buildings, portal dais and frame, station
 *  and colliders; the plan adds the service rings and the signs on the domes' boards, over the portal and the
 *  station, and the world's name on the drill tower's screen. */
function techBasePlan():SceneryPlan {
  const z=TECH_BASE.worldZ,at=(v:readonly number[],y=v[1]):V3=>[v[0],y,v[2]+z];
  const rings=(ring:readonly number[],color:string)=>[
    {type:'ring' as const,at:at(ring,.045),size:[3,.12,3] as V3,color,glow:true,interaction:true},
    {type:'ring' as const,at:at(ring,.035),size:[3.25,.025,3.25] as V3,color,glow:true,interaction:true}];
  const {sell,shop}=TECH_BASE.kiosks,st=TECH_BASE.station,pt=TECH_BASE.portal;
  const sign=(v:readonly number[],yaw:number,width:number,title:string,color:string)=>({at:at(v),width,title,subtitle:'',color,background:'#16283a',yaw});
  return {
    shapes:[...rings(sell.ring,'#ffd387'),...rings(shop.ring,'#80efd0')],
    solids:(techBaseSolids.solids as SceneryPlan['solids']).map(s=>({...s,at:[s.at[0],s.at[1],s.at[2]+z] as V3})),
    signs:[sign(pt.sign,pt.yaw,4.6,'世界传送门','#ffe7a8'),sign(sell.sign,sell.yaw,4.4,'SELL','#ffe08a'),sign(shop.sign,shop.yaw,4.4,'UPGRADE','#9ff7e6'),
      sign([st.x,7.4,st.z],st.yaw,4.4,'传送站','#9ff4ff'),
      sign(TECH_BASE.rig.sign,0,4.4,worldRequirement(2).name,'#ffe7a8')],
  };
}
export function journeySurfacePlan(z:number):SceneryPlan {
  if(z===TECH_BASE.worldZ)return techBasePlan();
  const p=new Planner(),theme=themeById('core_sanctum');
  p.plan.style='plastic';
  p.box([-52,.005,z],[88,.01,200],theme.floor);p.box([56,.005,z],[96,.01,200],theme.floor);
  p.box([0,.005,z-54],[16,.01,92],theme.floor);p.box([0,.005,z+54],[16,.01,92],theme.floor);
  // Broad paths connect the outer gate, facilities and the mine without covering its opening.
  p.box([0,.02,z+54],[10,.02,92],'#b6a994');p.box([0,.02,z-54],[10,.02,92],'#b6a994');
  p.box([0,.025,z+44],[40,.02,9],'#b6a994');
  // Arriving from the preceding world, walk around the mine to the plaza.
  for(const x of [-13,13])p.box([x,.025,z],[8,.02,32],'#b6a994');
  for(const offset of [-14,14])p.box([0,.025,z+offset],[34,.02,8],'#b6a994');
  const local=new Planner();local.booth(-16,0,44,theme,false,3);local.booth(16,0,44,theme,true,3);local.rim(theme);portalFrame(local,3,z);
  // The world's teleport station west of the spawn (its pad opens this world's layers): a round platform, two
  // pillars, a lintel and a ring around the portal disc (TeleportStations draws the disc).
  {const st=STATION_LOCAL,yaw=Math.atan2(-st.x,46-st.z),across=(d:number,y:number):V3=>[st.x+Math.cos(yaw)*d,y,st.z-Math.sin(yaw)*d];
   local.shape('cylinder',[st.x,.2,st.z],[3.1,.4,3.1],'#7f93a8');local.shape('cylinder',[st.x,.44,st.z],[2.7,.08,2.7],theme.accent,[0,0,0],true);
   for(const side of [-1,1]){local.box(across(side*1.9,2.5),[.85,5,.85],'#8b9cb0',true,[0,yaw,0]);local.box(across(side*1.9,5.1),[1.1,.35,1.1],'#273d56',false,[0,yaw,0]);}
   local.box([st.x,5.45,st.z],[4.9,.6,1],'#273d56',false,[0,yaw,0]);
   local.shape('torus',[st.x,2.75,st.z],[1.45,.18,Math.PI*2],theme.accent,[0,yaw,0],true);
   local.sign([st.x,7.4,st.z],4.4,'传送站','',theme);}
  for(const shape of local.plan.shapes)p.plan.shapes.push({...shape,at:[shape.at[0],shape.at[1],shape.at[2]+z]});
  for(const solid of local.plan.solids)p.plan.solids.push({...solid,at:[solid.at[0],solid.at[1],solid.at[2]+z]});
  for(const sign of local.plan.signs)p.plan.signs.push({...sign,at:[sign.at[0],sign.at[1],sign.at[2]+z]});
  return p.plan;
}
/** The worlds' borders on the surface: walls close every boundary between neighbouring worlds (a world is reached
 *  only by its portal), and world 1's old gate in the south ridge is its portal: its doors are gone and the opening
 *  is closed by the portal sheet itself (TeleportStations draws the disc). */
export class WorldBorders {
  readonly group=new Group();
  private readonly colliders:RAPIER.Collider[]=[];
  private readonly physics:CharacterPhysics;
  constructor(physics:CharacterPhysics,surface?:Object3D) {
    this.physics=physics;
    const solid=(half:[number,number,number],at:[number,number,number])=>{this.colliders.push(physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(...at)));};
    for(const name of ['World_Gate_DoorL','World_Gate_DoorR']){const door=surface?.getObjectByName(name);if(door)door.visible=false;}
    const gate=PINEWIND_GATE,half=gate.opening/2;
    for(const w of WORLD_REQUIREMENTS.slice(1)){
      const z=worldGateZ(w.id as 2|3);
      if(w.id===2){
        // World 1's gate frame, its side walls and the closed opening.
        for(const sx of [-1,1]){solid([1,gate.height/2,1.2],[sx*(half+1),gate.height/2,z]);solid([(gate.wallTo-half-2)/2,1.85,.7],[sx*(half+2+(gate.wallTo-half-2)/2),1.85,z]);}
        solid([half+1.1,.65,.8],[0,gate.height-1.6,z]);solid([half,gate.height/2,.4],[0,gate.height/2,z]);
      }else solid([gate.wallTo,6,1],[0,6,z]);
      for(const sx of [-1,1]){const inner=gate.wallTo,outer=103,width=outer-inner;solid([width/2,6,1],[sx*(inner+width/2),6,z]);}
    }
  }
  dispose(){for(const c of this.colliders)this.physics.world.removeCollider(c,false);this.group.removeFromParent();}
}
