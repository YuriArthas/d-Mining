import { ShaderChunk, type MeshStandardMaterial } from 'three';

// Three r186 rotates its five PCF taps with screen-space noise. Without TAA that
// produces visible grain on broad penumbras. This symmetric filter keeps five hardware taps.
const chunk=ShaderChunk.shadowmap_pars_fragment;
const start=chunk.indexOf('float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;');
const end=chunk.indexOf(') * 0.2;',start);
if(start<0||end<0)throw new Error('Three.js shadow shader changed; review the stable five-tap filter');
const stableChunk=chunk.slice(0,start)+`
  vec2 spread=vec2(radius*.65);
  shadow=texture(shadowMap,vec3(shadowCoord.xy,shadowCoord.z))*.4;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+spread,shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy-spread,shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+vec2(spread.x,-spread.y),shadowCoord.z))*.15;
  shadow+=texture(shadowMap,vec3(shadowCoord.xy+vec2(-spread.x,spread.y),shadowCoord.z))*.15;
`+chunk.slice(end+') * 0.2;'.length);
export function compileStableShadow(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0]) {
  shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',stableChunk);
}
export function stabilizeShadows<T extends MeshStandardMaterial>(material:T):T {
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{compile.call(material,shader,renderer);compileStableShadow(shader)};
  material.customProgramCacheKey=()=>`${key}/stable-pcf5-v1`;
  return material;
}
