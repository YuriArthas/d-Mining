import { stabilizeShadows } from '../presentation/stableShadow.ts';
import { Color, DataTexture, MeshPhysicalMaterial, LinearFilter, NearestFilter, RGBAFormat, ShaderChunk, SRGBColorSpace } from 'three';
import {LAYERS,type Layer} from '../content/layers.ts';
import {resourceByKind} from '../content/resources.ts';
import { ATLAS_TILES, TILE_SIZE, mineralAtlas, mineralResponseAtlas, TERRAIN_MATERIALS } from './minerals.ts';

export function createMineralMaterial(layers:readonly Layer[]=LAYERS) {
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
    shader.uniforms.uHostColors={value:layers.map(l=>new Color(resourceByKind(l.base).color))};
    shader.uniforms.uHostDepths={value:layers.map(l=>l.from)};
    shader.fragmentShader = `uniform vec3 uHostColors[${layers.length}]; uniform float uHostDepths[${layers.length}]; uniform sampler2D uOreResponse;\nvarying float vOreTile;\nvarying vec3 vTerrainWorld;\n` + shader.fragmentShader;
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
      vec3 hostColor=uHostColors[0];
      for(int i=1;i<${layers.length};i++){if(-vTerrainWorld.y-.001>=uHostDepths[i])hostColor=uHostColors[i];}
      if(${TERRAIN_MATERIALS.flatMap((m,i)=>m.id!==7&&!resourceByKind(m.id).base?[`abs(vOreTile-${i}.0)<.1`]:[]).join('||')})diffuseColor.rgb=mix(hostColor,diffuseColor.rgb,step(.5,oreResponse.r));
      // Broad, world-continuous variation has no per-cell border or tile phase.
      float rockTone=sin(vTerrainWorld.x*.39+vTerrainWorld.y*.27)*sin(vTerrainWorld.z*.43-vTerrainWorld.y*.19);
      diffuseColor.rgb*=.995+rockTone*.005;
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(oreResponse.g,.82);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=0.0;')
      ;
  };
  material.customProgramCacheKey = () => `mineral-atlas-v8-continuous-host-${layers.length}`;
  stabilizeShadows(material);
  return { material, atlasBytes: pixels.byteLength+responsePixels.byteLength, responseAtlasBytes:responsePixels.byteLength, dispose: () => { material.dispose(); atlas.dispose(); responseAtlas.dispose(); } };
}
