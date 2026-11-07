import {TempNode,NodeUpdateType,RenderTarget,HalfFloatType,NodeMaterial,QuadMesh,RendererUtils,Vector2,Color} from 'three/webgpu';
import {Fn,uv,uniform,vec2,vec3,vec4,passTexture,context,color,texture} from 'three/tsl';

// The district has two emissive chromaticities, both with linear red = 1.
// Main HDR alpha stores 1 + lantern.r - window.r; opaque background stays 1.
// Decode before blur. A mixed lantern/window MSAA edge can cancel slightly;
// this representation is deliberately tested against the original RGB MRT.
export class DistrictHalo extends TempNode<'vec4'> {
  static get type(){return 'DistrictHalo';}
  readonly target=new RenderTarget(1,1,{depthBuffer:false,type:HalfFloatType});
  readonly verticalTarget=new RenderTarget(1,1,{depthBuffer:false,type:HalfFloatType});
  private readonly inverse=uniform(new Vector2(1,1));
  private readonly material=new NodeMaterial();
  private readonly quad=new QuadMesh(this.material);
  private readonly verticalMaterial=new NodeMaterial();
  private readonly verticalQuad=new QuadMesh(this.verticalMaterial);
  private readonly result=passTexture(this as any,this.target.texture);
  private readonly verticalResult=passTexture(this as any,this.verticalTarget.texture);
  // TSL's polymorphic node types do not describe a PassTextureNode's sampled shape.
  constructor(private readonly source:any,private readonly fused=false){
    super('vec4');this.updateBeforeType=NodeUpdateType.FRAME;
    this.target.texture.name='District halo horizontal';this.quad.name='District halo horizontal';
    this.verticalTarget.texture.name='District halo vertical';this.verticalQuad.name='District halo vertical';
  }
  setup(builder:any){
    const weights=Array.from({length:9},(_,i)=>Math.exp(-.5*i*i/9));
    const total=weights[0]+2*weights.slice(1).reduce((a,b)=>a+b,0);
    const lamp=color(new Color('#ffe8bc')),window=color(new Color('#ffc681'));
    const decode=(p:any)=>{const amplitude=this.source.sample(p).a.sub(1);return lamp.mul(amplitude.max(0)).add(window.mul(amplitude.negate().max(0)));};
    const blur=(sample:(p:any)=>any,direction:any)=>Fn(()=>{
      const sum=vec3(sample(uv()).mul(weights[0]/total)).toVar();
      for(let i=1;i<9;i++){
        const offset=this.inverse.mul(direction).mul(1.5*i);
        sum.addAssign(sample(uv().add(offset)).add(sample(uv().sub(offset))).mul(weights[i]/total));
      }
      return vec4(sum,1);
    })();
    this.material.contextNode=context(builder.getSharedContext());
    this.material.fragmentNode=blur(decode,vec2(1,0));this.material.name='District halo extraction + horizontal';this.material.needsUpdate=true;
    // Preserve upstream PassNode scheduling even though its texture is read by
    // the separate horizontal material. No hidden texture-conversion pass.
    builder.getNodeProperties(this).source=this.source;
    // Keep the previous full-resolution filter as an explicit benchmark arm.
    if(this.fused)return blur(p=>this.result.sample(p).rgb,vec2(0,1));
    // Both directions now filter half-resolution pixels. Final output reads
    // the completed halo once instead of performing 17 full-resolution taps.
    // A plain texture avoids recursively scheduling this node from its own pass.
    const horizontal=texture(this.target.texture);
    this.verticalMaterial.fragmentNode=blur(p=>horizontal.sample(p).rgb,vec2(0,1));
    this.verticalMaterial.name='District halo vertical';this.verticalMaterial.needsUpdate=true;
    return this.verticalResult;
  }
  updateBefore({renderer}:any){
    const image=this.source.value.image;
    const width=Math.max(1,Math.round(image.width*.5)),height=Math.max(1,Math.round(image.height*.5));
    this.inverse.value.set(1/width,1/height);this.target.setSize(width,height);
    if(!this.fused)this.verticalTarget.setSize(width,height);
    const saved=RendererUtils.resetRendererState(renderer,{} as any);
    try{
      renderer.setRenderTarget(this.target);this.quad.render(renderer);
      if(!this.fused){renderer.setRenderTarget(this.verticalTarget);this.verticalQuad.render(renderer);}
    }
    finally{RendererUtils.restoreRendererState(renderer,saved);}
    return undefined;
  }
  dispose(){this.target.dispose();this.verticalTarget.dispose();this.material.dispose();this.verticalMaterial.dispose();super.dispose();}
}
