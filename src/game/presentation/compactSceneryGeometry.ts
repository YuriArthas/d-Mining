import { Int16BufferAttribute, Uint16BufferAttribute, Uint8BufferAttribute, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Keep positions, normals, UV seams and every triangle. Only coincident vertices
// with matching attributes can be shared. Indexed inputs already have that work.
export function compactSceneryGeometry(source:BufferGeometry):BufferGeometry {
  const indexed=source.index?source:mergeVertices(source,1e-6);
  if(indexed!==source)source.dispose();
  // These attributes are bounded by the shader contract. Quantizing them avoids
  // retaining four-byte Float32 channels for every decorative vertex.
  const color=indexed.getAttribute('color');
  if(color){
    const data=new Uint8Array(color.count*color.itemSize);
    for(let i=0;i<data.length;i++)data[i]=Math.max(0,Math.min(255,Math.round(color.array[i]*255)));
    indexed.setAttribute('color',new Uint8BufferAttribute(data,color.itemSize,true));
  }
  const normal=indexed.getAttribute('normal');
  if(normal){
    const data=new Int16Array(normal.count*normal.itemSize);
    for(let i=0;i<data.length;i++)data[i]=Math.max(-32767,Math.min(32767,Math.round(normal.array[i]*32767)));
    indexed.setAttribute('normal',new Int16BufferAttribute(data,normal.itemSize,true));
  }
  const uv=indexed.getAttribute('uv');
  if(uv){
    const data=new Uint16Array(uv.count*uv.itemSize);
    for(let i=0;i<data.length;i++)data[i]=Math.max(0,Math.min(65535,Math.round(uv.array[i]*65535)));
    indexed.setAttribute('uv',new Uint16BufferAttribute(data,uv.itemSize,true));
  }
  return indexed;
}
