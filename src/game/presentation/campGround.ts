import type { MeshStandardMaterial, Texture } from 'three';
import type {SurfaceDetailContent} from '../content/surfaceDetails.ts';
import {ROAD_STONE_GLSL} from './roadStone.ts';
// Paint the generated Tripo ground mesh in world space. No additional meshes,
// distance-dependent resources; shared pixel atlases, preserve the open voxel shaft.
export function paintCampGround(content:SurfaceDetailContent['ground'],material:MeshStandardMaterial,atlas:Texture,stoneAtlas:Texture,contact:{texture:Texture;strength:{value:number};bounds:{minX:number;maxX:number;minZ:number;maxZ:number};floorY:number}){
 const {roads:SURFACE_ROADS,pondDistanceGLSL:POND_DISTANCE_GLSL,paving}=content;
 const glFloat=(n:number)=>n.toFixed(4);
 const glVec=(values:readonly number[])=>`vec${values.length}(${values.map(glFloat).join(',')})`;
 // World-space painted ground has its own surface response. Imported meadow
 // normal/ORM/AO maps describe a different material and caused muddy grazing highlights.
 material.map=null;material.normalMap=null;material.bumpMap=null;
 material.roughnessMap=null;material.metalnessMap=null;material.aoMap=null;
 material.roughness=1;material.metalness=0;material.envMapIntensity=0;
 const previous=material.onBeforeCompile;
 const segments=SURFACE_ROADS.map(r=>`pathDistance=min(pathDistance,campRoad(campWorld.xz,vec2(${((r.minX+r.maxX)/2).toFixed(3)},${((r.minZ+r.maxZ)/2).toFixed(3)}),vec2(${((r.maxX-r.minX)/2).toFixed(3)},${((r.maxZ-r.minZ)/2).toFixed(3)})));`).join('\n');
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);shader.uniforms.campAtlas={value:atlas};
  shader.uniforms.roadStoneAtlas={value:stoneAtlas};
  shader.uniforms.campContact={value:contact.texture};shader.uniforms.campContactStrength=contact.strength;
  shader.fragmentShader=`
uniform sampler2D campAtlas;
uniform sampler2D campContact;
uniform float campContactStrength;
${ROAD_STONE_GLSL}
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
// Chunky flagstones: each staggered module contains two or three unequal slabs.
// Randomize the split, not every pixel: broad faces stay quiet and readable.
vec2 slabModule=${glVec(paving.module)};
vec2 paving=campWorld.xz/slabModule;
paving.x+=campHash(vec2(floor(paving.y),91.))*0.8;
vec2 pavingCell=floor(paving),slabUV=fract(paving);
float splitX=mix(.36,.64,campHash(pavingCell+17.));
float slabSide=step(splitX,slabUV.x);
vec2 slabMin=vec2(mix(0.,splitX,slabSide),0.);
vec2 slabMax=vec2(mix(splitX,1.,slabSide),1.);
float splitSlab=step(.46,campHash(pavingCell+43.))
 *step(.5,1.-abs(slabSide-step(.5,campHash(pavingCell+61.))));
float splitZ=mix(.40,.60,campHash(pavingCell+29.));
float slabRow=step(splitZ,slabUV.y)*splitSlab;
slabMin.y=slabRow*splitZ;
slabMax.y=mix(1.,splitZ,splitSlab*(1.-slabRow));
vec2 slabID=pavingCell*3.+vec2(slabSide,slabRow);
vec2 slabSize=(slabMax-slabMin)*slabModule;
vec2 stoneUV=(slabUV-slabMin)/(slabMax-slabMin);
vec2 stoneFlip=mix(vec2(1.),vec2(-1.),step(vec2(.5),vec2(campHash(slabID+81.),campHash(slabID+93.))));
stoneUV=(stoneUV-.5)*stoneFlip+.5;
vec4 stoneDetail=roadStoneSample(stoneUV,floor(campHash(slabID+71.)*4.),dFdx(campWorld.xz)/slabSize*stoneFlip,dFdy(campWorld.xz)/slabSize*stoneFlip);
vec2 slabEdge=min(slabUV-slabMin,slabMax-slabUV)*slabModule;
float cornerCut=mix(${glFloat(paving.cornerCut[0])},${glFloat(paving.cornerCut[1])},campHash(slabID+7.));
float edgeDistance=min(min(slabEdge.x,slabEdge.y),(slabEdge.x+slabEdge.y-cornerCut)*.7071);
edgeDistance-=stoneDetail.a*.07;
float aa=max(length(fwidth(campWorld.xz))*.65,.002);
float jointWidth=${glFloat(paving.jointHalfWidth)}*mix(.8,1.25,campHash(slabID+57.));
float joint=1.-smoothstep(jointWidth-aa,jointWidth+aa,edgeDistance);
float slabColor=campHash(slabID+113.);
vec3 stone=mix(${glVec(paving.colors.sandstone)},${glVec(paving.colors.paleStone)},campHash(slabID+5.));
stone=mix(stone,${glVec(paving.colors.greyStone)},step(.78,slabColor));
stone=mix(stone,${glVec(paving.colors.clayStone)},step(.93,slabColor));
// Authored pixel fracture faces replace random per-pixel noise. The same mask
// supplies shallow relief; a narrow linear edge reads as a chipped hard cut.
stone*=1.+(stoneDetail.r*2.-1.)*${glFloat(paving.textureContrast)};
float bevel=clamp((edgeDistance-jointWidth)/(${glFloat(paving.bevelWidth)}-jointWidth),0.,1.);
stone*=mix(.83,1.,bevel);
float dirtPocket=stoneDetail.b*(1.-smoothstep(.02,.15,edgeDistance));
stone=mix(stone,${glVec(paving.colors.joint)},dirtPocket*.55);
float edgeMoss=(1.-smoothstep(0.,${glFloat(paving.edgeMossWidth)},-pathDistance))
 *smoothstep(.64,.8,campNoise(floor(campWorld.xz*10.)*.17));
float seamMoss=joint*stoneDetail.b*step(.6,campHash(slabID+31.));
vec3 campSoil=mix(stone,${glVec(paving.colors.joint)},joint*.85);
campSoil=mix(campSoil,${glVec(paving.colors.moss)},max(edgeMoss*.7,seamMoss*.8));
float campBevelHeight=${glFloat(paving.bevelHeight)}*bevel+(stoneDetail.g-.5)*${glFloat(paving.surfaceRelief)}*(1.-joint);
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
 material.customProgramCacheKey=()=> 'camp-ground-pixel-stone-v26:'+JSON.stringify(paving);
}
