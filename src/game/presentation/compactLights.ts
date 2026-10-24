import { ShaderChunk, type MeshStandardMaterial } from 'three';
import { SURFACE_FILL_LIGHTS } from '../world/SceneLighting.ts';

type Shader = Parameters<MeshStandardMaterial['onBeforeCompile']>[0];
// The night spotlights have no shadow maps or projected textures. Keep Three's exact attenuation and PBR
// response, but loop over them with one uniform count instead of expanding a copy of the body per light.
export function compileCompactLights(shader: Shader) {
 if(shader.uniforms.miningSpotCount||!shader.fragmentShader.includes('#include <lights_fragment_begin>'))return;
 const original=ShaderChunk.lights_fragment_begin;
 const begin=original.indexOf('\t#pragma unroll_loop_start',original.indexOf('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )'));
 const end=original.indexOf('\t#pragma unroll_loop_end',begin)+'\t#pragma unroll_loop_end'.length;
 if(begin<0||end<begin)throw new Error('Three spotlight loop changed');
 const loop=`
 #if NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_MAPS > 0
 #error Compact spotlight loop requires unshadowed lights without projected textures
 #endif
 for ( int i = 0; i < miningSpotCount; i ++ ) {
  spotLight = spotLights[ i ];
  getSpotLightInfo( spotLight, geometryPosition, directLight );
  RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
 }
 `;
 shader.uniforms.miningSpotCount={value:SURFACE_FILL_LIGHTS.length+1};
 shader.fragmentShader='uniform int miningSpotCount;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',original.slice(0,begin)+loop+original.slice(end));
}
const installed=new WeakSet<MeshStandardMaterial['onBeforeCompile']>();
/** Installs the compact spotlight loop once per material (copies sharing the hook keep one program key). */
export function withCompactLights<T extends MeshStandardMaterial>(material:T):T {
  if(installed.has(material.onBeforeCompile))return material;
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{compile.call(material,shader,renderer);compileCompactLights(shader);};
  installed.add(material.onBeforeCompile);
  material.customProgramCacheKey=()=>`${key}/compact-lights-v2`;
  return material;
}
