import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshPhysicalMaterial,MeshStandardMaterial,type Texture} from 'three';
import bank from '../assets/ground-details/pond-bank.json' with {type:'json'};
import {SURFACE_PONDS,POND} from '../world/SurfacePonds.ts';
import {stabilizeShadows,compileStableShadow} from './stableShadow.ts';
import {PondReflection} from './PondReflection.ts';

// Clear shallow water over a visible bed, with one shared real planar reflection.
export function createSurfacePonds(clock:{value:number},groundAtlas?:Texture){
 const root=new Group();root.name='grid-grass-ponds';
 const bankGeometry=new BufferGeometry();bankGeometry.setAttribute('position',new Float32BufferAttribute(bank.positions,3));bankGeometry.setAttribute('normal',new Float32BufferAttribute(bank.normals,3));
 const shore=stabilizeShadows(new MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0,envMapIntensity:0}));
 const shoreCompile=shore.onBeforeCompile;
 shore.onBeforeCompile=(shader,renderer)=>{
  shoreCompile.call(shore,shader,renderer);shader.uniforms.pondGroundAtlas={value:groundAtlas};
  shader.vertexShader='varying vec3 bankWorld;varying float bankTop;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nbankWorld=(modelMatrix*vec4(transformed,1.)).xyz;bankTop=normal.y;');
  shader.fragmentShader=`varying vec3 bankWorld;varying float bankTop;uniform sampler2D pondGroundAtlas;
   float bankHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float bankNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bankHash(i),bankHash(i+vec2(1,0)),f.x),mix(bankHash(i+vec2(0,1)),bankHash(i+1.),f.x),f.y);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 groundUV=bankWorld.xz*.5;
   float grassGrain=textureGrad(pondGroundAtlas,fract(groundUV)*.5,dFdx(groundUV)*.5,dFdy(groundUV)*.5).r*2.;
   vec3 grass=mix(vec3(.12,.38,.035),vec3(.16,.43,.055),bankNoise(bankWorld.xz*.19))*grassGrain;
   float dirtGrain=bankHash(floor(bankWorld.xz*8.)+floor(bankWorld.y*32.));
   vec3 dirt=mix(vec3(.19,.105,.042),vec3(.29,.18,.075),dirtGrain);
   diffuseColor.rgb=bankTop>.5?grass:dirt;
  `);
 };
 shore.customProgramCacheKey=()=> 'grid-grass-shore-v13';
 const waterGeometry=new BufferGeometry();waterGeometry.setAttribute('position',new Float32BufferAttribute(bank.waterPositions,3));waterGeometry.computeVertexNormals();
 const reflection=new PondReflection(POND.waterY),surfaces:Mesh[]=[];
 root.userData.disposeSurfaceNoise=()=>reflection.dispose();
 const water=new MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:1,depthWrite:false,
  roughness:.075,metalness:0,ior:1.333,specularIntensity:1,envMapIntensity:0,
  clearcoat:0,transmission:0,iridescence:0});
 water.onBeforeCompile=shader=>{
  compileStableShadow(shader);shader.uniforms.pondTime=clock;
  shader.uniforms.pondReflectionEnabled=reflection.enabled;shader.uniforms.pondReflection=reflection.texture;shader.uniforms.pondProjection=reflection.projection;
  shader.vertexShader='varying vec3 pondWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\npondWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=`uniform float pondTime;uniform float pondReflectionEnabled;varying vec3 pondWorld;uniform sampler2D pondReflection;uniform mat4 pondProjection;
   float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   // Pixel colour is independent of the smooth, millimetre-scale reflection ripples.
   vec2 pixel=floor(pondWorld.xz*8.);
   vec2 p=pixel/8.;float t=floor(pondTime*8.)/8.;
   float pattern=sin(p.x*2.4+sin(p.y*1.7)+t*.45)*.23+sin(p.y*3.2-p.x*.8-t*.3)*.17+.5;
   float tone=floor(clamp(pattern,0.,.999)*5.)/4.;
   diffuseColor.rgb=vec3(.045,.19,.24)*mix(.96,1.04,tone);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 mirrorColor=vec3(0.);
   if(pondReflectionEnabled>.5){
   vec4 reflectedPosition=pondProjection*vec4(pondWorld,1.);
   vec2 reflectedUV=reflectedPosition.xy/reflectedPosition.w;
   reflectedUV+=waterNormal.xz*.08;
   mirrorColor=texture2D(pondReflection,clamp(reflectedUV,vec2(.001),vec2(.999))).rgb;
   }
   float viewCos=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
   float fresnel=clamp((.0204+.9796*pow(1.-viewCos,5.))*1.35,.04,.92)*pondReflectionEnabled;
   float absorption=1.-exp(-.75*${POND.depth.toFixed(6)});
   float alpha=fresnel+absorption*(1.-fresnel);
   outgoingLight=(mirrorColor*fresnel+outgoingLight*absorption*(1.-fresnel))/alpha;
   diffuseColor.a=alpha;
   #include <opaque_fragment>
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Very small slopes: no large warped blobs, displaced mesh or shoreline highlight.
   vec2 rippleP=pondWorld.xz;
   float rippleA=rippleP.x*6.1+rippleP.y*3.7-pondTime*1.15;
   float rippleB=rippleP.x*-4.3+rippleP.y*8.2+pondTime*.85;
   float rippleFade=1.-smoothstep(.12,.5,length(fwidth(rippleP)));
   vec3 waterNormal=normalize(vec3(
    (.006*cos(rippleA)-.003*cos(rippleB))*rippleFade,1.,
    (.0036*cos(rippleA)+.0057*cos(rippleB))*rippleFade));
   normal=normalize(mat3(viewMatrix)*waterNormal);
  `);
 };
 water.customProgramCacheKey=()=> 'clear-deeper-water-reflection-toggle-v18';
 for(const p of SURFACE_PONDS){
  const rim=new Mesh(bankGeometry,shore);rim.position.set(p.x,0,p.z);rim.rotation.y=p.sign<0?Math.PI:0;rim.name=p.id+'-bank';rim.receiveShadow=true;
  const surface=new Mesh(waterGeometry,water);surface.position.set(p.x,POND.waterY,p.z);surface.rotation.y=rim.rotation.y;surface.name=p.id+'-water';surface.receiveShadow=true;
  surfaces.push(surface);surface.onBeforeRender=(renderer,scene,camera)=>reflection.capture(renderer,scene,camera,surfaces);
  root.add(rim,surface);
 }
 root.userData.ponds={version:'deeper-planar-ponds-v16',count:2,waterY:POND.waterY,waterDepth:POND.depth,bankHeight:POND.bankHeight,bankTriangles:bank.triangles,waterTriangles:bank.waterPositions.length/9,drawCalls:4,extraTextures:0,reflection:'shared-planar-scene',reflectionTarget:reflection.stats,specular:true,waterIor:water.ior,roughness:water.roughness,clearcoat:water.clearcoat,maxRippleSlope:.011,swimming:false};
 return root;
}
