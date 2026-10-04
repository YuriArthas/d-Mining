import { BufferAttribute, CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type BufferGeometry } from 'three';
import type { Shape } from '../world/sceneryKit.ts';

export type SceneryPiece={shape:Shape;geometry:BufferGeometry};
// A bounded, load-time proximity approximation. No ray marching, screen-space pass, or frame-time updates.
export function bakeSurfaceOcclusion(pieces:SceneryPiece[]) {
  const started=performance.now();
  const bounds=pieces.map(p=>{p.geometry.computeBoundingBox();return p.geometry.boundingBox!.clone()});
  const eligible=new Set(['box','cylinder','trunk','crown','cutRock','bluff','grassTop']);
  let probes=0;
  for(const [index,piece] of pieces.entries()){
    const position=piece.geometry.getAttribute('position'),normal=piece.geometry.getAttribute('normal');
    const values=new Float32Array(position.count).fill(1);
    if(!piece.shape.glow){
      const reach=piece.shape.material==='leaves'?.8:.55,near=bounds[index].clone().expandByScalar(reach);
      const neighbours=pieces.flatMap((p,i)=>i!==index&&!p.shape.glow&&eligible.has(p.shape.type)&&near.intersectsBox(bounds[i])?[i]:[]);
      for(let v=0;v<position.count;v++){
        const nx=normal.getX(v),ny=normal.getY(v),nz=normal.getZ(v);
        const x=position.getX(v)+nx*.035,y=position.getY(v)+ny*.035,z=position.getZ(v)+nz*.035;
        let occlusion=0;
        for(const i of neighbours){
          probes++;
          const other=pieces[i].shape,b=bounds[i];
          let dx:number,dy:number,dz:number,distance:number;
          if(other.type==='crown'){
            // Ellipsoid distance avoids treating the empty corners of a canopy's bounds as leaves.
            const cx=(b.min.x+b.max.x)*.5,cy=(b.min.y+b.max.y)*.5,cz=(b.min.z+b.max.z)*.5;
            const rx=(b.max.x-b.min.x)*.5,ry=(b.max.y-b.min.y)*.5,rz=(b.max.z-b.min.z)*.5;
            const q=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz);
            if(q<1){occlusion=Math.max(occlusion,.82);continue;}
            dx=(cx-x)*(1-1/q);dy=(cy-y)*(1-1/q);dz=(cz-z)*(1-1/q);distance=Math.hypot(dx,dy,dz);
          }else{
            dx=Math.max(b.min.x,Math.min(b.max.x,x))-x;dy=Math.max(b.min.y,Math.min(b.max.y,y))-y;dz=Math.max(b.min.z,Math.min(b.max.z,z))-z;
            distance=Math.hypot(dx,dy,dz);
          }
          if(distance>=reach)continue;
          const facing=distance<.001?1:Math.max(0,(nx*dx+ny*dy+nz*dz)/distance);
          occlusion=Math.max(occlusion,(1-distance/reach)**2*facing);
        }
        // Down-facing undersides retain less skylight than exposed tops.
        const underside=Math.max(0,-ny)*.16;
        values[v]=Math.max(.46,1-occlusion*.48-underside);
      }
    }
    piece.geometry.setAttribute('artOcclusion',new BufferAttribute(values,1));
  }
  // Keep this diagnostic separate from frame-rate measurements: the work occurs on scene creation.
  return {bakeMs:performance.now()-started,probes};
}

export function createGroundContact(pieces:SceneryPiece[]) {
  const size=512,span=96,scale=size/span,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  for(const piece of pieces){
    const b=piece.geometry.boundingBox!;
    if(piece.shape.glow||b.min.y>.15||b.max.y-b.min.y<.16)continue;
    const x=(b.min.x+b.max.x)*.5,z=(b.min.z+b.max.z)*.5;
    const rx=(b.max.x-b.min.x)*.525+.45,rz=(b.max.z-b.min.z)*.525+.45;
    // Visual footprints only: changing physics bounds must not change the art.
    ctx.save();ctx.translate((x+span/2)*scale,(span/2+z)*scale);ctx.scale(rx*scale,rz*scale);
    const gradient=ctx.createRadialGradient(0,0,0,0,0,1);gradient.addColorStop(0,'rgba(20,34,48,.38)');gradient.addColorStop(.57,'rgba(20,34,48,.26)');gradient.addColorStop(1,'rgba(20,34,48,0)');
    ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  // Never cover a mineable cell, including after the full entrance is dug out.
  ctx.clearRect((span/2-8.25)*scale,(span/2-8.25)*scale,16.5*scale,16.5*scale);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  const material=new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,alphaTest:.005,opacity:.85,toneMapped:false});
  const mesh=new Mesh(new PlaneGeometry(span,span),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.012;mesh.renderOrder=1;
  mesh.name='surface-contact-occlusion';return mesh;
}
