import type { MeshStandardMaterial, Texture } from 'three';
import { SURFACE_ROADS } from '../world/surfaceLayout.ts';
import {POND_DISTANCE_GLSL} from '../world/SurfacePonds.ts';
// Paint the generated Tripo ground mesh in world space. No additional meshes,
// distance-dependent resources; one shared pixel atlas, preserve the open voxel shaft.
export function paintCampGround(material:MeshStandardMaterial,atlas:Texture,contact:{texture:Texture;strength:{value:number};bounds:{minX:number;maxX:number;minZ:number;maxZ:number};floorY:number}){
 // World-space painted ground has its own surface response. Imported meadow
 // normal/ORM/AO maps describe a different material and caused muddy grazing highlights.
 material.map=null;material.normalMap=null;material.bumpMap=null;
 material.roughnessMap=null;material.metalnessMap=null;material.aoMap=null;
 material.roughness=1;material.metalness=0;material.envMapIntensity=0;
 const previous=material.onBeforeCompile;
 const segments=SURFACE_ROADS.map(r=>`pathDistance=min(pathDistance,campRoad(campWorld.xz,vec2(${((r.minX+r.maxX)/2).toFixed(3)},${((r.minZ+r.maxZ)/2).toFixed(3)}),vec2(${((r.maxX-r.minX)/2).toFixed(3)},${((r.maxZ-r.minZ)/2).toFixed(3)})));`).join('\n');
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);shader.uniforms.campAtlas={value:atlas};
  shader.uniforms.campContact={value:contact.texture};shader.uniforms.campContactStrength=contact.strength;
  shader.fragmentShader=`
uniform sampler2D campAtlas;
uniform sampler2D campContact;
uniform float campContactStrength;
${POND_DISTANCE_GLSL}
float campGrain(vec2 p,vec2 tile){vec2 uv=fract(p)*.5+tile*.5;return textureGrad(campAtlas,uv,dFdx(p)*.5,dFdy(p)*.5).r*2.;}
float campHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float campNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(campHash(i),campHash(i+vec2(1,0)),f.x),mix(campHash(i+vec2(0,1)),campHash(i+vec2(1,1)),f.x),f.y);}
float campRoad(vec2 p,vec2 center,vec2 halfSize){vec2 q=abs(p-center)-halfSize;return length(max(q,0.))+min(max(q.x,q.y),0.);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float campBroad=campNoise(campWorld.xz*.19);
vec3 grassTone=mix(vec3(.12,.38,.035),vec3(.16,.43,.055),campBroad);
diffuseColor.rgb=grassTone*campGrain(campWorld.xz*.5,vec2(0.,0.));
float pathDistance=1000.0;
${segments}
float campPath=1.0-smoothstep(-.025,.025,pathDistance);
// Smaller worn sandstone pavers. Shallow bevel height participates in real lighting.
vec2 paving=campWorld.xz/vec2(.9,.6);
paving.x+=mod(floor(paving.y),2.)*.5;
vec2 pavingCell=floor(paving),pavingEdge=min(fract(paving),1.-fract(paving))*vec2(.9,.6);
float edgeDistance=min(pavingEdge.x,pavingEdge.y)+(campNoise(campWorld.xz*17.)-.5)*.005;
float aa=max(fwidth(edgeDistance),.002);
float joint=1.-smoothstep(.006-aa,.014+aa,edgeDistance);
vec3 stone=mix(vec3(.35,.295,.22),vec3(.395,.335,.255),campHash(pavingCell));
stone*=mix(.94,1.06,campNoise(campWorld.xz*4.3));
stone*=mix(.97,1.03,campGrain(campWorld.xz*.5,vec2(1.,0.))*.5);
vec3 campSoil=mix(stone,vec3(.235,.203,.15),joint*.42);
float campBevelHeight=.009*smoothstep(.006,.06,edgeDistance);
campBevelHeight+=.0015*campNoise(campWorld.xz*6.);
float campReliefFade=1.-smoothstep(.08,.3,length(fwidth(campWorld.xz)));
diffuseColor.rgb=mix(diffuseColor.rgb,campSoil,campPath);
float campWorkEdge=max(abs(campWorld.x)/12.5,abs(campWorld.z)/12.0);
float campWork=1.0-smoothstep(.96,1.07,campWorkEdge+(campNoise(campWorld.xz*1.1)-.5)*.035);
float campRail= (1.0-smoothstep(.85,1.45,abs(campWorld.x+18.0)))*(1.0-smoothstep(8.0,10.0,abs(campWorld.z+5.0)));
campWork=max(campWork,campRail);
vec3 campPackedEarth=mix(vec3(.28,.22,.12),vec3(.32,.26,.15),campBroad)*mix(.8,1.2,campGrain(campWorld.xz*.65,vec2(0.,1.))*.5);
diffuseColor.rgb=mix(diffuseColor.rgb,campPackedEarth,campWork*.95);
float pondBed=1.-step(.001,gardenPondDistance(campWorld.xz));
vec2 gravelCell=floor(campWorld.xz*8.);
vec3 gravel=mix(vec3(.26,.25,.15),vec3(.42,.40,.27),campHash(gravelCell));
diffuseColor.rgb=mix(diffuseColor.rgb,gravel,pondBed);
`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
// Offline contact occlusion from selected real meshes, on the ground only.
vec2 contactUV=vec2((campWorld.x-(${contact.bounds.minX.toFixed(3)}))/${(contact.bounds.maxX-contact.bounds.minX).toFixed(3)},(${contact.bounds.maxZ.toFixed(3)}-campWorld.z)/${(contact.bounds.maxZ-contact.bounds.minZ).toFixed(3)});
float contactInside=step(0.,contactUV.x)*step(contactUV.x,1.)*step(0.,contactUV.y)*step(contactUV.y,1.);
float contactFloor=1.-smoothstep(.08,.4,abs(campWorld.y-${contact.floorY.toFixed(3)}));
outgoingLight*=mix(1.,texture2D(campContact,contactUV).r,campContactStrength*contactInside*contactFloor);
#include <opaque_fragment>`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
// Derivative bump mapping: small bevels change the response to every actual light.
// Fade below a pixel instead of leaving noisy far-distance highlights.
vec3 campDpX=dFdx(-vViewPosition),campDpY=dFdy(-vViewPosition);
vec3 campR1=cross(campDpY,normal),campR2=cross(normal,campDpX);
float campDet=dot(campDpX,campR1);
vec3 campGrad=sign(campDet)*(dFdx(campBevelHeight)*campR1+dFdy(campBevelHeight)*campR2);
vec3 campBump=normalize(max(abs(campDet),.000001)*normal-campGrad);
normal=normalize(mix(normal,campBump,campPath*(1.-campWork)*campReliefFade));
`);
 };
 material.customProgramCacheKey=()=> 'camp-ground-baked-contact-v24';
}
