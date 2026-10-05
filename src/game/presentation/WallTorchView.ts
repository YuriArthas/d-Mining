import {BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,MeshBasicMaterial,MeshStandardMaterial,Object3D} from 'three';
import {stabilizeShadows} from './stableShadow.ts';
import data from '../assets/ground-details/wall-torch.json' with {type:'json'};
import {WALL_TORCHES,WALL_TORCH_LEVEL} from '../world/WallTorches.ts';
import type {SurfaceTime} from '../world/SceneLighting.ts';
// Decoration owns only the fixture/flame. Actual lights belong to SceneLightingRig.
export class WallTorchView {
 readonly group=new Group();
 private readonly flames:InstancedMesh[]=[];
 private readonly clock={value:0};
 constructor(){
  this.group.name='blender-wall-torches';const pose=new Object3D();
  for(const [part,d] of Object.entries(data)){
   const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new Float32BufferAttribute(d.normals,3));g.setAttribute('color',new Float32BufferAttribute(d.colors,3));
   const flame=part!=='body';
   const material=flame?new MeshBasicMaterial({vertexColors:true,toneMapped:false}):stabilizeShadows(new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,envMapIntensity:.3}));
   if(flame){
    material.onBeforeCompile=shader=>{
     shader.uniforms.torchTime=this.clock;
     shader.vertexShader='uniform float torchTime;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*.73+instanceMatrix[3].z*.43;
      float tip=max(position.y-.60,0.);
      transformed.y+=tip*.06*sin(torchTime*5.+phase);
      transformed.x+=tip*.025*sin(torchTime*3.7+phase);`);
    };
    material.customProgramCacheKey=()=> 'solid-voxel-torch-flame-v1';
   }
   const mesh=new InstancedMesh(g,material,WALL_TORCHES.length);mesh.name=`wall-torch-${part}`;
   WALL_TORCHES.forEach(({fixture:p},i)=>{pose.position.set(p.x,p.y,p.z);pose.rotation.y=p.yaw;pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=.1;mesh.castShadow=false;mesh.receiveShadow=false;
   if(flame)this.flames.push(mesh);
   this.group.add(mesh);
  }
 }
 update(time:SurfaceTime,elapsed:number){this.clock.value=elapsed;for(const mesh of this.flames)mesh.visible=time==='night';}
 diagnostics(){return {count:WALL_TORCHES.length,level:WALL_TORCH_LEVEL+1,perWall:Object.fromEntries(['front','back','left','right'].map(side=>[side,WALL_TORCHES.filter(t=>t.side===side).length])),trianglesPerTorch:Object.values(data).reduce((sum,d)=>sum+d.triangles,0),batches:this.group.children.length,textureBytes:0,flamesVisible:this.flames.every(m=>m.visible),castsShadow:false};}
}
