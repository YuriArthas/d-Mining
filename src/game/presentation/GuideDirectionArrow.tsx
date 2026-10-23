import { useEffect, useMemo, type RefObject } from 'react';
import { useLoader } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';
import arrowUrl from '../assets/guide-arrow/roblox-arrow-v1.webp';
import layout from '../assets/guide-arrow/layout.json';

function geometry() {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(24), 3));
  // Three vertical slices: a fixed tail, stretchable shaft, fixed arrowhead.
  g.setAttribute('uv', new Float32BufferAttribute([
    0,0, 1,0, 0,layout.tailV, 1,layout.tailV,
    0,layout.headV, 1,layout.headV, 0,1, 1,1,
  ],2));
  g.setIndex([0,2,1,1,2,3, 2,4,3,3,4,5, 4,6,5,5,6,7]);
  return g;
}

// Render the actual API-generated artwork. Only the shaft stretches as the
// player moves; the broad cartoon head and outline retain their proportions.
export function updateGuideRoute(group: Group, feet: readonly number[], target: readonly number[]) {
  const dx=target[0]-feet[0],dz=target[2]-feet[2],distance=Math.hypot(dx,dz);
  if(distance<.001){group.visible=false;return;}
  const start=Math.min(1.25,distance*.25),length=Math.max(.1,distance-start);
  // Hover above road edging so crossing a curb cannot slice the continuous arrow.
  group.position.set(feet[0]+dx/distance*start,feet[1]+.4,feet[2]+dz/distance*start);
  group.rotation.y=Math.atan2(dx,dz);
  const mesh=group.children[0] as Mesh<BufferGeometry,MeshBasicMaterial>;
  // Compact the whole head only on the final approach, never invert the shaft.
  // Slim and slightly see-through: one quiet guide, not a road sign across the screen.
  const width=Math.min(1.5,length/(layout.headAspect+layout.tailAspect+.15));
  const tail=width*layout.tailAspect,neck=length-width*layout.headAspect;
  const points=mesh.geometry.getAttribute('position');
  for(const [i,z] of [0,tail,neck,length].entries()){
    points.setXYZ(i*2,-width/2,0,z);points.setXYZ(i*2+1,width/2,0,z);
  }
  points.needsUpdate=true;mesh.geometry.computeBoundingSphere();
  group.userData.length=length;
  group.userData.destination=[target[0],feet[1]+.4,target[2]];
}
export function GuideDirectionArrow({ arrowRef }: { arrowRef: RefObject<Group | null> }) {
  // R3F owns/caches the loaded texture; component-owned geometry/material are disposed here.
  const texture=useLoader(TextureLoader,arrowUrl);
  const resources=useMemo(()=>{
    texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
    return {geometry:geometry(),material:new MeshBasicMaterial({
      map:texture,transparent:true,opacity:.78,alphaTest:.03,depthWrite:false,depthTest:true,
      side:DoubleSide,toneMapped:false,
    })};
  },[texture]);
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose();},[resources]);
  return <group ref={arrowRef} name="onboarding-direction" visible={false} userData={{style:'roblox-image-v1',texture:arrowUrl}}>
    <mesh geometry={resources.geometry} material={resources.material} renderOrder={20}/>
  </group>;
}
