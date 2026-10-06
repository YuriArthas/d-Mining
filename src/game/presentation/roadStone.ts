import { DataTexture, LinearMipmapLinearFilter, NearestFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three';
import type { MeshStandardMaterial, Texture } from 'three';
import atlas from '../assets/ground-details/road-stone.json' with { type: 'json' };

// SurfaceDetails owns this texture; road and curb materials only borrow it.
export function createRoadStoneTexture() {
  const source = Uint8Array.from(atob(atlas.data), c => c.charCodeAt(0));
  // The drawing consists of 4x4 pixel blocks. Expand once on load instead of
  // shipping sixteen identical copies of each source pixel in the JS payload.
  const sourcePixels = new Uint32Array(source.buffer);
  const pixels = new Uint32Array(atlas.size * atlas.size);
  const scale = atlas.size / atlas.sourceSize;
  for (let y = 0; y < atlas.size; y++) {
    const row = Math.floor(y / scale) * atlas.sourceSize;
    for (let x = 0; x < atlas.size; x++) {
      pixels[y * atlas.size + x] = sourcePixels[row + Math.floor(x / scale)];
    }
  }
  const bytes = new Uint8Array(pixels.buffer);
  const texture = new DataTexture(bytes, atlas.size, atlas.size, RGBAFormat, UnsignedByteType);
  texture.name = 'authored-road-stone-256';
  texture.colorSpace = NoColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// Explicit gradients keep random tile selection from choosing a blurry mip at
// cell boundaries. Gutters isolate the four authored variants at ordinary LODs.
export const ROAD_STONE_GLSL = `
uniform sampler2D roadStoneAtlas;
vec4 roadStoneSample(vec2 uv, float variant, vec2 dx, vec2 dy) {
  vec2 tile = vec2(mod(variant, 2.), floor(variant / 2.));
  vec2 atlasUV = tile * .5 + (4. + clamp(uv, 0., 1.) * 120.) / 256.;
  return textureGrad(roadStoneAtlas, atlasUV, dx * (120. / 256.), dy * (120. / 256.));
}
`;

export function paintStoneCurbs(material: MeshStandardMaterial, texture: Texture) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.roadStoneAtlas = { value: texture };
    shader.vertexShader = 'varying vec3 curbStoneWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec4 curbPosition = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        curbPosition = instanceMatrix * curbPosition;
      #endif
      curbStoneWorld = (modelMatrix * curbPosition).xyz;
    `);
    shader.fragmentShader = 'varying vec3 curbStoneWorld;\n' + ROAD_STONE_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 stoneUV = vec2(curbStoneWorld.x + curbStoneWorld.z, curbStoneWorld.y * 2.) * .65;
      vec4 stone = roadStoneSample(fract(stoneUV), 2., dFdx(stoneUV), dFdy(stoneUV));
      diffuseColor.rgb *= mix(.78, 1.20, stone.r);
      // Dirt at the foot of the existing raised curb, without another decal mesh.
      float soil = 1. - smoothstep(.02, .09, curbStoneWorld.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.19, .17, .10), soil * .3);
    `);
  };
  material.customProgramCacheKey = () => 'authored-stone-curbs-v1';
}
