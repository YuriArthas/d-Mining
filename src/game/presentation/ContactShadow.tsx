import { useEffect, useMemo, type RefObject } from 'react';
import { CanvasTexture, Mesh } from 'three';

// A single soft contact decal avoids regenerating static scenery shadows for movement.
export function ContactShadow({shadowRef}:{shadowRef:RefObject<Mesh|null>}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,3,32,32,31);
    gradient.addColorStop(0,'rgba(27,43,55,.3)');gradient.addColorStop(.45,'rgba(27,43,55,.17)');gradient.addColorStop(1,'rgba(27,43,55,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new CanvasTexture(canvas);
  },[]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh ref={shadowRef} position={[0,-.018,0]} rotation={[-Math.PI/2,0,0]} renderOrder={1}>
    <planeGeometry args={[1.55,1.55]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
  </mesh>;
}
