import {Group,SpotLight} from 'three';
import {SURFACE_AREA_LIGHT,SURFACE_FILL_LIGHTS} from '../world/SceneLighting.ts';
export class SceneLightingRig {
 readonly group=new Group();
 readonly key:SpotLight;
 readonly fills:SpotLight[]=[];
 constructor(){
  const p=SURFACE_AREA_LIGHT;this.group.name='independent-area-lighting';
  this.key=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);
  const light=this.key;light.name=p.id;light.position.set(...p.position);light.target.position.set(...p.target);
  light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0002;light.shadow.normalBias=.025;light.shadow.radius=2;
  light.shadow.camera.near=.1;light.shadow.camera.far=p.distance;this.group.add(light,light.target);
  for(const p of SURFACE_FILL_LIGHTS){
   const fill=new SpotLight(p.color,p.intensity,p.distance,p.angle,p.penumbra,2);fill.name=p.id;fill.position.set(p.position[0],p.position[1],p.position[2]);fill.target.position.set(p.target[0],p.target[1],p.target[2]);
   fill.castShadow=p.castShadow;fill.shadow.mapSize.set(512,512);fill.shadow.bias=-.0003;fill.shadow.normalBias=.035;fill.shadow.camera.near=.1;fill.shadow.camera.far=p.distance;
   this.fills.push(fill);this.group.add(fill,fill.target);
  }
 }
 setSurfaceActive(active:boolean){const changed=this.group.visible!==active;this.group.visible=active;return changed;}
 diagnostics(){return {independentOfDecorations:true,fillLights:this.fills.length,shadowLights:1+this.fills.filter(light=>light.castShadow).length,active:this.group.visible,position:this.key.position.toArray(),target:this.key.target.position.toArray(),intensity:this.key.intensity,castsShadow:this.key.castShadow,shadowMapSize:this.key.shadow.mapSize.x};}
 dispose(){for(const light of this.fills)light.dispose();this.key.dispose();this.group.removeFromParent();this.group.clear();}
}
