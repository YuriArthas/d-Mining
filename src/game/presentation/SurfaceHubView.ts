import {Color,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,RingGeometry,CircleGeometry} from 'three';
import {SURFACE_PORTALS,PET_DISPLAYS} from '../world/SurfaceHub.ts';
import {createWorldText} from './WorldText.ts';
// Presentation consumes progress snapshots only. It neither unlocks nor teleports.
export class SurfaceHubView {
 private readonly entries=new Map<string,{materials:MeshStandardMaterial[];colors:Color[];ring:MeshBasicMaterial;fill:MeshBasicMaterial;locked:Group;enter:Group;active:boolean|null}>();
 constructor(private readonly surface:Group){
  for(const p of SURFACE_PORTALS){
   const group=new Group();group.name='destination:'+p.id;
   const ring=new MeshBasicMaterial({color:'#546578'}),fill=new MeshBasicMaterial({color:'#162333'});
   const outer=new Mesh(new RingGeometry(p.zone.radius+.05,p.zone.radius+.22,64),ring),inner=new Mesh(new CircleGeometry(p.zone.radius+.01,64),fill);
   for(const mesh of [outer,inner]){mesh.rotation.x=-Math.PI/2;mesh.position.set(p.zone.x,.07,p.z);group.add(mesh);}
   const label=(title:string,y:number,color:string,width:number,subtitle='')=>createWorldText({at:[p.x+Math.sin(p.yaw)*1.55,y,p.z+Math.cos(p.yaw)*1.55],yaw:p.yaw,width,title,subtitle,color,background:'#18283d'});
   group.add(label(p.name,4.8,p.color,2.8,`${p.depth} m`));
   const locked=label('LOCKED',2.8,'#aab9cb',1.7),enter=label('ENTER',2.8,p.color,1.7);
   group.add(locked,enter);surface.add(group);
   const materials:MeshStandardMaterial[]=[],colors:Color[]=[];
   for(const prop of surface.children)if(prop.userData.portalId===p.id)prop.traverse(o=>{
    if(!(o instanceof Mesh))return;
    const clone=(source:MeshStandardMaterial)=>{const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;materials.push(m);colors.push(m.color.clone());return m;};
    o.material=Array.isArray(o.material)?o.material.map(m=>clone(m as MeshStandardMaterial)):clone(o.material as MeshStandardMaterial);
   });
   this.entries.set(p.id,{materials,colors,ring,fill,locked,enter,active:null});
  }
 }
 update(destinations:readonly {id:string;unlocked:boolean}[]){
  for(const d of destinations){const e=this.entries.get(d.id);if(!e||e.active===d.unlocked)continue;
   const p=SURFACE_PORTALS.find(p=>p.id===d.id)!;e.active=d.unlocked;
   e.materials.forEach((m,i)=>m.color.copy(e.colors[i]).multiplyScalar(d.unlocked?1:.22));
   e.ring.color.set(d.unlocked?p.color:'#657b92');e.fill.color.set(d.unlocked?p.color:'#192a3b').multiplyScalar(d.unlocked?.24:1);
   e.locked.visible=!d.unlocked;e.enter.visible=d.unlocked;
  }
  this.surface.userData.hub={petDisplayOnly:true,petStations:PET_DISPLAYS,portals:SURFACE_PORTALS.map(p=>({id:p.id,depth:p.depth,modelCenter:[p.x,0,p.z],zone:p.zone,unlocked:this.entries.get(p.id)?.active===true}))};
 }
}
