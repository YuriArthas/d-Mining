import * as THREE from 'three/webgpu';
import {Fn,texture,uv,vec3,pointShadow,nodeObject} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type NodeBuilder from 'three/src/nodes/core/NodeBuilder.js';
import {loadResource} from './resourceLoading.ts';

/** Visibility only: all light colors, attenuation, BRDF and emission stay live. */
export async function loadStaticShadow(){
  const url=new URL('./assets/street-shadow.webp',document.baseURI);url.searchParams.set('v',__STREET_SHADOW_REVISION__);
  const atlas=await loadResource(url,()=>new THREE.TextureLoader().loadAsync(url.href));
  if(atlas.image.width!==4096||atlas.image.height!==4096)throw Error('Invalid street shadow atlas dimensions');
  atlas.name='Static lantern visibility RGB';atlas.colorSpace=THREE.NoColorSpace;atlas.flipY=false;
  atlas.minFilter=atlas.magFilter=THREE.LinearFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
  const visibility=texture(atlas,uv(1));
  const liveNodes:ReturnType<typeof pointShadow>[]=[];
  return {
    install:(lamps:THREE.PointLight[])=>lamps.forEach((lamp,i)=>{
      const live=pointShadow(lamp);liveNodes.push(live);
      // Compile-time geometry choice: the street shader has no live PCSS path.
      // The separate surrounding ground has no atlas and still receives shadows.
      lamp.shadow.shadowNode=Fn(([],builder:NodeBuilder)=>{
        if(!builder.geometry.hasAttribute('uv1'))return nodeObject(live) as unknown as Node<'vec3'>;
        return vec3([visibility.r,visibility.g,visibility.b][i]);
      })();
    }),
    dispose:()=>{liveNodes.forEach(n=>n.dispose());atlas.dispose();},
  };
}
