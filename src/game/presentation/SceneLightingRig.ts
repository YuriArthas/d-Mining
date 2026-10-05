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
  this.setTime('day');
 }
 setTime(time:SurfaceTime){
  if(this.time===time)return false;
  this.time=time;const night=time==='night';
  this.key.intensity=night?SURFACE_AREA_LIGHT.intensity:0;
  this.fills.forEach((light,i)=>light.intensity=night?SURFACE_FILL_LIGHTS[i].intensity:0);
  this.streetLights.forEach((light,i)=>light.intensity=night?STREET_LIGHTS[i].light.intensity:0);
  this.wallLights.forEach((light,i)=>light.intensity=night?WALL_TORCHES[i].light.intensity:0);
  // Intensity zero alone leaves lights/shadow uniforms in Three's render list.
  // Hiding light nodes removes that work; decoration and scenery stay resident.
  for(const light of [this.key,...this.fills,...this.streetLights,...this.wallLights])light.visible=night;
  localPointLighting.enabled.value=night&&this.group.visible?1:0;
  return true;
 }
 setSurfaceActive(active:boolean){const changed=this.group.visible!==active;this.group.visible=active;localPointLighting.enabled.value=active&&this.time==='night'?1:0;return changed;}
 diagnostics(){return {localPointGrid:localPointLighting.diagnostics(),wallLights:this.wallLights.map(p=>({id:p.name,type:p.type,position:p.position.toArray(),intensity:p.intensity,distance:p.distance,visible:p.visible,castsShadow:p.castShadow})),streetLights:this.streetLights.map(p=>({id:p.name,type:p.type,position:p.position.toArray(),intensity:p.intensity,distance:p.distance,castsShadow:p.castShadow})),independentOfDecorations:true,time:this.time,fillLights:this.fills.length,shadowLights:[this.key,...this.fills].filter(light=>light.castShadow).length,activeShadowLights:this.group.visible?[this.key,...this.fills].filter(light=>light.visible&&light.castShadow).length:0,activeLights:this.group.visible?this.group.children.filter(light=>light instanceof PointLight||light instanceof SpotLight).filter(light=>light.visible).length:0,shadowPolicy:'baked-ground-only',active:this.group.visible,position:this.key.position.toArray(),target:this.key.target.position.toArray(),intensity:this.key.intensity,castsShadow:this.key.castShadow,shadowMapSize:this.key.shadow.mapSize.x};}
 dispose(){for(const light of [...this.fills,...this.streetLights,...this.wallLights])light.dispose();this.key.dispose();localPointLighting.enabled.value=0;localPointLighting.dispose();this.group.removeFromParent();this.group.clear();}
}
