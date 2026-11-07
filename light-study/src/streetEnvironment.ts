import type {Texture} from 'three/webgpu';
import {Fn,texture,sampler,wgslFn,materialEnvRotation,vec3} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type NodeBuilder from 'three/src/nodes/core/NodeBuilder.js';
import type {CodeNodeInclude} from 'three/src/nodes/code/CodeNode.js';

type LevelNode=Node<'float'>&{isConstNode?:boolean;value?:number;isVarNode?:boolean;node?:LevelNode};
type EnvironmentContext={getUV:(node:Node,builder:NodeBuilder)=>Node<'vec3'>;getTextureLevel:(node:Node)=>LevelNode};
// r186 native-function proxies expose .build(); @types has only their call side.
const native=(code:string,includes:ReturnType<typeof wgslFn>[]=[])=>wgslFn(code,includes as unknown as CodeNodeInclude[]);

/** r186 CubeUV sampling, specialized for the immutable layout of the two
 * prefiltered street skies. Same PMREM texels, mip curve, normal/reflection
 * directions and linear interpolation as Three; no lighting is approximated.
 * Project a direction to its cube face once, shared by the two mip lookups.
 * Diffuse (roughness 1) has one known mip and needs no runtime mip selection.
 */
export function createStreetEnvironment(initial:Texture){
  const {width,height}=initial.image as {width:number;height:number};
  const maxMip=Math.log2(height)-2;
  if(!Number.isInteger(maxMip)||width!==3*Math.max(2**maxMip,7*16))throw Error('Unsupported street PMREM layout');
  const decimal=(value:number)=>Number.isInteger(value)?value+'.0':String(value);
  const projection=native(`fn streetPMREMProjection(d:vec3<f32>)->vec3<f32>{
    let a=abs(d);
    var face:f32;
    var p:vec2<f32>;
    if(a.x>a.z && a.x>a.y){
      face=select(3.0,0.0,d.x>0.0);
      p=vec2<f32>(select(-d.z,d.z,d.x>0.0),d.y)/a.x;
    }else if(a.z>=a.x && a.z>a.y){
      face=select(5.0,2.0,d.z>0.0);
      p=vec2<f32>(select(d.x,-d.x,d.z>0.0),d.y)/a.z;
    }else{
      face=select(4.0,1.0,d.y>0.0);
      p=vec2<f32>(-d.x,select(d.z,-d.z,d.y>0.0))/a.y;
    }
    return vec3<f32>(0.5*(p+vec2<f32>(1.0)),face);
  }`);
  const coordinates=native(`fn streetPMREMCoordinates(p:vec3<f32>,mip:f32)->vec2<f32>{
    let filterOffset=max(4.0-mip,0.0);
    let size=exp2(max(mip,4.0));
    var coords=p.xy*(size-2.0)+vec2<f32>(1.0);
    var face=p.z;
    if(face>2.0){coords.y+=size;face-=3.0;}
    coords.x+=face*size;
    coords.x+=filterOffset*48.0;
    coords.y+=4.0*(${decimal(2**maxMip)}-size);
    return coords*vec2<f32>(${decimal(1/width)},${decimal(1/height)});
  }`);
  const mip=native(`fn streetPMREMMip(r:f32)->f32{
    var mip:f32;
    if(r>=0.8){mip=(1.0-r)*1.0/(1.0-0.8)-2.0;}
    else if(r>=0.4){mip=(0.8-r)*3.0/(0.8-0.4)-1.0;}
    else if(r>=0.305){mip=(0.4-r)*1.0/(0.4-0.305)+2.0;}
    else if(r>=0.21){mip=(0.305-r)*1.0/(0.305-0.21)+3.0;}
    else{mip=-2.0*log2(1.16*r);}
    return clamp(mip,-2.0,${decimal(maxMip)});
  }`);
  const radiance=native(`fn streetPMREMRadiance(env:texture_2d<f32>,envSampler:sampler,d:vec3<f32>,r:f32)->vec3<f32>{
    let p=streetPMREMProjection(d);
    let mip=streetPMREMMip(r);
    let base=floor(mip);
    let weight=fract(mip);
    var color=textureSampleLevel(env,envSampler,streetPMREMCoordinates(p,base),0.0).rgb;
    if(weight!=0.0){
      let next=textureSampleLevel(env,envSampler,streetPMREMCoordinates(p,base+1.0),0.0).rgb;
      color=mix(color,next,weight);
    }
    return color;
  }`,[projection,coordinates,mip]);
  const irradiance=native(`fn streetPMREMIrradiance(env:texture_2d<f32>,envSampler:sampler,d:vec3<f32>)->vec3<f32>{
    return textureSampleLevel(env,envSampler,streetPMREMCoordinates(streetPMREMProjection(d),-2.0),0.0).rgb;
  }`,[projection,coordinates]);
  const source=texture(initial);
  const node=Fn(([],builder:NodeBuilder)=>{
    const context=builder.context as EnvironmentContext;
    const direction=context.getUV(source,builder);
    const level=context.getTextureLevel(source);
    // float(1) is a VarNode wrapping a ConstNode in r186.
    const constant=level.isVarNode?level.node:level;
    // PMREMGenerator render targets have inverted Y. Match PMREMNode exactly.
    const d=materialEnvRotation.mul(vec3(direction.x,direction.y.negate(),direction.z));
    const inputs={env:source,envSampler:sampler(source),d};
    return (constant?.isConstNode&&constant.value===1?irradiance(inputs):radiance({...inputs,r:level})) as Node<'vec3'>;
  })();
  return {
    node,
    setTexture:(value:Texture)=>{
      const image=value.image as {width:number;height:number};
      if(image.width!==width||image.height!==height)throw Error('Street skies must share the same PMREM layout');
      source.value=value;
    },
    dispose:()=>{node.dispose();source.dispose();},
  };
}
