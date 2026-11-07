import * as THREE from 'three/webgpu';
import {pointShadow,nodeObject,uv,vec4} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';

/** Authoring-only public route. Bake the existing PCSS visibility, not light
 * color, BRDF, normal-map shading, emission or ambient lighting. */
export async function bakeStaticShadow(renderer:THREE.Renderer,source:THREE.Group,lamps:THREE.PointLight[],size=4096){
  const scene=new THREE.Scene(),group=source.clone(true);scene.add(group);scene.updateMatrixWorld(true);
  const shadowNodes=lamps.map(l=>pointShadow(l));
  // r186 types omit the TSL extensions on PointShadowNode's vec3 output.
  const channels=shadowNodes.map(s=>nodeObject(s) as unknown as Node<'vec3'>);
  const visibility=vec4(channels[0].r,channels[1].r,channels[2].r,1);
  const materials:THREE.MeshStandardNodeMaterial[]=[];
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    if(Array.isArray(object.material)||!object.geometry.hasAttribute('uv1'))throw Error('Static bake needs opaque atlas-mapped geometry');
    const material=new THREE.MeshStandardNodeMaterial();material.copy(object.material as THREE.MeshStandardNodeMaterial);
    material.name='Static visibility '+object.material.name;
    material.vertexNode=vec4(uv(1).x.mul(2).sub(1),uv(1).y.mul(-2).add(1),0,1);
    material.fragmentNode=visibility;material.depthTest=false;material.depthWrite=false;material.toneMapped=false;
    object.material=material;object.frustumCulled=false;materials.push(material);
  });
  const target=new THREE.RenderTarget(size,size,{type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false});
  target.texture.name='Static lantern visibility atlas';target.texture.colorSpace=THREE.NoColorSpace;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.z=10;camera.updateMatrixWorld(true);
  const previous={target:renderer.getRenderTarget(),mrt:renderer.getMRT(),tone:renderer.toneMapping,color:renderer.outputColorSpace,clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha()};
  try{
    lamps.forEach(l=>{l.updateWorldMatrix(true,false);l.shadow.needsUpdate=true;});
    renderer.setRenderTarget(target);renderer.setMRT(null);renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setClearColor(0xffffff,0);
    await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
    const raw=await renderer.readRenderTargetPixelsAsync(target,0,0,size,size);
    if(!(raw instanceof Uint8Array))throw Error('Visibility atlas must be RGBA8');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');if(!context)throw Error('Cannot export visibility atlas');
    context.putImageData(new ImageData(new Uint8ClampedArray(raw),size,size),0,0);
    let covered=0;for(let i=3;i<raw.length;i+=4)if(raw[i]>0)covered++;
    if(covered<size*size*.1)throw Error('Visibility atlas coverage is unexpectedly low: '+covered);
    return {dataUrl:canvas.toDataURL('image/png'),size,covered,coverage:covered/(size*size),model:__STREET_REVISION__};
  }finally{
    renderer.setRenderTarget(previous.target);renderer.setMRT(previous.mrt);renderer.toneMapping=previous.tone;renderer.outputColorSpace=previous.color;renderer.setClearColor(previous.clear,previous.alpha);
    target.dispose();materials.forEach(m=>m.dispose());shadowNodes.forEach(s=>s.dispose());
  }
}
