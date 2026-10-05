import {Color,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,RingGeometry} from 'three';
import {SURFACE_PORTALS,PET_DISPLAYS,PORTAL_BASE_HEIGHT} from '../world/SurfaceHub.ts';
import {createWorldText} from './WorldText.ts';
// Presentation consumes progress snapshots only. It neither unlocks nor teleports.
export class SurfaceHubView {
 private readonly entries=new Map<string,{materials:MeshStandardMaterial[];colors:Color[];ring:MeshBasicMaterial;locked:Group;enter:Group;active:boolean|null}>();
 constructor(private readonly surface:Group){
  for(const p of SURFACE_PORTALS){
   const group=new Group();group.name='destination:'+p.id;
   // Thin segmented markers retain the interaction footprint without a black disc.
   const ring=new MeshBasicMaterial({color:'#94a6a5'});
   for(let i=0;i<4;i++){
    const arc=new Mesh(new RingGeometry(p.zone.radius+.035,p.zone.radius+.095,32,1,i*Math.PI/2+.09,Math.PI/2-.18),ring);
    arc.rotation.x=-Math.PI/2;arc.position.set(p.x,.035,p.z);group.add(arc);
   }
   const label=(title:string,y:number,color:string,width:number,subtitle='',offset=.85)=>createWorldText({at:[p.x+Math.sin(p.yaw)*offset,y,p.z+Math.cos(p.yaw)*offset],yaw:p.yaw,width,title,subtitle,color,background:'#18283d'});
   group.add(label(p.name,2.7+PORTAL_BASE_HEIGHT,p.color,2.1,`${p.depth} m`));
   const locked=label('LOCKED',.38,'#e5d5b5',.95,'',1.3),enter=label('ENTER',.38,p.color,.95,'',1.3);
   group.add(locked,enter);surface.add(group);
   const materials:MeshStandardMaterial[]=[],colors:Color[]=[];
   for(const prop of surface.children)if(prop.userData.portalId===p.id)prop.traverse(o=>{
    if(!(o instanceof Mesh))return;
    const clone=(source:MeshStandardMaterial)=>{const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;materials.push(m);colors.push(m.color.clone());return m;};
    o.material=Array.isArray(o.material)?o.material.map(m=>clone(m as MeshStandardMaterial)):clone(o.material as MeshStandardMaterial);
   });
   this.entries.set(p.id,{materials,colors,ring,locked,enter,active:null});
  }
 }
 update(destinations:readonly {id:string;unlocked:boolean}[]){
  for(const d of destinations){const e=this.entries.get(d.id);if(!e||e.active===d.unlocked)continue;
   const p=SURFACE_PORTALS.find(p=>p.id===d.id)!;e.active=d.unlocked;
   e.materials.forEach((m,i)=>m.color.copy(e.colors[i]).multiplyScalar(d.unlocked?1:.9));
   e.ring.color.set(d.unlocked?p.color:'#94a6a5');
   e.locked.visible=!d.unlocked;e.enter.visible=d.unlocked;
  }
  this.surface.userData.hub={petDisplayOnly:true,petStations:PET_DISPLAYS,portals:SURFACE_PORTALS.map(p=>({id:p.id,depth:p.depth,modelCenter:[p.x,PORTAL_BASE_HEIGHT,p.z],zone:p.zone,unlocked:this.entries.get(p.id)?.active===true}))};
 }
}
