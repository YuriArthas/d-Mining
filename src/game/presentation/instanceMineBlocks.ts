import {Group,InstancedMesh,Matrix4,Mesh} from 'three';

// Batch the modular mine kit while sharing its authored geometry and textures.
export function instanceMineBlocks(group:Group){
 group.updateMatrixWorld(true);
 const blocks=group.children.filter(child=>child.userData.mineBatch===true);
 const batches=new Map<string,{mesh:Mesh;matrices:Matrix4[]}>();
 const inverse=new Matrix4().copy(group.matrixWorld).invert();
 for(const block of blocks)block.traverse(o=>{
  if(!(o instanceof Mesh))return;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  const key=[o.geometry.uuid,...materials.map(m=>m.uuid)].join(':');
  let batch=batches.get(key);
  if(!batch){batch={mesh:o,matrices:[]};batches.set(key,batch);}
  batch.matrices.push(new Matrix4().multiplyMatrices(inverse,o.matrixWorld));
 });
 for(const {mesh,matrices} of batches.values()){
  const instances=new InstancedMesh(mesh.geometry,mesh.material,matrices.length);
  instances.name='mine-grid-batch';instances.castShadow=mesh.castShadow;instances.receiveShadow=mesh.receiveShadow;
  matrices.forEach((matrix,i)=>instances.setMatrixAt(i,matrix));
  instances.instanceMatrix.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();
  group.add(instances);
 }
 for(const block of blocks)group.remove(block);
 return {blocks:blocks.length,batches:batches.size};
}
