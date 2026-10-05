import {Group,InstancedMesh,Matrix4,Mesh,Object3D,Vector3} from 'three';

// Repeated opaque props keep their original geometry/materials. Spatial buckets
// retain frustum culling; no scenery is unloaded based on player distance.
export function instanceStaticProps(root:Group,enabled=true){
 const stats={enabled,sourceMeshes:0,batchedMeshes:0,batches:0,savedCalls:0,cellSize:16,instanceBytes:0};
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),position=new Vector3();
 const buckets=new Map<string,{meshes:Mesh[];matrices:Matrix4[]}>();
 for(const prop of root.children){
  // Portal material ownership remains with SurfaceHubView. The ground has
  // custom world-space shaders/raycast; existing instance batches own themselves.
  if(prop.userData.portalId)continue;
  prop.traverse(o=>{
   if(!(o instanceof Mesh)||o instanceof InstancedMesh||o.userData.surfaceGround||'isSkinnedMesh' in o)return;
   const materials=Array.isArray(o.material)?o.material:[o.material];
   if(materials.some(m=>m.transparent)||o.morphTargetInfluences||o.onBeforeRender!==Object3D.prototype.onBeforeRender||o.onAfterRender!==Object3D.prototype.onAfterRender)return;
   for(let p:Object3D|null=o;p&&p!==root;p=p.parent)if(!p.visible)return;
   const matrix=new Matrix4().multiplyMatrices(inverse,o.matrixWorld);
   // Three does not support negative-determinant instance transforms.
   if(matrix.determinant()<=0)return;
   position.setFromMatrixPosition(matrix);
   const key=[o.geometry.uuid,...materials.map(m=>m.uuid),o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask,o.frustumCulled,
    Math.floor(position.x/stats.cellSize),Math.floor(position.y/stats.cellSize),Math.floor(position.z/stats.cellSize)].join(':');
   let bucket=buckets.get(key);if(!bucket){bucket={meshes:[],matrices:[]};buckets.set(key,bucket);}
   bucket.meshes.push(o);bucket.matrices.push(matrix);stats.sourceMeshes++;
  });
 }
 if(!enabled)return stats;
 for(const {meshes,matrices} of buckets.values()){
  if(meshes.length<2)continue;
  const source=meshes[0],batch=new InstancedMesh(source.geometry,source.material,meshes.length);
  batch.name='static-prop-batch';batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;
  batch.renderOrder=source.renderOrder;batch.layers.mask=source.layers.mask;batch.frustumCulled=source.frustumCulled;
  matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.instanceMatrix.needsUpdate=true;
  batch.computeBoundingBox();batch.computeBoundingSphere();root.add(batch);
  for(const mesh of meshes)mesh.removeFromParent();
  stats.batchedMeshes+=meshes.length;stats.batches++;stats.savedCalls+=meshes.length-1;stats.instanceBytes+=meshes.length*64;
 }
 // Empty imported transform nodes otherwise still cost traversal each render.
 const prune=(node:Object3D)=>{for(const child of [...node.children]){prune(child);if(child instanceof Group&&!child.children.length&&!child.userData.portalId)child.removeFromParent();}};
 prune(root);
 return stats;
}
