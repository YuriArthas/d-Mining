import {localPointLighting} from './LocalPointLighting.ts';
import {Group,SpotLight,PointLight} from 'three';
import {SURFACE_AREA_LIGHT,SURFACE_FILL_LIGHTS,type SurfaceTime} from '../world/SceneLighting.ts';
import {WALL_TORCHES} from '../world/WallTorches.ts';
import {STREET_LIGHTS} from '../world/StreetLights.ts';
export class SceneLightingRig {
 readonly group=new Group();
 readonly key:SpotLight;
 readonly fills:SpotLight[]=[];
 readonly streetLights:PointLight[]=[];
 readonly wallLights:PointLight[]=[];
 private time:SurfaceTime='night';
 private daylight=0;
 private strength=1;
 private readonly lightLevels:{light:SpotLight|PointLight;intensity:number}[]=[];
 constructor(){
  const p=SURFACE_AREA_LIGHT;this.group.name='independent-area-lighting';
  this.key=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);
  const light=this.key;light.name=p.id;light.position.set(p.position[0],p.position[1],p.position[2]);light.target.position.set(...p.target);
  light.castShadow=false;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0002;light.shadow.normalBias=.025;light.shadow.radius=2;
  light.shadow.camera.near=.1;light.shadow.camera.far=p.distance;this.group.add(light,light.target);
  for(const p of SURFACE_FILL_LIGHTS){
   const fill=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);fill.name=p.id;fill.position.set(p.position[0],p.position[1],p.position[2]);fill.target.position.set(p.target[0],p.target[1],p.target[2]);
   fill.castShadow=p.castShadow;fill.shadow.mapSize.set(512,512);fill.shadow.bias=-.0003;fill.shadow.normalBias=.035;fill.shadow.camera.near=.1;fill.shadow.camera.far=p.distance;
   this.fills.push(fill);this.group.add(fill,fill.target);
  }
  for(const {id,light:p} of STREET_LIGHTS){
   const light=new PointLight(p.color,p.intensity,p.distance,p.decay);light.name=id;light.position.set(p.position[0],p.position[1],p.position[2]);
   this.streetLights.push(light);if(this.streetLights.length<=2)this.group.add(light);
  }
  for(const {id,light:p} of WALL_TORCHES){
   const light=new PointLight(p.color,p.intensity,p.distance,p.decay);light.name=id;light.position.set(p.position[0],p.position[1],p.position[2]);light.castShadow=false;
   this.wallLights.push(light);
  }
  for(const light of [this.key,...this.fills,...this.streetLights,...this.wallLights])
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
  localPointLighting.enabled.value=strength;
 }
 diagnostics(){return {strength:this.strength,daylightBlend:this.daylight,localPointGrid:localPointLighting.diagnostics(),wallLights:this.wallLights.map(p=>({id:p.name,type:p.type,position:p.position.toArray(),intensity:p.intensity,distance:p.distance,visible:p.visible,castsShadow:p.castShadow})),streetLights:this.streetLights.map(p=>({id:p.name,type:p.type,position:p.position.toArray(),intensity:p.intensity,distance:p.distance,castsShadow:p.castShadow})),independentOfDecorations:true,time:this.time,fillLights:this.fills.length,shadowLights:[this.key,...this.fills].filter(light=>light.castShadow).length,activeShadowLights:this.group.visible?[this.key,...this.fills].filter(light=>light.visible&&light.castShadow).length:0,activeLights:this.group.visible?this.group.children.filter(light=>light instanceof PointLight||light instanceof SpotLight).filter(light=>light.visible).length:0,shadowPolicy:'baked-ground-only',active:this.group.visible,position:this.key.position.toArray(),target:this.key.target.position.toArray(),intensity:this.key.intensity,castsShadow:this.key.castShadow,shadowMapSize:this.key.shadow.mapSize.x};}
 dispose(){for(const light of [...this.fills,...this.streetLights,...this.wallLights])light.dispose();this.key.dispose();localPointLighting.enabled.value=0;localPointLighting.dispose();this.group.removeFromParent();this.group.clear();}
}
