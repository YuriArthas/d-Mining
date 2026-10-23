import { useEffect, useMemo, type RefObject } from 'react';
import { CanvasTexture, Group, Mesh } from 'three';

// A single soft contact decal avoids regenerating static scenery shadows for movement.
// By day a second, longer decal lies along the baked sun's direction: the miner's own shadow, matching the
// baked shadows around it (updateGame turns and fades it; no shadow maps).
export function ContactShadow({shadowRef,sunShadowRef}:{shadowRef:RefObject<Mesh|null>;sunShadowRef:RefObject<Group|null>}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,3,32,32,31);
    gradient.addColorStop(0,'rgba(27,43,55,.3)');gradient.addColorStop(.45,'rgba(27,43,55,.17)');gradient.addColorStop(1,'rgba(27,43,55,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new CanvasTexture(canvas);
  },[]);
  // An even core that fades only near its rim, so the stretched decal reads as a body's shadow.
  const sunTexture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,8,32,32,31);
    gradient.addColorStop(0,'rgba(22,36,46,1)');gradient.addColorStop(.55,'rgba(22,36,46,.85)');gradient.addColorStop(1,'rgba(22,36,46,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new CanvasTexture(canvas);
  },[]);
  useEffect(()=>()=>{texture.dispose();sunTexture.dispose();},[texture,sunTexture]);
  // Feet include ~.027m collision skin; the authored meadow surface reaches .022m.
  // Keep the decal above that visible surface rather than buried beneath it.
  return <>
    <mesh ref={shadowRef} position={[0,-.002,0]} rotation={[-Math.PI/2,0,0]} renderOrder={1}>
      <planeGeometry args={[1.55,1.55]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
    <group ref={sunShadowRef} visible={false}>
      <mesh position={[0,-.001,-.62]} rotation={[-Math.PI/2,0,0]} scale={[.62,1.62,1]} renderOrder={1} userData={{decal:true}}>
        <planeGeometry args={[1,1]} />
        <meshBasicMaterial map={sunTexture} transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  </>;
}
