import { stabilizeShadows } from './stableShadow.ts';
import { DataTexture, DoubleSide, FrontSide, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, RepeatWrapping, RGBAFormat, type Texture } from 'three';
export type SurfaceFinish='default'|'stone'|'leaves'|'metal'|'water'|'wood'|'canvas'|'trail'|'ground'|'grass';
export const SURFACE_SHADER_VERSION='sunvale-material-v2';
export function createSurfaceNoise() {
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const a=x/size*Math.PI*2,b=y/size*Math.PI*2;
    const n=.5+.16*Math.sin(a*3+Math.sin(b*2))+.12*Math.cos(b*4-a)+.08*Math.sin(a*7+b*5)+.035*Math.cos(a*17-b*19);
    const i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(n*255);pixels[i+3]=255;
  }
  const texture=new DataTexture(pixels,size,size,RGBAFormat);texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;return texture;
}
export function createSurfaceMaterial(finish:SurfaceFinish,noise:Texture,albedo?:Texture,pathMask?:Texture) {
  const stone=finish==='stone',leaf=finish==='leaves',metal=finish==='metal',water=finish==='water',wood=finish==='wood',canvas=finish==='canvas',trail=finish==='trail',ground=finish==='ground',grass=finish==='grass';
  const time={value:0};
  const material=new MeshPhysicalMaterial({vertexColors:true,
    roughness:water?.25:metal?.46:stone?.93:wood?.88:canvas?.96:ground||trail||grass?1:leaf?.82:.85,
    metalness:metal?.28:0,specularIntensity:ground||trail||grass?0:stone||wood||canvas?.08:leaf?.12:metal?.5:water?.8:.22,
    envMapIntensity:water?1.2:metal?1:.85,
    transparent:trail,depthWrite:!trail,alphaTest:trail?.01:0,side:grass?DoubleSide:FrontSide,
  });
  material.onBeforeRender=()=>{time.value=performance.now()*.001};
  material.onBeforeCompile=shader=>{
    if(albedo)shader.uniforms.uMeadowAlbedo={value:albedo};
    if(pathMask)shader.uniforms.uPathMask={value:pathMask};
    shader.uniforms.uArtTime=time;shader.uniforms.uSurfaceNoise={value:noise};
    shader.vertexShader='uniform float uArtTime;\nattribute float artOcclusion;\nvarying float vArtOcclusion;\nvarying vec3 vArtWorld;\nvarying vec2 vArtUv;\n'+(grass?'attribute float grassFlex;\n':'')+shader.vertexShader;
    if(grass)shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 windPosition=(modelMatrix*vec4(position,1.0)).xyz;
      transformed.x+=sin(uArtTime*1.4+windPosition.x*.6+windPosition.z*.3)*.065*grassFlex/max(length(modelMatrix[0].xyz),.00001);
      transformed.z+=cos(uArtTime*.9+windPosition.z*.4)*.035*grassFlex/max(length(modelMatrix[2].xyz),.00001);`);
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvArtWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vArtOcclusion=artOcclusion;vArtUv=uv;');
    shader.fragmentShader=(albedo?'uniform sampler2D uMeadowAlbedo; uniform sampler2D uPathMask;\n':'')+'uniform float uArtTime;\nuniform sampler2D uSurfaceNoise;\nvarying float vArtOcclusion;\nvarying vec3 vArtWorld;\nvarying vec2 vArtUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float broadGrain=texture2D(uSurfaceNoise,(vArtWorld.xz+vArtWorld.y*vec2(.37,.61))*.055).r;
      float fineGrain=texture2D(uSurfaceNoise,(vArtWorld.xz+vArtWorld.y*vec2(.71,.43))*1.2).r;
      ${water?`float waterLines=sin(vArtWorld.z*5.0+uArtTime*1.3+sin(vArtWorld.x*1.3))+sin(vArtWorld.z*8.0-uArtTime*1.5+vArtWorld.x*2.8);
      diffuseColor.rgb*=.94+.07*waterLines;totalEmissiveRadiance+=diffuseColor.rgb*(.045+.08*pow(max(0.0,waterLines*.5),8.0));`:''}
      ${stone?`diffuseColor.rgb*=mix(.79,1.11,broadGrain)*mix(.94,1.04,fineGrain);`:''}
      ${leaf||grass?`diffuseColor.rgb*=mix(.82,1.12,broadGrain)*mix(.94,1.04,fineGrain);`:''}
      ${wood?`float bark=texture2D(uSurfaceNoise,vec2(vArtWorld.x+vArtWorld.z,vArtWorld.y*.13)*1.4).r;diffuseColor.rgb*=mix(.72,1.10,bark);`:''}
      ${canvas?`float weave=sin(vArtWorld.x*180.0)*sin(vArtWorld.z*180.0);diffuseColor.rgb*=mix(.95,1.04,fineGrain)+weave*.012;`:''}
      ${trail||ground?`diffuseColor.rgb*=mix(.84,1.07,broadGrain)*mix(.96,1.035,fineGrain);`:''}
      ${ground&&albedo?`vec3 turfPaint=texture2D(uMeadowAlbedo,vArtWorld.xz*.20).rgb;float turf=clamp((diffuseColor.g-diffuseColor.r)*6.0,0.0,1.0);diffuseColor.rgb*=mix(vec3(1.0),clamp(turfPaint/vec3(.10254,.41485,.03899),.5,1.6),turf*.60*(1.0-smoothstep(35.0,100.0,distance(cameraPosition,vArtWorld))));float path=texture2D(uPathMask,vec2(vArtWorld.x,-vArtWorld.z)/144.0+.5).r;path=clamp(path+(fineGrain-.5)*.24*path*(1.0-path),0.0,1.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.497,.332,.122)*mix(.83,1.12,fineGrain),path);`: ''}
      ${trail?`diffuseColor.a*=1.0-smoothstep(.67,1.0,abs(vArtUv.y*2.0-1.0));`:''}
    `);
    if(ground)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight=mix(outgoingLight,vec3(.24,.47,.68),smoothstep(110.0,400.0,distance(cameraPosition,vArtWorld))*.24);\n#include <opaque_fragment>`);
    if(water)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 ripple=vec3(sin(vArtWorld.x*1.7+vArtWorld.z*3.2+uArtTime)*.07,0.0,cos(vArtWorld.z*4.1-uArtTime*1.2)*.055);normal=normalize(normal+mat3(viewMatrix)*ripple);`);
    if(leaf||grass)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float backLight=pow(max(0.0,dot(normalize(cameraPosition-vArtWorld),normalize(vec3(36.0,-48.0,-26.0)))),2.0);
      outgoingLight+=diffuseColor.rgb*(.10+.19*backLight);
      #include <opaque_fragment>`);
    if(stone||wood)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float grainHeight=texture2D(uSurfaceNoise,(vArtWorld.xz+vArtWorld.y*vec2(.71,.43))*1.2).r;
      vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition),r1=cross(py,normal),r2=cross(normal,px);
      float det=dot(px,r1);normal=normalize(max(abs(det),.000001)*normal-sign(det)*.035*(dFdx(grainHeight)*r1+dFdy(grainHeight)*r2));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
      reflectedLight.indirectDiffuse*=vArtOcclusion;reflectedLight.indirectSpecular*=mix(.62,1.0,vArtOcclusion);
      reflectedLight.directDiffuse*=mix(.88,1.0,vArtOcclusion);`);
  };
  material.customProgramCacheKey=()=>`${SURFACE_SHADER_VERSION}-${finish}-${!!albedo}`;return stabilizeShadows(material);
}
