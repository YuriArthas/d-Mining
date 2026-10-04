import { Mesh, type Object3D, type BufferGeometry } from 'three';

// CPU backing stores, counted once even for cloned meshes/interleaved attributes.
// This does not estimate driver allocation or total browser memory.
export function sceneryGeometryMemory(root:Object3D){
  const buffers=new Set<ArrayBufferLike>(),geometries=new Set<BufferGeometry>();
  let instanceTriangles=0;
  root.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const geometry=object.geometry;
    instanceTriangles+=(geometry.index?.count??geometry.attributes.position?.count??0)/3;
    if(geometries.has(geometry))return;
    geometries.add(geometry);
    for(const attribute of [...Object.values(geometry.attributes),geometry.index]){
      if(!attribute)continue;
      buffers.add(('data' in attribute?attribute.data.array:attribute.array).buffer);
    }
  });
  return {geometryBytes:[...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0),geometries:geometries.size,instanceTriangles};
}
