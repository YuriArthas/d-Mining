import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,DataTexture,RGBAFormat,SRGBColorSpace,NearestFilter,LinearMipmapLinearFilter,RepeatWrapping} from 'three';
import {BOUNDARY_TIERS,expandBoundary,type BoundaryRect} from '../world/BoundaryProfile.ts';
import {stabilizeShadows} from './stableShadow.ts';
// One closed stepped earth body. Facades are decoration, never the terrain seal.
export function boundaryCoreGeometry(){
 const profiles:{rect:BoundaryRect;y:number;material:number}[]=[],first=BOUNDARY_TIERS[0];
 profiles.push({rect:expandBoundary(first.inner,2.4),y:first.base,material:0});
 for(const t of BOUNDARY_TIERS){
  // A solid timber cap covers the wall; grass starts only above supported soil.
  profiles.push({rect:expandBoundary(t.inner,2.4),y:t.top-.32,material:2},{rect:t.inner,y:t.top-.32,material:2},{rect:t.inner,y:t.top,material:2});
  profiles.push({rect:expandBoundary(t.inner,2.4),y:t.top,material:1});
  profiles.push({rect:t===BOUNDARY_TIERS.at(-1)?t.outer:expandBoundary(t.outer,2.4),y:t.top,material:0});
 }
 profiles.push({rect:BOUNDARY_TIERS.at(-1)!.outer,y:first.base,material:0});
 const corners=({rect:r,y}:{rect:BoundaryRect;y:number})=>[[r.left,y,r.back],[r.right,y,r.back],[r.right,y,r.front],[r.left,y,r.front]];
 const positions:number[]=[],uvs:number[]=[],g=new BufferGeometry();
 for(let i=0;i<profiles.length;i++){
  const a=corners(profiles[i]),b=corners(profiles[(i+1)%profiles.length]);
  for(let side=0;side<4;side++){
   const next=(side+1)%4,start=positions.length/3;
   const verts=[a[side],a[next],b[next],a[side],b[next],b[side]];
   const horizontal=profiles[i].y===profiles[(i+1)%profiles.length].y;
   for(const v of verts){positions.push(...v);uvs.push(horizontal?v[0]*.5:(side%2?v[2]:v[0])*.5,horizontal?v[2]*.5:v[1]*.5);}
   g.addGroup(start,6,profiles[i].material);
  }
 }
 g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function pixelTexture(grass:boolean){
 const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=((Math.imul(x>>1,73856093)^Math.imul(y>>1,19349663))>>>0)%17;
  const shade=.84+h*.019,base=grass?[68,111,25]:[103,72,35],i=(y*size+x)*4;
  base.forEach((v,c)=>data[i+c]=Math.min(255,Math.round(v*shade)));data[i+3]=255;
 }
 const t=new DataTexture(data,size,size,RGBAFormat);t.colorSpace=SRGBColorSpace;t.magFilter=NearestFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.wrapS=t.wrapT=RepeatWrapping;t.needsUpdate=true;return t;
}
function timberTexture(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const row=Math.floor(y/16),within=y%16,offset=(row%2)*32;
  const join=(x+offset)%64===0,edge=within===0;
  const grain=Math.sin(x*.18+Math.sin(y*.9)*1.8)*.025+Math.sin(y*2.4+x*.05)*.045;
  const shade=edge||join?.56:within===1?1.08:.93+grain+row*.016;
  const i=(y*size+x)*4;[139,96,49].forEach((v,c)=>data[i+c]=Math.round(v*shade));data[i+3]=255;
 }
 const t=new DataTexture(data,size,size,RGBAFormat);t.colorSpace=SRGBColorSpace;t.magFilter=NearestFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.wrapS=t.wrapT=RepeatWrapping;t.needsUpdate=true;t.name='terrace-timber-cap-64';return t;
}
export function createBoundaryCore(){
 const materials=[pixelTexture(false),pixelTexture(true),timberTexture()].map(map=>stabilizeShadows(new MeshStandardMaterial({map,roughness:1,metalness:0,envMapIntensity:.35})));
 const g=boundaryCoreGeometry();
 // Batch by material: soil, grass and timber, not one draw per strip.
 const p=g.getAttribute('position'),uv=g.getAttribute('uv'),n=g.getAttribute('normal'),pos:number[]=[],tex:number[]=[],norm:number[]=[];const groups=[...g.groups];g.clearGroups();
 for(let material=0;material<materials.length;material++){const start=pos.length/3;for(const group of groups.filter(s=>s.materialIndex===material))for(let i=group.start;i<group.start+group.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));tex.push(uv.getX(i),uv.getY(i));norm.push(n.getX(i),n.getY(i),n.getZ(i));}g.addGroup(start,pos.length/3-start,material);}
 g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('normal',new Float32BufferAttribute(norm,3));g.setAttribute('uv',new Float32BufferAttribute(tex,2));
 const mesh=new Mesh(g,materials);mesh.name='continuous-terrace-earth';mesh.userData.boundaryCore=true;return mesh;
}
