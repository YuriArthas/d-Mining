import type { MeshStandardMaterial } from 'three';
import { SURFACE_TRAILS } from '../world/surfaceLayout.ts';
// Paint the generated Tripo ground mesh in world space. No additional meshes,
// textures or distance-dependent resources; preserve the open voxel shaft.
export function paintCampGround(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile;
 const segments=SURFACE_TRAILS.flatMap(t=>t.points.slice(1).map((b,i)=>{const a=t.points[i];return `pathDistance=min(pathDistance,campSegment(campWorld.xz,vec2(${a[0].toFixed(2)},${a[2].toFixed(2)}),vec2(${b[0].toFixed(2)},${b[2].toFixed(2)}))-${(t.width*.5).toFixed(2)});`;})).join('\n');
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=`
float campHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float campNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(campHash(i),campHash(i+vec2(1,0)),f.x),mix(campHash(i+vec2(0,1)),campHash(i+vec2(1,1)),f.x),f.y);}
float campSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float campBroad=campNoise(campWorld.xz*.19);
float campFine=campNoise(campWorld.xz*3.0);
vec3 grassTone=mix(vec3(.085,.235,.023),vec3(.20,.37,.043),smoothstep(.2,.82,campBroad));
// Broad clean grass with sparse angular flecks, independent of mesh triangles.
vec2 grassCell=floor(campWorld.xz*2.2),grassUV=fract(campWorld.xz*2.2)-.5;
float grassSeed=campHash(grassCell);
vec2 grassSlant=mat2(.88,.48,-.48,.88)*grassUV;
float fleck=(1.-smoothstep(.11,.15,abs(grassSlant.x)))*(1.-smoothstep(.23,.27,abs(grassSlant.y)))*step(.3,grassSeed);
diffuseColor.rgb=grassTone*(.96+campFine*.06+fleck*.12);
float pathDistance=1000.0;
${segments}
pathDistance=min(pathDistance,(length((campWorld.xz-vec2(0.,27.))/vec2(1.1,1.))-9.0));
float campPath=1.0-smoothstep(-.2,.45,pathDistance+(campNoise(campWorld.xz*1.4)-.5)*.38);
vec3 campSoil=mix(vec3(.49,.355,.19),vec3(.61,.46,.27),campBroad)*(.95+campFine*.1);
diffuseColor.rgb=mix(diffuseColor.rgb,campSoil,campPath);
float campWorkEdge=max(abs(campWorld.x)/12.5,abs(campWorld.z)/12.0);
float campWork=1.0-smoothstep(.96,1.07,campWorkEdge+(campNoise(campWorld.xz*1.1)-.5)*.035);
float campRail= (1.0-smoothstep(.85,1.45,abs(campWorld.x+18.0)))*(1.0-smoothstep(8.0,10.0,abs(campWorld.z+5.0)));
campWork=max(campWork,campRail);
float campGravel=campNoise(floor(campWorld.xz*7.0));
vec3 campPackedEarth=mix(vec3(.23,.17,.105),vec3(.36,.295,.19),campBroad)*(.9+campGravel*.2);
diffuseColor.rgb=mix(diffuseColor.rgb,campPackedEarth,campWork*.95);
`);
 };
 material.customProgramCacheKey=()=> 'camp-tripo-ground-shaft-hub-v5';
}
