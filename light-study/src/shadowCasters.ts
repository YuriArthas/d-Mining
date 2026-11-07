import * as THREE from 'three/webgpu';

/** Resident, position-only view of the same opaque triangles. Partitioning by
 * centroid changes submission batches only; bounds include every full triangle,
 * including those crossing a cell boundary. No geometry is clipped or unloaded. */
export function createShadowCasters(source:THREE.Object3D,cellSize=10){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid shadow cell size');
  source.updateWorldMatrix(true,true);
  const positions:number[]=[],vertexIds=new Map<string,number>(),cells=new Map<string,number[]>(),point=new THREE.Vector3();
  let triangles=0,sourceMeshes=0;
  source.traverseVisible(object=>{
    if(!(object instanceof THREE.Mesh)||!object.castShadow)return;
    if(Array.isArray(object.material)||object.material.transparent||object.material.alphaTest||object instanceof THREE.SkinnedMesh||object.morphTargetInfluences?.length)throw Error('Spatial shadows require opaque static casters');
    const g=object.geometry,p=g.getAttribute('position'),index=g.index,vertices=new Uint32Array(p.count);
    if(g.drawRange.start!==0||g.drawRange.count!==Infinity)throw Error('Partial caster geometry is unsupported');
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);
      const xyz=point.toArray().map(Math.fround),key=xyz.join('/');let id=vertexIds.get(key);
      if(id===undefined){id=positions.length/3;positions.push(...xyz);vertexIds.set(key,id);}vertices[i]=id;
    }
    const count=index?.count??p.count;if(count%3)throw Error('Incomplete caster triangle');
    for(let i=0;i<count;i+=3){
      const triangle=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
      const center=[0,2].map(axis=>triangle.reduce((sum,v)=>sum+positions[v*3+axis],0)/3);
      const key=center.map(n=>Math.floor(n/cellSize)).join('/');
      const list=cells.get(key)??[];list.push(...triangle);cells.set(key,list);triangles++;
    }
    sourceMeshes++;
  });
  const scene=new THREE.Scene();scene.name='Spatial moving-light casters';
  const position=new THREE.Float32BufferAttribute(positions,3);
  const material=new THREE.MeshBasicNodeMaterial();material.name='Opaque shadow geometry';material.side=material.shadowSide=THREE.DoubleSide;
  const geometries:THREE.BufferGeometry[]=[];let indexBytes=0;
  for(const [key,indices] of cells){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',position);geometry.setIndex(indices);
    // BufferGeometry.computeBoundingBox uses all shared vertices, not just the
    // indices of this cell. Compute conservative local bounds explicitly.
    const box=new THREE.Box3();for(const index of indices)box.expandByPoint(point.fromBufferAttribute(position,index));
    box.expandByScalar(1e-5);geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new THREE.Sphere());
    geometry.boundingSphere.radius+=Math.max(1,geometry.boundingSphere.radius)*1e-6;
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Shadow cell '+key;mesh.castShadow=true;mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;
    scene.add(mesh);geometries.push(geometry);indexBytes+=geometry.index!.array.byteLength;
  }
  scene.updateMatrixWorld(true);
  // r186 invokes Scene.onBeforeRender before projecting its objects, once per
  // shadow face. Tight boxes avoid the large false positives of long-cell spheres.
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
  scene.onBeforeRender=(_renderer,_scene,camera)=>{
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
    for(const mesh of scene.children as THREE.Mesh[])mesh.visible=frustum.intersectsBox(mesh.geometry.boundingBox!);
  };
  return {scene,stats:{cellSize,axes:'xz',culling:'shadow-face bounding boxes',cells:cells.size,triangles,vertices:position.count,sourceMeshes,positionBytes:position.array.byteLength,indexBytes,additionalBytes:position.array.byteLength+indexBytes},dispose:()=>{geometries.forEach(g=>g.dispose());material.dispose();scene.clear();}};
}
