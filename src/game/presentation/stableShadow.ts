import {compileLocalPointLights} from './LocalPointLighting.ts';
import {SURFACE_FILL_LIGHTS} from '../world/SceneLighting.ts';
import { ShaderChunk, type MeshStandardMaterial } from 'three';

// One sampler2DShadow lookup already performs bilinear (2x2) hardware PCF.
// Keep the wider five-lookup filter as a public A/B option, not the default.
export const SHADOW_FILTER_TAPS:1|5=typeof location!=='undefined'&&new URLSearchParams(location.search).get('shadowFilter')==='wide'?5:1;
export const SHADOW_FILTER_ID=SHADOW_FILTER_TAPS===1?'hardware-pcf1-v2':'stable-pcf5-v1';
const chunk=ShaderChunk.shadowmap_pars_fragment;
const start=chunk.indexOf('float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;');
const end=chunk.indexOf(') * 0.2;',start);
if(start<0||end<0)throw new Error('Three.js shadow shader changed; review the stable five-tap filter');
const wideChunk=chunk.slice(0,start)+`
  vec2 spread=vec2(radius*.65);
  shadow=texture(shadowMap,vec3(shadowCoord.xy,shadowCoord.z))*.4;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+spread,shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy-spread,shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+vec2(spread.x,-spread.y),shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+vec2(-spread.x,spread.y),shadowCoord.z))*.15;
`+chunk.slice(end+') * 0.2;'.length);
const compactChunk=chunk.slice(0,start)+`
  // mining-shadow-filter: hardware-pcf1
  shadow=texture(shadowMap,vec3(shadowCoord.xy,shadowCoord.z));
`+chunk.slice(end+') * 0.2;'.length);
export function compileShadowFilter(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0],taps:1|5) {
  shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',taps===1?compactChunk:wideChunk);
}
// These authored lights have no shadow maps or projected textures. Keep their
// exact Three attenuation/PBR response, but don't expand ten copies of the body.
export function compileCompactLights(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0]) {
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
export function compileStableShadow(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0]) {
  compileShadowFilter(shader,SHADOW_FILTER_TAPS);
  compileLocalPointLights(shader);
  compileCompactLights(shader);
}
export function stabilizeShadows<T extends MeshStandardMaterial>(material:T):T {
  if(installed.has(material.onBeforeCompile))return material;
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{compile.call(material,shader,renderer);compileStableShadow(shader)};
  installed.add(material.onBeforeCompile);
  material.customProgramCacheKey=()=>`${key}/${SHADOW_FILTER_ID}/compact-lights-v2`;
  return material;
}
