import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {reorder,quantize} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),source='public/assets/district.glb',target='artifacts/district-runtime.glb',record='artifacts/district-compression.json';
const sha=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
const sourceSha256=sha(source),scriptSha256=sha('tools/pack-district.mjs');
const previous=existsSync(new URL(record,root))?JSON.parse(readFileSync(new URL(record,root),'utf8')):null;
if(previous?.sourceSha256===sourceSha256&&previous.scriptSha256===scriptSha256&&existsSync(new URL(target,root))&&sha(target)===previous.resourceSha256){
  console.log('District meshopt representation is current.');
}else{
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const document=await io.read(fileURLToPath(new URL(source,root)));
  const triangles=doc=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((sum,p)=>sum+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
  const originalTriangles=triangles(document);
  await document.transform(reorder({encoder:MeshoptEncoder,target:'size'}),quantize({
    // Shared 16-bit scene grid keeps coincident boundaries together. Material
    // UV0 and HDR vertex colors remain exact floats, including values > 1.
    pattern:/^(POSITION|NORMAL|TEXCOORD_1)$/,
    quantizationVolume:'scene',quantizePosition:16,quantizeNormal:16,quantizeTexcoord:16,
  }));
  // No extra lossy normal filter or triangle reduction.
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  await io.write(fileURLToPath(new URL(target,root)),document);
  const decoded=await io.read(fileURLToPath(new URL(target,root)));
  if(triangles(decoded)!==originalTriangles)throw Error('Meshopt changed triangle count');
  const before=document.getRoot().listMeshes(),after=decoded.getRoot().listMeshes();
  if(before.length!==after.length)throw Error('Meshopt changed mesh count');
  let arraysChecked=0;
  for(let i=0;i<before.length;i++){
    const a=before[i].listPrimitives(),b=after[i].listPrimitives();
    if(a.length!==b.length)throw Error('Meshopt changed primitive count');
    for(let j=0;j<a.length;j++)for(const key of [...a[j].listSemantics(),'indices']){
      const aa=(key==='indices'?a[j].getIndices():a[j].getAttribute(key))?.getArray();
      const bb=(key==='indices'?b[j].getIndices():b[j].getAttribute(key))?.getArray();
      if(!aa||!bb||aa.length!==bb.length)throw Error('Meshopt decode length mismatch: '+key);
      if(key==='indices'){
        // Triangle coding may rotate (a,b,c) to (b,c,a), preserving winding.
        for(let k=0;k<aa.length;k+=3)if(![0,1,2].some(offset=>[0,1,2].every(v=>aa[k+v]===bb[k+(v+offset)%3])))throw Error('Meshopt changed a triangle');
      }else if(aa.some((v,k)=>v!==bb[k]))throw Error('Meshopt decode mismatch: '+key);
      arraysChecked++;
    }
  }
  const output={method:'Meshopt with 16-bit position/normal/UV1 quantization; exact float colors and material UV0; no simplification',quantization:{bits:16,volume:'scene',positionStepMetres:57/65535,lightmapStepTexels:4096/65535},source,sourceSha256,script:'tools/pack-district.mjs',scriptSha256,resource:target,resourceSha256:sha(target),sourceBytes:readFileSync(new URL(source,root)).length,resourceBytes:readFileSync(new URL(target,root)).length,triangles:originalTriangles,arraysChecked,decodedArraysIdentical:true,decodedArraysReference:'After quantization, before meshopt encoding'};
  writeFileSync(new URL(record,root),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}
