import {Group,SpotLight} from 'three';
import {SURFACE_AREA_LIGHT,SURFACE_FILL_LIGHTS,type SurfaceTime} from '../world/SceneLighting.ts';
export class SceneLightingRig {
 readonly group=new Group();
 readonly key:SpotLight;
 readonly fills:SpotLight[]=[];
 private time:SurfaceTime='night';
 private daylight=0;
 private strength=1;
 private readonly lightLevels:{light:SpotLight;intensity:number}[]=[];
 constructor(){
  const p=SURFACE_AREA_LIGHT;this.group.name='independent-area-lighting';
  this.key=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);
  const light=this.key;light.name=p.id;light.position.set(p.position[0],p.position[1],p.position[2]);light.target.position.set(...p.target);
  this.group.add(light,light.target);
  for(const p of SURFACE_FILL_LIGHTS){
   const fill=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);fill.name=p.id;fill.position.set(p.position[0],p.position[1],p.position[2]);fill.target.position.set(p.target[0],p.target[1],p.target[2]);
   this.fills.push(fill);this.group.add(fill,fill.target);
  }
  for(const light of [this.key,...this.fills])
   this.lightLevels.push({light,intensity:light.intensity});
  this.setTime('day');
 }
 setTime(time:SurfaceTime){
  return this.setDaylight(time==='day'?1:0);
 }
 setDaylight(value:number){
  const daylight=Math.max(0,Math.min(1,value));
  if(this.daylight===daylight)return false;
  this.daylight=daylight;this.time=daylight>=.5?'day':'night';this.applyStrength();return true;
 }
 setSurfaceStrength(strength:number){
  const next=Math.max(0,Math.min(1,strength));
  if(next===this.strength)return false;
  this.strength=next;this.applyStrength();return true;
 }
 setSurfaceActive(active:boolean){return this.setSurfaceStrength(active?1:0);}
 private applyStrength(){
  const strength=(1-this.daylight)*this.strength;
  this.group.visible=this.strength>0;
  // Only uniforms change during descent. Remove the light nodes from Three's
  // render list at zero; no per-frame allocations or extra shadow passes.
  for(const {light,intensity} of this.lightLevels){
   light.intensity=intensity*strength;
   light.visible=strength>0;
  }
 }
 diagnostics(){return {strength:this.strength,daylightBlend:this.daylight,independentOfDecorations:true,time:this.time,fillLights:this.fills.length,activeLights:this.group.visible?this.group.children.filter(light=>light instanceof SpotLight).filter(light=>light.visible).length:0,shadowPolicy:'baked-light',active:this.group.visible,position:this.key.position.toArray(),target:this.key.target.position.toArray(),intensity:this.key.intensity};}
 dispose(){for(const light of this.fills)light.dispose();this.key.dispose();this.group.removeFromParent();this.group.clear();}
}
