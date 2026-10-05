import {MeshStandardMaterial} from 'three';

// Color and light response are independent of the generated block topology.
export function styleMineBlock(material:MeshStandardMaterial){
 material.metalness=0;material.roughness=.82;material.envMapIntensity=.3;
 material.flatShading=true;material.vertexColors=false;
 const compile=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  // Generated cubes contain small face/normal deviations. Shade their broad
  // faces like planar building blocks; keep geometry, UVs and silhouettes intact.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 blockN=inverseTransformDirection(normal,viewMatrix);
    vec3 blockA=abs(blockN);
    blockN=blockA.x>blockA.y && blockA.x>blockA.z?vec3(sign(blockN.x),0.,0.):blockA.y>blockA.z?vec3(0.,sign(blockN.y),0.):vec3(0.,0.,sign(blockN.z));
    normal=normalize(mat3(viewMatrix)*blockN);
  `);
 };
 material.customProgramCacheKey=()=> 'mine-planar-painted-v1';
}

export function styleMineLens(material:MeshStandardMaterial,night={value:1}){
 material.normalScale.set(0,0);material.metalness=0;material.roughness=.82;
 const compile=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);shader.uniforms.lampNight=night;shader.fragmentShader='uniform float lampNight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float mineLens=step(.45,diffuseColor.g)*step(.25,diffuseColor.b)*smoothstep(.25,.7,-inverseTransformDirection(normal,viewMatrix).y);
    float warmPaint=step(diffuseColor.b*1.3,diffuseColor.g)*step(.12,diffuseColor.r);
    diffuseColor.rgb=mix(vec3(.055,.075,.1),vec3(.96,.48,.03),warmPaint);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.89,.65),mineLens);
    totalEmissiveRadiance+=vec3(1.,.66,.25)*mineLens*2.5*lampNight;
  `);
 };
 material.customProgramCacheKey=()=> 'mine-downward-lens-v2';
}

export function styleMineBadge(material:MeshStandardMaterial){
 material.normalScale.set(0,0);material.aoMapIntensity=0;material.roughness=.82;material.metalness=0;
 const compile=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  // Keep the generated painted regions, remove their baked light/dark blotches.
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec3 badge=diffuseColor.rgb;
    float badgeMax=max(badge.r,max(badge.g,badge.b));
    float badgeSat=(badgeMax-min(badge.r,min(badge.g,badge.b)))/max(badgeMax,.001);
    float badgeGB=badge.g/max(badge.b,.001);
    float badgeBlue=smoothstep(.3,.5,badgeSat)*(1.-smoothstep(.42,.7,badgeGB))*step(badge.r,badge.b);
    float badgeGold=smoothstep(.4,.65,badgeSat)*step(badge.b*1.8,badge.g)*step(badge.b*1.8,badge.r);
    float badgeCyan=smoothstep(.25,.45,badgeSat)*smoothstep(.5,.7,badgeGB)*smoothstep(.05,.15,badge.g-badge.r);
    diffuseColor.rgb=mix(vec3(.93,.87,.72),vec3(.025,.19,.72),badgeBlue);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.61,.08),badgeGold);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.77,.93),badgeCyan);
  `);
 };
 material.customProgramCacheKey=()=> 'mine-badge-clean-palette-v1';
}
