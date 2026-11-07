import * as THREE from 'three/webgpu';
import {Fn,If,Loop,float,vec2,vec3,vec4,uniform,uniformArray,renderGroup,cubeTexture,texture,passTexture,nodeObject,NodeUpdateType,uv,screenUV,screenCoordinate,getViewPosition,interleavedGradientNoise,viewZToPerspectiveDepth,perspectiveDepthToViewZ,pointShadow} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type NodeBuilder from 'three/src/nodes/core/NodeBuilder.js';
import type NodeFrame from 'three/src/nodes/core/NodeFrame.js';
import type PassNode from 'three/src/nodes/display/PassNode.js';
import type TextureNode from 'three/src/nodes/accessors/TextureNode.js';

type TextureInput=ReturnType<typeof texture>;
type PointRuntime=ReturnType<typeof pointShadow>&{
  shadowMap:THREE.CubeRenderTarget|null;
  setupRenderTarget:(shadow:THREE.PointLightShadow,builder:NodeBuilder)=>{shadowMap:THREE.CubeRenderTarget;depthTexture:THREE.CubeDepthTexture};
  updateShadow:(frame:{renderer:THREE.Renderer;scene:THREE.Scene;camera:THREE.Camera})=>void;
};

// Precomputed disk offsets remove per-tap trig/sqrt from the fragment loop.
function kernel(count:number){return uniformArray<'vec2'>(Array.from({length:count},(_,i)=>{
  const a=i*2.399963229728653,r=Math.sqrt((i+.5)/count);return new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r);
}),'vec2');}

/** Cube shadows still see all off-screen casters. Only receiver filtering is
 * screen-space, with depth/normal-aware reconstruction and local full-res
 * evaluation when the half-res grid contains no matching surface. */
