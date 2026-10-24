import { stabilizeShadows } from '../presentation/stableShadow.ts';
import { applyBakedGroundTop } from '../presentation/bakedLight.ts';
import { Color, DataTexture, MeshPhysicalMaterial, LinearFilter, LinearMipmapLinearFilter, NearestFilter, RGBAFormat, ShaderChunk, SRGBColorSpace } from 'three';
import type {Layer} from '../content/layers.ts';
import {resourceByKind} from '../content/resources.ts';
import { ATLAS_COLUMNS, ATLAS_ROWS, ATLAS_WIDTH, ATLAS_HEIGHT, TILE_SIZE, mineralAtlas, mineralResponseAtlas, TERRAIN_MATERIALS } from './minerals.ts';

export function createMineralMaterial(layers:readonly Layer[], worlds?:readonly Readonly<{layers:readonly Layer[]}>[]) {
  const hosts=worlds?worlds.flatMap((w,id)=>w.layers.map(layer=>({layer,world:id}))):layers.map(layer=>({layer,world:0}));
  const pixels = mineralAtlas(),responsePixels=mineralResponseAtlas();
  const atlas = new DataTexture(pixels, ATLAS_WIDTH, ATLAS_HEIGHT, RGBAFormat);
  atlas.colorSpace = SRGBColorSpace;
  // Crisp pixels up close, filtered mip levels at distance and grazing angles (no speckle).
  atlas.magFilter = NearestFilter; atlas.minFilter = LinearMipmapLinearFilter;
  atlas.generateMipmaps = true; atlas.needsUpdate = true;
  const responseAtlas=new DataTexture(responsePixels,ATLAS_WIDTH,ATLAS_HEIGHT,RGBAFormat);
  responseAtlas.magFilter=LinearFilter;responseAtlas.minFilter=LinearMipmapLinearFilter;
  responseAtlas.generateMipmaps=true;responseAtlas.needsUpdate=true;
  const material = new MeshPhysicalMaterial({ map: atlas, roughness: 1, metalness:0, specularIntensity:.08, envMapIntensity:0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float oreTile;\nvarying float vOreTile;\nvarying float vTerrainNormalY;\nvarying vec3 vTerrainWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvOreTile = oreTile;\nvTerrainNormalY = normal.y;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTerrainWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.uniforms.uOreResponse={value:responseAtlas};
    shader.uniforms.uHostColors={value:hosts.map(h=>new Color(resourceByKind(h.layer.base).color))};
    shader.uniforms.uHostDepths={value:hosts.map(h=>h.layer.from)};
    shader.uniforms.uHostWorlds={value:hosts.map(h=>h.world)};
    shader.fragmentShader = `uniform vec3 uHostColors[${hosts.length}]; uniform float uHostDepths[${hosts.length}]; uniform float uHostWorlds[${hosts.length}]; uniform sampler2D uOreResponse;\nvarying float vOreTile;\nvarying float vTerrainNormalY;\nvarying vec3 vTerrainWorld;\n` + shader.fragmentShader;
    // UVs are in cell units. Repeat on every voxel face even if a quad spans an
    // entire region. Half-texel insets keep linear sampling inside each atlas tile.
    const map = `vec2 localOreUv = fract(vMapUv);
      vec2 oreCell = floor(vMapUv);
      float flipOre = step(0.5, fract(dot(oreCell, vec2(0.754877, 0.569841)) + vOreTile * 0.37));
      localOreUv.x = mix(localOreUv.x, 1.0-localOreUv.x, flipOre);
      float turnOre=step(.5,fract(dot(oreCell,vec2(.382,.819))+vOreTile*.13));
      localOreUv=mix(localOreUv,vec2(localOreUv.y,1.0-localOreUv.x),turnOre);
      float oreTileIndex=floor(vOreTile+.5);
      vec2 oreTileCell=vec2(mod(oreTileIndex,${ATLAS_COLUMNS.toFixed(1)}),floor(oreTileIndex/${ATLAS_COLUMNS.toFixed(1)}));
      // Mip level from the continuous cell UVs; fract() above would break hardware derivatives.
      float oreLod=clamp(log2(max(max(length(dFdx(vMapUv)),length(dFdy(vMapUv)))*${TILE_SIZE.toFixed(1)},1e-6)),0.0,5.0);
      // Keep both blended levels' samples inside this atlas tile.
      float oreInset=.5*exp2(ceil(oreLod))/${TILE_SIZE.toFixed(1)};
      vec2 oreAtlasUv=(oreTileCell+clamp(localOreUv,oreInset,1.0-oreInset))/vec2(${ATLAS_COLUMNS.toFixed(1)},${ATLAS_ROWS.toFixed(1)});
      vec3 oreResponse=textureLod(uOreResponse,oreAtlasUv,oreLod).rgb;
    ` + ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','textureLod(map,oreAtlasUv,oreLod)')+`
      vec3 hostColor=uHostColors[0];
      float hostWorld=${worlds?'(vTerrainWorld.z > 336. ? 2. : vTerrainWorld.z > 112. ? 1. : 0.)':'0.'};
      // Sample just inside the voxel so top/bottom faces at layer boundaries
      // use the rock they belong to, not the neighboring layer's rock.
      for(int i=0;i<${hosts.length};i++){if(abs(uHostWorlds[i]-hostWorld)<.1 && -vTerrainWorld.y+vTerrainNormalY*.01>=uHostDepths[i])hostColor=uHostColors[i];}
      if(${TERRAIN_MATERIALS.flatMap((m,i)=>m.id!==7&&!resourceByKind(m.id).base?[`abs(vOreTile-${i}.0)<.1`]:[]).join('||')})diffuseColor.rgb=hostColor*(1.0-oreResponse.r)+diffuseColor.rgb;
      // Broad, world-continuous variation has no per-cell border or tile phase.
      float rockTone=sin(vTerrainWorld.x*.39+vTerrainWorld.y*.27)*sin(vTerrainWorld.z*.43-vTerrainWorld.y*.19);
      diffuseColor.rgb*=.995+rockTone*.005;
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(oreResponse.g,.82);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=0.0;')
      ;
  };
  material.customProgramCacheKey = () => `mineral-atlas-v12-mip-premultiplied-host-${hosts.length}`;
  // The top of the mine shares the valley's baked shadows (e.g. the headframe's) with the ground around it.
  applyBakedGroundTop(material, 'vTerrainWorld', 'vTerrainNormalY');
  stabilizeShadows(material);
  return { material, atlasBytes: pixels.byteLength+responsePixels.byteLength, responseAtlasBytes:responsePixels.byteLength, dispose: () => { material.dispose(); atlas.dispose(); responseAtlas.dispose(); } };
}
