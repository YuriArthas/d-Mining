import type {CubeTexture,PointLightShadow} from 'three/webgpu';
import type Node from 'three/src/nodes/core/Node.js';
import {Fn,If,Loop,float,vec3,uniform,renderGroup,cubeTexture,normalWorldGeometry,perspectiveDepthToViewZ,viewZToPerspectiveDepth,PointShadowFilter,interleavedGradientNoise,screenCoordinate,vogelDiskSample,positionWorld} from 'three/tsl';

export const lampShadowSettings={sourceRadius:.22,blockerSamples:24,filterSamples:48,minBlockerDistance:.5} as const;
type FilterInputs={depthTexture:CubeTexture;bd3D:Node<'vec3'>;dp:Node<'float'>;shadow:PointLightShadow};

/** PCSS for the static lantern's 44 cm emitting body, using its existing cube map.
 * Three r186's point filter receives perspective depth for the dominant cube face,
 * not radial depth. Convert every lookup with its own face direction, including
 * across cube seams. A receiver-plane correction prevents a broad kernel from
 * shadowing the wall with itself. The original five-tap filter stays in baseline.
 */
export function installLampShadow(shadow:PointLightShadow,range?:{position:[number,number,number];positionNode?:Node<'vec3'>;distance:number;compact?:boolean}){
  // This switch belongs to the light, not a mesh. Ordinary Standard materials
  // may skip their object UBO upload when only this external node changes.
  const enabled=uniform(false).setGroup(renderGroup);
  // PointShadowNode updates camera.far from light.distance on mode changes.
  // Keep depth decoding tied to that camera, including already-compiled materials.
  const near=uniform(0).setGroup(renderGroup).onRenderUpdate(()=>shadow.camera.near);
  const far=uniform(0).setGroup(renderGroup).onRenderUpdate(()=>shadow.camera.far);
  const filter=({depthTexture,bd3D,dp,shadow:lightShadow}:FilterInputs)=>Fn(()=>{
    const result=float(1).toVar();
    const sample=()=>{If(enabled,()=>{
      const dominant=(d:Node<'vec3'>)=>d.abs().x.max(d.abs().y).max(d.abs().z);
      const receiver=perspectiveDepthToViewZ(dp,near,far).negate().div(dominant(bd3D)).toConst();
      const tangent=bd3D.cross(bd3D.x.abs().greaterThan(bd3D.z.abs()).select(vec3(0,1,0),vec3(1,0,0))).normalize().toConst();
      const bitangent=bd3D.cross(tangent).toConst();
      const plane=normalWorldGeometry.dot(bd3D).toConst();
      // Stable per-pixel rotation; no frame index, history, or animated noise.
      const phi=interleavedGradientNoise(screenCoordinate.xy).mul(Math.PI*2).toConst();
      const direction=(i:number|Node<'float'>,count:number,radius:Node<'float'>)=>{
        const disk=vogelDiskSample(typeof i==='number'?float(i):i,float(count),phi);
        return bd3D.add(tangent.mul(disk.x).add(bitangent.mul(disk.y)).mul(radius)).normalize().toConst();
      };
      const planeDistance=(d:Node<'vec3'>)=>{
        const denominator=normalWorldGeometry.dot(d);
        return plane.mul(denominator).greaterThan(.0001).select(receiver.mul(plane).div(denominator),receiver).clamp(receiver.mul(.5),receiver.mul(2));
      };
      // The excluded glass/cage is inside this clearance. Limit blocker search
      // to the authored fixture's nearest opaque support, not the .08 m camera.
      const searchRadius=float(lampShadowSettings.sourceRadius).mul(float(1/lampShadowSettings.minBlockerDistance).sub(receiver.reciprocal())).clamp(0,.4).toConst();
      const blockerSum=float(0).toVar(),blockerCount=float(0).toVar();
      const sampleBlocker=(d:Node<'vec3'>)=>{
        const raw=cubeTexture(depthTexture,d);
        // r186 keys uniforms only by texture UUID. Raw blocker reads need a
        // regular sampler; PCF needs a comparison sampler for the same image.
        // Separate the bindings without cloning or rendering another cube map.
        raw.getUniformHash=()=>depthTexture.uuid+'-blocker-read';
        const depth=raw.r;
        const distance=perspectiveDepthToViewZ(depth,near,far).negate().div(dominant(d)).toConst();
        // Ignore the receiver's own depth and numerical surface bias.
        If(distance.lessThan(planeDistance(d).sub(.012)),()=>{blockerSum.addAssign(distance);blockerCount.addAssign(1);});
      }
      // Three lights multiply the TSL graph size. Keep the exact taps and
      // accumulation order in GPU loops instead of expanding hundreds of nodes
      // per tap per material. The existing courtyard keeps its original graph.
      if(range?.compact)Loop(lampShadowSettings.blockerSamples,({i})=>{
        const d=bd3D.toVar();
        If(i.greaterThan(0),()=>{d.assign(direction(float(i).sub(1),lampShadowSettings.blockerSamples-1,searchRadius));});
        sampleBlocker(d);
      });
      else for(let i=0;i<lampShadowSettings.blockerSamples;i++)sampleBlocker(i===0?bd3D:direction(i-1,lampShadowSettings.blockerSamples-1,searchRadius));
      const blocker=blockerSum.div(blockerCount.max(1)).max(lampShadowSettings.minBlockerDistance).toConst();
      // Angular penumbra = emitter radius * (receiver - blocker)/(blocker * receiver).
      // It contracts to the original antialiasing footprint at contact.
      const radius=float(lampShadowSettings.sourceRadius).mul(receiver.sub(blocker).max(0)).div(blocker.mul(receiver)).max(2/shadow.mapSize.x).toConst();
      If(blockerCount.greaterThan(0),()=>{
        const sum=float(0).toVar();
        const sampleFilter=(i:number|Node<'float'>)=>{
          const d=direction(i,lampShadowSettings.filterSamples,radius);
          const compare=viewZToPerspectiveDepth(planeDistance(d).mul(dominant(d)).negate(),near,far);
          sum.addAssign(cubeTexture(depthTexture,d).compare(compare));
        }
        if(range?.compact)Loop(lampShadowSettings.filterSamples,({i})=>sampleFilter(float(i)));
        else for(let i=0;i<lampShadowSettings.filterSamples;i++)sampleFilter(i);
        result.assign(sum.div(lampShadowSettings.filterSamples));
      }).Else(()=>{result.assign(cubeTexture(depthTexture,bd3D).compare(dp));});
    }).Else(()=>{
      // @types/three 0.186 models the filter's raw texture/shadow inputs as Nodes.
      result.assign(PointShadowFilter({depthTexture,bd3D,dp,shadow:lightShadow} as unknown as Parameters<typeof PointShadowFilter>[0]));
    });
    };
    // Outside the physical attenuation range this light contributes exactly zero.
    // Skip shadow texture reads there; retain courtyard behavior without a range.
    if(range)If(positionWorld.distance(range.positionNode??vec3(...range.position)).lessThan(range.distance),sample);
    else sample();
    return result;
  })();
  // Runtime WebGPU hook in ShadowNode; absent from @types/three 0.186.
  (shadow as PointLightShadow&{filterNode:typeof filter}).filterNode=filter;
  return {setEnabled:(value:boolean)=>{enabled.value=value;}};
}