export class ScreenShadow extends THREE.TempNode<'float'> {
  static get type(){return 'StreetScreenShadow';}
  readonly light=new THREE.PointLight('#ffd197',15,9,2);
  readonly raw=new THREE.RenderTarget(1,1,{format:THREE.RGFormat,type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  readonly resolved=new THREE.RenderTarget(1,1,{format:THREE.RedFormat,type:THREE.UnsignedByteType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  private readonly rawMaterial=new THREE.NodeMaterial();
  private readonly resolveMaterial=new THREE.NodeMaterial();
  private readonly quad=new THREE.QuadMesh(this.rawMaterial);
  private readonly size=new THREE.Vector2();
  private readonly lowSize=uniform(new THREE.Vector2()).setGroup(renderGroup);
  private readonly fullSize=uniform(new THREE.Vector2()).setGroup(renderGroup);
  private readonly inverseProjection:Node<'mat4'>;
  private readonly cameraWorld:Node<'mat4'>;
  private readonly lightPosition=uniform(this.light.position).setGroup(renderGroup);
  private readonly blockers=kernel(12);
  private readonly filters=kernel(24);
  private readonly point:PointRuntime;
  private readonly result;
  private readonly depth:TextureNode<'vec4'>;
  private readonly normals:TextureNode<'vec4'>;
  private frameRenders=0;
  private casterScene:THREE.Scene;
  private shadowSubmission={draws:0,triangles:0};
  private casterStats:unknown=null;
  resolutionScale=.5;

  constructor(private readonly scene:THREE.Scene,private readonly camera:THREE.PerspectiveCamera,depth:TextureInput,normals:TextureInput){
    super('float');this.casterScene=scene;this.updateBeforeType=NodeUpdateType.FRAME;this.depth=depth as TextureNode<'vec4'>;this.normals=normals as TextureNode<'vec4'>;
    this.raw.texture.name='Moving shadow visibility + view depth';this.resolved.texture.name='Moving shadow reconstruction';
    this.light.name='Moving lantern screen visibility';this.light.castShadow=true;this.light.visible=false;
    const s=this.light.shadow;s.mapSize.set(1024,1024);s.camera.near=.08;s.camera.far=9;s.bias=-.0001;s.normalBias=.006;s.autoUpdate=false;s.needsUpdate=true;
    this.inverseProjection=uniform(camera.projectionMatrixInverse).setGroup(renderGroup);this.cameraWorld=uniform(camera.matrixWorld).setGroup(renderGroup);
    this.point=pointShadow(this.light) as PointRuntime;
    // Own the cube's update here; a fullscreen material's scene/camera are not
    // the street. Keep Three's caster filtering, depth material and face layout.
    this.point.setup=(builder:NodeBuilder)=>{
      if(!this.point.shadowMap){
        const target=this.point.setupRenderTarget(s,builder);this.point.shadowMap=target.shadowMap;s.map=target.shadowMap;
        target.depthTexture.minFilter=target.depthTexture.magFilter=THREE.LinearFilter;
        s.camera.coordinateSystem=builder.renderer.coordinateSystem;s.camera.updateProjectionMatrix();
      }
      return this.visibility(this.point.shadowMap.depthTexture as unknown as THREE.CubeTexture);
    };
    this.point.updateBefore=(frame:NodeFrame)=>{
      if(!frame.renderer||!this.light.visible||!s.needsUpdate)return;
      const stats=frame.renderer.info.render,draws=stats.drawCalls,triangles=stats.triangles;
      this.light.updateWorldMatrix(true,false);this.point.updateShadow({renderer:frame.renderer,scene:this.casterScene,camera:this.camera});s.needsUpdate=false;
      this.shadowSubmission={draws:stats.drawCalls-draws,triangles:stats.triangles-triangles};
    };
    this.result=passTexture(this as unknown as PassNode,this.resolved.texture);
    s.shadowNode=vec3(nodeObject(this));
  }

  // A sampled depth belongs to one full-resolution pixel ray. Using the half
  // resolution UV instead displaces the receiver off its surface, even on a
  // flat pavement. Use the same texel center for depth, normal and projection;
  // round(585 / 2) also makes the two grids non-integral on phone viewports.
  private receiverUV(at:Node<'vec2'>){return at.mul(this.fullSize).floor().clamp(vec2(0),this.fullSize.sub(1)).add(.5).div(this.fullSize);}
  private viewPosition(at:Node<'vec2'>){const coord=this.receiverUV(at);return getViewPosition(coord,this.depth.sample(coord).r,this.inverseProjection);}
  private worldPosition(at:Node<'vec2'>){return this.cameraWorld.mul(vec4(this.viewPosition(at),1)).xyz;}
  private viewNormal(at:Node<'vec2'>){return this.normals.sample(this.receiverUV(at)).rgb.normalize();}
  private worldNormal(at:Node<'vec2'>){return this.cameraWorld.mul(vec4(this.viewNormal(at),0)).xyz.normalize();}

  private visibility(depthTexture:THREE.CubeTexture){
    return Fn(()=>{
      const coord=this.receiverUV(uv()).toConst(),normal=this.worldNormal(coord).toConst();
      const world=this.worldPosition(coord).toConst();
      const visibility=float(1).toVar();
      const delta=world.add(normal.mul(.006)).sub(this.lightPosition).toConst();
      const distance=delta.length().toConst();
      If(this.depth.sample(coord).r.lessThan(.999999).and(distance.lessThan(9)).and(distance.greaterThan(.08)),()=>{
        const dominant=(d:Node<'vec3'>)=>d.abs().x.max(d.abs().y).max(d.abs().z);
        const direction=delta.div(distance).toConst();
        const dp=viewZToPerspectiveDepth(dominant(delta).negate(),float(.08),float(9)).sub(.0001).toConst();
        const receiver=perspectiveDepthToViewZ(dp,float(.08),float(9)).negate().div(dominant(direction)).toConst();
        const tangent=direction.cross(direction.x.abs().greaterThan(direction.z.abs()).select(vec3(0,1,0),vec3(1,0,0))).normalize().toConst();
        const bitangent=direction.cross(tangent).toConst(),plane=normal.dot(direction).toConst();
        const angle=interleavedGradientNoise(screenCoordinate.xy).mul(Math.PI*2).toConst(),cs=angle.cos().toConst(),sn=angle.sin().toConst();
        const ray=(offset:Node<'vec2'>,radius:Node<'float'>)=>{
          const disk=vec2(offset.x.mul(cs).sub(offset.y.mul(sn)),offset.x.mul(sn).add(offset.y.mul(cs)));
          return direction.add(tangent.mul(disk.x).add(bitangent.mul(disk.y)).mul(radius));
        };
        const planeDistance=(d:Node<'vec3'>)=>{
          const denominator=normal.dot(d);
          return plane.mul(denominator).greaterThan(.0001).select(receiver.mul(plane).div(denominator),receiver).clamp(receiver.mul(.5),receiver.mul(2));
        };
        const radius=float(.22).mul(float(2).sub(receiver.reciprocal())).clamp(0,.4).toConst();
        const sum=float(0).toVar(),count=float(0).toVar();
        Loop(12,({i})=>{
          const d=direction.toVar();If(i.greaterThan(0),()=>{d.assign(ray(this.blockers.element(i),radius).normalize());});
          const raw=cubeTexture(depthTexture,d);raw.getUniformHash=()=>depthTexture.uuid+'-screen-blockers';
          const z=perspectiveDepthToViewZ(raw.r,float(.08),float(9)).negate().div(dominant(d)).toConst();
          If(z.lessThan(planeDistance(d).sub(.012)),()=>{sum.addAssign(z);count.addAssign(1);});
        });
        If(count.greaterThan(0),()=>{
          const blocker=sum.div(count).max(.5).toConst();
          const penumbra=float(.22).mul(receiver.sub(blocker).max(0)).div(blocker.mul(receiver)).max(2/1024).toConst();
          const filtered=float(0).toVar();
          Loop(24,({i})=>{
            const d=ray(this.filters.element(i),penumbra).normalize().toConst();
            const compare=viewZToPerspectiveDepth(planeDistance(d).mul(dominant(d)).negate(),float(.08),float(9));
            filtered.addAssign(cubeTexture(depthTexture,d).compare(compare));
          });
          visibility.assign(filtered.div(24));
        }).Else(()=>{visibility.assign(cubeTexture(depthTexture,direction).compare(dp));});
      });
      return visibility;
    })();
  }

  override setup(){
    this.rawMaterial.fragmentNode=Fn(()=>vec2((nodeObject(this.point) as unknown as Node<'float'>),this.viewPosition(uv()).z.negate()))();
    this.rawMaterial.depthTest=false;this.rawMaterial.depthWrite=false;this.rawMaterial.name='Moving shadow filtering';
    const rawTexture=texture(this.raw.texture);
    this.resolveMaterial.fragmentNode=Fn(()=>{
      const coord=uv(),centerDepth=this.viewPosition(coord).z.negate().toConst(),centerNormal=this.viewNormal(coord).toConst();
      const pixel=coord.mul(this.lowSize).sub(.5).toConst(),base=pixel.floor().toConst(),fraction=pixel.fract().toConst();
      const total=float(0).toVar(),weight=float(0).toVar();
      for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){
        const at=base.add(vec2(x+.5,y+.5)).div(this.lowSize).toConst();
        const sample=rawTexture.sample(at).toConst(),n=this.viewNormal(at);
        const spatial=(x?fraction.x:fraction.x.oneMinus()).mul(y?fraction.y:fraction.y.oneMinus());
        const depthWeight=sample.g.sub(centerDepth).abs().div(centerDepth.mul(.005).max(.025)).negate().exp();
        const w=spatial.mul(depthWeight).mul(centerNormal.dot(n).max(0).pow(32)).toConst();
        total.addAssign(sample.r.mul(w));weight.addAssign(w);
      }
      const result=float(1).toVar();
      If(weight.greaterThan(.05),()=>{result.assign(total.div(weight));}).Else(()=>{result.assign((nodeObject(this.point) as unknown as Node<'float'>));});
      return result;
    })();
    this.resolveMaterial.depthTest=false;this.resolveMaterial.depthWrite=false;this.resolveMaterial.name='Moving shadow reconstruction';
    return this.result.sample(screenUV).r;
  }

  override updateBefore(frame:NodeFrame){
    const renderer=frame.renderer;if(!renderer||!this.light.visible)return;
    const state=THREE.RendererUtils.resetRendererState(renderer,THREE.RendererUtils.saveRendererState(renderer));
    try{
      renderer.getDrawingBufferSize(this.size);const width=Math.max(1,Math.round(this.size.x*this.resolutionScale)),height=Math.max(1,Math.round(this.size.y*this.resolutionScale));
      this.fullSize.value.copy(this.size);this.lowSize.value.set(width,height);this.raw.setSize(width,height);this.resolved.setSize(this.size.x,this.size.y);
      this.quad.material=this.rawMaterial;this.quad.name='Moving shadow filtering';renderer.setRenderTarget(this.raw);this.quad.render(renderer);
      this.quad.material=this.resolveMaterial;this.quad.name='Moving shadow reconstruction';renderer.setRenderTarget(this.resolved);this.quad.render(renderer);this.frameRenders++;
    }finally{THREE.RendererUtils.restoreRendererState(renderer,state);}
    return undefined;
  }
  setCasters(scene:THREE.Scene,stats:unknown){this.casterScene=scene;this.casterStats=stats;this.light.shadow.needsUpdate=true;}
  snapshot(){return {method:'screen visibility with depth/normal reconstruction',resolutionScale:this.resolutionScale,blockerSamples:12,filterSamples:24,rawSize:[this.raw.width,this.raw.height],outputSize:[this.resolved.width,this.resolved.height],frames:this.frameRenders,geometry:this.casterScene===this.scene?'full':'spatial',casters:this.casterStats,lastShadowSubmission:{...this.shadowSubmission}};}
  override dispose(){this.point.dispose();this.raw.dispose();this.resolved.dispose();this.rawMaterial.dispose();this.resolveMaterial.dispose();super.dispose();}
}
