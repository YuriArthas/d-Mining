import { stabilizeShadows } from '../presentation/stableShadow.ts';
import { DataTexture, MeshPhysicalMaterial, LinearFilter, NearestFilter, RGBAFormat, ShaderChunk, SRGBColorSpace } from 'three';
import { ATLAS_TILES, TILE_SIZE, mineralAtlas, mineralResponseAtlas, TERRAIN_MATERIALS } from './minerals.ts';

export function createMineralMaterial() {
  const pixels = mineralAtlas(),responsePixels=mineralResponseAtlas();
  const atlas = new DataTexture(pixels, TILE_SIZE * ATLAS_TILES, TILE_SIZE, RGBAFormat);
  atlas.colorSpace = SRGBColorSpace;
  atlas.magFilter = NearestFilter; atlas.minFilter = LinearFilter;
  atlas.generateMipmaps = false; atlas.needsUpdate = true;
  const responseAtlas=new DataTexture(responsePixels,TILE_SIZE*ATLAS_TILES,TILE_SIZE,RGBAFormat);
  responseAtlas.magFilter=responseAtlas.minFilter=LinearFilter;
  responseAtlas.generateMipmaps=false;responseAtlas.needsUpdate=true;
  const material = new MeshPhysicalMaterial({ map: atlas, roughness: 1, metalness:0, specularIntensity:.08, envMapIntensity:0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float oreTile;\nvarying float vOreTile;\nvarying vec3 vTerrainWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvOreTile = oreTile;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTerrainWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.uniforms.uOreResponse={value:responseAtlas};
    shader.fragmentShader = 'uniform sampler2D uOreResponse;\nvarying float vOreTile;\nvarying vec3 vTerrainWorld;\n' + shader.fragmentShader;
    // UVs are in cell units. Repeat on every voxel face even if a quad spans an
    // entire region. Half-texel insets keep linear sampling inside each atlas tile.
    const map = `vec2 localOreUv = fract(vMapUv);
      vec2 oreCell = floor(vMapUv);
      float flipOre = step(0.5, fract(dot(oreCell, vec2(0.754877, 0.569841)) + vOreTile * 0.37));
      localOreUv.x = mix(localOreUv.x, 1.0-localOreUv.x, flipOre);
      float turnOre=step(.5,fract(dot(oreCell,vec2(.382,.819))+vOreTile*.13));
      localOreUv=mix(localOreUv,vec2(localOreUv.y,1.0-localOreUv.x),turnOre);
      vec2 oreAtlasUv=vec2((vOreTile+(0.5+localOreUv.x*63.0)/64.0)/${ATLAS_TILES.toFixed(1)},(0.5+localOreUv.y*63.0)/64.0);
      vec3 oreResponse=texture2D(uOreResponse,oreAtlasUv).rgb;
    ` + ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D(map,oreAtlasUv)')+`
      if(abs(vOreTile-${TERRAIN_MATERIALS.findIndex(m=>m.id===7)}.0)<.1){float turf=sin(vTerrainWorld.x*.28+sin(vTerrainWorld.z*.31))*sin(vTerrainWorld.z*.43);diffuseColor.rgb*=.98+turf*.08;}
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(oreResponse.g,.82);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=0.0;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 oreDx=dFdx(-vViewPosition),oreDy=dFdy(-vViewPosition);
        vec3 oreR1=cross(oreDy,normal),oreR2=cross(normal,oreDx);
        float oreDet=dot(oreDx,oreR1);
        vec3 oreGradient=sign(oreDet)*(dFdx(oreResponse.r)*oreR1+dFdy(oreResponse.r)*oreR2);
        normal=normalize(max(abs(oreDet),0.000001)*normal-.095*oreGradient);
      `);
  };
  material.customProgramCacheKey = () => 'mineral-atlas-v7-quarried-grain';
  stabilizeShadows(material);
  return { material, atlasBytes: pixels.byteLength+responsePixels.byteLength, responseAtlasBytes:responsePixels.byteLength, dispose: () => { material.dispose(); atlas.dispose(); responseAtlas.dispose(); } };
}
