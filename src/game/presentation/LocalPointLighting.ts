import {Color,DataTexture,NearestFilter,RGBAFormat,Vector2,Vector4,type MeshStandardMaterial} from 'three';
import {WALL_TORCHES} from '../world/WallTorches.ts';
import {STREET_LIGHTS} from '../world/StreetLights.ts';
// Static spatial index, not a distance-based light/scene unload. Every authored
// light contributes at every affected fragment, including distant visible walls.
export const LOCAL_POINT_SOURCES=[...WALL_TORCHES,...STREET_LIGHTS.slice(2)].map(p=>({id:p.id,...p.light}));
export function buildPointGrid(sources:readonly {position:readonly number[];distance:number}[],cellSize=4){
 const minX=Math.floor(Math.min(...sources.map(p=>p.position[0]-p.distance))/cellSize)*cellSize;
 const minZ=Math.floor(Math.min(...sources.map(p=>p.position[2]-p.distance))/cellSize)*cellSize;
 const width=Math.ceil((Math.max(...sources.map(p=>p.position[0]+p.distance))-minX)/cellSize),height=Math.ceil((Math.max(...sources.map(p=>p.position[2]+p.distance))-minZ)/cellSize);
 const data=new Uint8Array(width*height*4);let maxLights=0;
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){
  const ids:number[]=[];
  sources.forEach((p,i)=>{const dx=Math.max(minX+x*cellSize-p.position[0],p.position[0]-(minX+(x+1)*cellSize),0),dz=Math.max(minZ+z*cellSize-p.position[2],p.position[2]-(minZ+(z+1)*cellSize),0);if(dx*dx+dz*dz<p.distance*p.distance)ids.push(i+1);});
  if(ids.length>4||sources.length>255)throw Error('Local light grid capacity exceeded; expand the grid format before adding lights');
  maxLights=Math.max(maxLights,ids.length);data.set(ids,(z*width+x)*4);
 }
 return {data,width,height,minX,minZ,cellSize,maxLights};
}
export const POINT_GRID=buildPointGrid(LOCAL_POINT_SOURCES);
const texture=new DataTexture(POINT_GRID.data,POINT_GRID.width,POINT_GRID.height,RGBAFormat);texture.magFilter=texture.minFilter=NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
export const localPointLighting={
 enabled:{value:0},texture,
 diagnostics:()=>({sources:LOCAL_POINT_SOURCES.length,maxLightsPerCell:POINT_GRID.maxLights,gridBytes:POINT_GRID.data.byteLength,grid:[POINT_GRID.width,POINT_GRID.height],globalPointLightsAdded:0,enabled:localPointLighting.enabled.value>0}),
 dispose(){texture.dispose();},
};
const positions=LOCAL_POINT_SOURCES.map(p=>new Vector4(...p.position,p.distance));
const colors=LOCAL_POINT_SOURCES.map(p=>new Color(p.color).multiplyScalar(p.intensity));
export function compileLocalPointLights(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0]){
 // Imported materials can be cloned and wrapped again by portal styling.
 if(shader.uniforms.localPointIndex||!shader.fragmentShader.includes('#include <lights_fragment_begin>'))return;
 Object.assign(shader.uniforms,{localPointIndex:{value:texture},localPointEnabled:localPointLighting.enabled,localPointOrigin:{value:new Vector2(POINT_GRID.minX,POINT_GRID.minZ)},localPointPositions:{value:positions},localPointColors:{value:colors}});
 shader.vertexShader='varying vec3 localPointWorld;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
 vec4 localPointPosition=vec4(transformed,1.);
 #ifdef USE_BATCHING
 localPointPosition=batchingMatrix*localPointPosition;
 #endif
 #ifdef USE_INSTANCING
 localPointPosition=instanceMatrix*localPointPosition;
 #endif
 localPointWorld=(modelMatrix*localPointPosition).xyz;`);
 shader.fragmentShader=`varying vec3 localPointWorld;
 uniform sampler2D localPointIndex;
 uniform float localPointEnabled;
 uniform vec2 localPointOrigin;
 uniform vec4 localPointPositions[${positions.length}];
 uniform vec3 localPointColors[${colors.length}];
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
 // One index lookup; no global loop over all distant torches.
 if(localPointEnabled>.5){
  ivec2 tile=ivec2(floor((localPointWorld.xz-localPointOrigin)/${POINT_GRID.cellSize.toFixed(1)}));
  if(all(greaterThanEqual(tile,ivec2(0)))&&all(lessThan(tile,ivec2(${POINT_GRID.width},${POINT_GRID.height})))){
   vec4 ids=texelFetch(localPointIndex,tile,0)*255.;
   for(int slot=0;slot<${POINT_GRID.maxLights};slot++){
    int id=int(ids[slot]+.5)-1;
    if(id>=0){
     vec4 p=localPointPositions[id];vec3 delta=p.xyz-localPointWorld;float d=length(delta);
     if(d<p.w){
      IncidentLight nearby;nearby.direction=normalize(mat3(viewMatrix)*delta);
      nearby.color=localPointColors[id]*getDistanceAttenuation(d,p.w,2.);nearby.visible=true;
      RE_Direct(nearby,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
     }
    }
   }
  }
 }
 `);
}
