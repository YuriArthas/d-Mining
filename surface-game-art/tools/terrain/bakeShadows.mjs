import * as THREE from 'three';
// Offline projection into a single mask. Union avoids stacked triangle opacity.
// Interactive portal/egg templates are excluded: their positions remain configurable.
export function bakeShadows(landscape,architecture,createCanvas){
 const size=1024,origin=-96,span=200,canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
 ctx.fillStyle='#ffffff';const point=new THREE.Vector3();let triangles=0;
 for(const root of [landscape,architecture]){root.updateMatrixWorld(true);root.traverse(o=>{
  if(!o.isMesh||o.userData.surfaceGround)return;
  for(let p=o;p;p=p.parent)if(p.name.startsWith('Portal_')||p.name.startsWith('Egg_')||p.name.startsWith('Terrace'))return;
  const box=new THREE.Box3().setFromObject(o);if(box.max.y<.3||box.min.x>60||box.max.x< -60||box.min.z>75||box.max.z< -55)return;
  const g=o.geometry,positions=g.attributes.position,index=g.index,count=index?index.count:positions.count;
  for(let i=0;i<count;i+=3){ctx.beginPath();for(let j=0;j<3;j++){
   point.fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld);
   const x=(point.x+Math.max(0,point.y)*35/65-origin)/span*size,z=(point.z-Math.max(0,point.y)*45/65-origin)/span*size;
   if(j===0)ctx.moveTo(x,z);else ctx.lineTo(x,z);
  }ctx.closePath();ctx.fill();triangles++;}
 });}
 const pixels=ctx.getImageData(0,0,size,size).data;
 for(let i=0;i<pixels.length;i+=4){pixels[i]=22;pixels[i+1]=39;pixels[i+2]=43;pixels[i+3]=Math.round(pixels[i+3]*.24);}
 const texture=new THREE.DataTexture(new Uint8Array(pixels),size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.name='Pinewind baked daylight contact';
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});
 const group=new THREE.Group();group.name='Baked_Contact_Shadows';
 landscape.updateMatrixWorld(true);landscape.traverse(o=>{
  if(!o.isMesh||!o.userData.surfaceGround)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld),p=g.attributes.position,uv=[];
  for(let i=0;i<p.count;i++){uv.push((p.getX(i)-origin)/span,(p.getZ(i)-origin)/span);p.setY(i,p.getY(i)+.008);}
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.deleteAttribute('color');
  const mesh=new THREE.Mesh(g,material);mesh.userData.bakedContact=true;mesh.name='Baked_Contact';mesh.renderOrder=1;group.add(mesh);
 });
 return {group,triangles,textureSize:size};
}
