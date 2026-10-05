import {Matrix4,Vector4,type Camera,type Mesh} from 'three';

// Water points on the mirror plane project to the same XY in both cameras.
// Restrict reflection fragment work to the sampled region, with a 3px margin
// for the <0.001 UV ripple plus bilinear filtering. Resolution is unchanged.
export function reflectionScissor(surfaces:readonly Mesh[],camera:Camera,width:number,height:number){
 const full=new Vector4(0,0,width,height),vp=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),mvp=new Matrix4();
 let minX=width,minY=height,maxX=0,maxY=0,any=false;
 for(const mesh of surfaces){
  if(!mesh.visible)continue;
  if(!mesh.geometry.getAttribute('position'))return full;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox!;mvp.multiplyMatrices(vp,mesh.matrixWorld);
  const points:Vector4[]=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new Vector4(x,y,z,1).applyMatrix4(mvp));
  const behind=(p:Vector4)=>p.w<=0||p.z< -p.w;
  if(points.every(behind))continue;
  // Crossing the near plane needs a full capture, not a dangerously undersized
  // rectangle from dividing by tiny/negative W. Keeps close-up water intact.
  if(points.some(behind))return full;
  for(const p of points){const x=(p.x/p.w*.5+.5)*width,y=(p.y/p.w*.5+.5)*height;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);any=true;}
 }
 if(!any)return full;
 const left=Math.max(0,Math.min(width-1,Math.floor(minX)-3)),bottom=Math.max(0,Math.min(height-1,Math.floor(minY)-3));
 const right=Math.min(width,Math.max(left+1,Math.ceil(maxX)+3)),top=Math.min(height,Math.max(bottom+1,Math.ceil(maxY)+3));
 return new Vector4(left,bottom,right-left,top-bottom);
}
