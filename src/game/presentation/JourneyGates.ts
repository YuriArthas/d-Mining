import { BoxGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Material, type Object3D } from 'three';
import { RAPIER, type CharacterPhysics } from '../validation/physics.ts';
import type { GameSession } from '../application/GameSession.ts';
import { WORLD_REQUIREMENTS, worldGateZ } from '../content/worldJourney.ts';
import type { SceneryPlan, Solid } from '../world/sceneryKit.ts';
import { Planner } from '../world/sceneryKit.ts';
import { themeById } from '../content/themes.ts';
import { disposeScenery } from './disposeScenery.ts';
import { PINEWIND_GATE } from '../content/pinewind/hubLayout.ts';

/** World 1's authored gate (frame plus two hinged doors) when the hub provides one. */
function authoredGate(surface?: Object3D) {
  const frame = surface?.getObjectByName('World_Gate'), left = surface?.getObjectByName('World_Gate_DoorL'), right = surface?.getObjectByName('World_Gate_DoorR');
  return frame && left && right ? { left, right } : null;
}

function label(lines:readonly string[],width:number) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const context=canvas.getContext('2d')!;
  context.fillStyle='#152b38';context.fillRect(0,0,1024,256);
  context.textAlign='center';context.textBaseline='middle';
  lines.forEach((line,i)=>{context.fillStyle=i?'#f1d68d':'#ffffff';context.font=`600 ${i?46:62}px sans-serif`;context.fillText(line,512,lines.length===1?128:75+i*105,980);});
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  return new Mesh(new PlaneGeometry(width,width/4),new MeshBasicMaterial({map:texture,side:DoubleSide}));
}
export function journeySurfacePlan(z:number):SceneryPlan {
  const p=new Planner(),theme=themeById(z===224?'ancient_machine':'core_sanctum');
  p.plan.style='plastic';
  p.box([-52,.005,z],[88,.01,200],theme.floor);p.box([56,.005,z],[96,.01,200],theme.floor);
  p.box([0,.005,z-54],[16,.01,92],theme.floor);p.box([0,.005,z+54],[16,.01,92],theme.floor);
  // Broad paths connect the outer gate, facilities and the mine without covering its opening.
  p.box([0,.02,z+54],[10,.02,92],'#b6a994');p.box([0,.02,z-54],[10,.02,92],'#b6a994');
  p.box([0,.025,z+44],[40,.02,9],'#b6a994');
  // Arriving from the preceding world, walk around the mine to the plaza.
  for(const x of [-13,13])p.box([x,.025,z],[8,.02,32],'#b6a994');
  for(const offset of [-14,14])p.box([0,.025,z+offset],[34,.02,8],'#b6a994');
  const local=new Planner();local.booth(-16,0,44,theme,false,3);local.booth(16,0,44,theme,true,3);local.rim(theme);
  for(const shape of local.plan.shapes)p.plan.shapes.push({...shape,at:[shape.at[0],shape.at[1],shape.at[2]+z]});
  for(const solid of local.plan.solids)p.plan.solids.push({...solid,at:[solid.at[0],solid.at[1],solid.at[2]+z]});
  for(const sign of local.plan.signs)p.plan.signs.push({...sign,at:[sign.at[0],sign.at[1],sign.at[2]+z]});
  return p.plan;
}
// Open the retaining wall behind spawn; the mine-side wall stays intact.
export function spawnPassageSolids(solids:readonly Solid[]):Solid[] {
  return solids.flatMap(s=>{
    if(s.at[2]-s.half[2]>=106||s.at[2]+s.half[2]<=66||s.at[1]+s.half[1]<=0||Math.abs(s.at[0])>=s.half[0]+7)return [s];
    const left=s.at[0]-s.half[0],right=s.at[0]+s.half[0];
    return [[left,Math.min(right,-7)],[Math.max(left,7),right]].filter(([l,r])=>r>l).map(([l,r])=>({...s,at:[(l+r)/2,s.at[1],s.at[2]] as [number,number,number],half:[(r-l)/2,s.half[1],s.half[2]] as [number,number,number]}));
  });
}
export function openSpawnPassage(root:Group) {
  const seen=new Set<Material>();
  root.traverse(object=>{
    if(!(object instanceof Mesh))return;
    for(const material of (Array.isArray(object.material)?object.material:[object.material]) as Material[]) {
      if(seen.has(material))continue;seen.add(material);
      const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);
        shader.vertexShader='varying vec3 passagePosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvec4 passageLocal=vec4(transformed,1.);\n#ifdef USE_INSTANCING\npassageLocal=instanceMatrix*passageLocal;\n#endif\npassagePosition=(modelMatrix*passageLocal).xyz;');
        shader.fragmentShader='varying vec3 passagePosition;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(abs(passagePosition.x)<7. && passagePosition.z > 66. && passagePosition.z < 106. && passagePosition.y > .06) discard;');
      };
      const oldKey=key();material.customProgramCacheKey=()=>oldKey+'-spawn-passage';material.needsUpdate=true;
    }
  });
}
export class JourneyGates {
  readonly group=new Group();
  private readonly colliders:RAPIER.Collider[]=[];
  private readonly entries:{world:2|3;left:Object3D;right:Object3D;barrier:RAPIER.Collider;closedSign:Mesh;cover:Mesh;lid:RAPIER.Collider}[]=[];
  private readonly detach:()=>void;
  private readonly physics:CharacterPhysics;
  constructor(physics:CharacterPhysics,session:GameSession,surface?:Object3D) {
    this.physics=physics;
    const box=(size:[number,number,number],at:[number,number,number],color:string)=>{const m=new Mesh(new BoxGeometry(...size),new MeshStandardMaterial({color,roughness:.9}));m.position.set(...at);this.group.add(m);return m;};
    const solid=(half:[number,number,number],at:[number,number,number])=>{const c=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(...at));this.colliders.push(c);return c;};
    // A ground-level route runs from the spawn plaza through its rear gate.
    // The requirement belongs on the door itself, not on a floating guide panel.
    box([5.4,.04,74],[0,.04,87],'#d6af67');
    for(const w of WORLD_REQUIREMENTS.slice(1)) {
      const world=w.id as 2|3,z=worldGateZ(world);
      if(world===3)box([10,.04,24],[0,.04,w.z-112],'#b6a994');
      const requirement=`累计挖掘量 ${world===2?'100 万':'1 亿'}`, authored=world===2?authoredGate(surface):null;
      let left:Object3D,right:Object3D,barrier:RAPIER.Collider,closedSign:Mesh,sideFrom:number;
      if(authored){
        // World 1's gate is the hub's own model in the pass of the south ridge; only collision and the
        // requirement text are added here, and its two hinged doors swing open below.
        const {opening,height,wallTo}=PINEWIND_GATE,half=opening/2,wall=wallTo-half-2;
        for(const sx of [-1,1]){solid([1,height/2,1.2],[sx*(half+1),height/2,z]);solid([wall/2,1.85,.7],[sx*(half+2+wall/2),1.85,z]);}
        solid([half+1.1,.65,.8],[0,height-1.6,z]);
        const sign=label([w.name,requirement],6.3);sign.position.set(0,height-1.6,z-1.04);sign.rotation.y=Math.PI;this.group.add(sign);
        closedSign=label([w.name+'大门',requirement+' 自动开放'],5.4);closedSign.position.set(0,4.6,z-.42);closedSign.rotation.y=Math.PI;this.group.add(closedSign);
        ({left,right}=authored);barrier=solid([half,3.6,.3],[0,3.6,z]);sideFrom=wallTo;
      }else{
        for(const x of [-8.25,8.25]){
          box([2.5,18,3.5],[x,9,z],'#c7b18b');solid([1.25,9,1.75],[x,9,z]);
          box([3.3,1,4],[x,.5,z],'#63777f');box([3.3,1,4],[x,17.5,z],'#63777f');
        }
        box([21,1.8,3.5],[0,16.4,z],'#63777f');solid([10.5,.9,1.75],[0,16.4,z]);
        const sign=label([w.name,requirement],15);sign.position.set(0,16.4,z-1.8);sign.rotation.y=Math.PI;this.group.add(sign);
        closedSign=label([w.name+'大门',requirement+' 自动开放'],10);closedSign.position.set(0,6,z-1.4);closedSign.rotation.y=Math.PI;this.group.add(closedSign);
        const leftDoor=new Group(),rightDoor=new Group();leftDoor.name=`world${world}-left-door`;rightDoor.name=`world${world}-right-door`;leftDoor.position.set(-7,0,z);rightDoor.position.set(7,0,z);this.group.add(leftDoor,rightDoor);
        for(const [parent,direction] of [[leftDoor,1],[rightDoor,-1]] as const){
          const part=(size:[number,number,number],at:[number,number,number],color:string)=>{const mesh=box(size,at,color);parent.add(mesh);return mesh;};
          part([6.98,14.5,1.1],[direction*3.5,7.25,0],'#895f38');
          for(let plank=0;plank<5;plank++)part([1.22,13.7,.18],[direction*(.7+plank*1.4),7.25,-.63],plank%2?'#bc8c50':'#c89b5c');
          for(const y of [1,7.25,13.5])part([6.9,.55,.28],[direction*3.5,y,-.8],'#435863');
          for(const y of [2.5,11.8])part([.65,1.1,1.35],[direction*.2,y,0],'#d3b76c');
          part([.45,1.7,.55],[direction*6.25,6.9,-1.02],'#e0c477');
        }
        left=leftDoor;right=rightDoor;barrier=solid([7,7.25,.55],[0,7.25,z]);sideFrom=8.5;
      }
      // Invisible side barriers from the gate out to the valley edge; World 3's are also drawn.
      for(const sx of [-1,1]){
        const inner=sideFrom,outer=103,width=outer-inner;
        if(world===3)box([width,8,2],[sx*(inner+width/2),4,z],'#7e8d84');
        solid([width/2,4,1],[sx*(inner+width/2),4,z]);
      }
      const cover=box([16,.45,16],[0,.23,w.z],'#b49b72'),lid=solid([8,.25,8],[0,.25,w.z]);
      for(const side of [-1,1]){
        const mineSign=label([w.name+'矿区','首次进入：缴纳矿产和金币'],13);mineSign.position.set(0,7,w.z+side*9);mineSign.rotation.y=side<0?Math.PI:0;this.group.add(mineSign);
      }
      // Keep the plaza's title in front of spawn, clear of the rear-gate sightline.
      const home=label([w.name,'返回此处使用世界与矿层传送'],12);home.position.set(0,5,w.z+34);this.group.add(home);
      this.entries.push({world,left,right,barrier,closedSign,cover,lid});
    }
    const update=()=>{for(const entry of this.entries){const world=session.getSnapshot().worlds.find(w=>w.id===entry.world)!;entry.left.rotation.y=world.areaOpen?-Math.PI/2:0;entry.right.rotation.y=world.areaOpen?Math.PI/2:0;entry.barrier.setEnabled(!world.areaOpen);entry.closedSign.visible=!world.areaOpen;entry.cover.visible=!world.mineOpen;entry.lid.setEnabled(!world.mineOpen);}};
    update();this.detach=session.subscribe(update);
  }
  dispose(){this.detach();for(const c of this.colliders)this.physics.world.removeCollider(c,false);disposeScenery(this.group);this.group.removeFromParent();}
}
