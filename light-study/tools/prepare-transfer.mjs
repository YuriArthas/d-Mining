import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {brotliCompressSync,brotliDecompressSync,constants} from 'node:zlib';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),name='district';
const sha256=data=>createHash('sha256').update(data).digest('hex');
const sourcePath=`artifacts/${name}-runtime.glb`,encodedPath=`public/assets/${name}.glb.br`,recordPath=`artifacts/${name}-transfer.json`;
const original=readFileSync(new URL(sourcePath,root)),sourceHash=sha256(original);
const previous=existsSync(new URL(recordPath,root))?JSON.parse(readFileSync(new URL(recordPath,root),'utf8')):null;
let brotli;
if(previous?.source.sha256===sourceHash&&existsSync(new URL(encodedPath,root))){
  const candidate=readFileSync(new URL(encodedPath,root));if(sha256(candidate)===previous.brotli.sha256)brotli=candidate;
}
if(!brotli){
  brotli=brotliCompressSync(original,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
  writeFileSync(new URL(encodedPath,root),brotli);
}
if(!brotliDecompressSync(brotli).equals(original))throw Error('District Brotli does not decode to its exact authored GLB');
writeFileSync(new URL(recordPath,root),JSON.stringify({method:'Lossless HTTP Brotli, one deployed model representation',source:{path:sourcePath,bytes:original.length,sha256:sourceHash},brotli:{path:encodedPath,bytes:brotli.length,sha256:sha256(brotli)},decodedIdentical:true},null,2)+'\n');
console.log(`District GLB: ${original.length} -> ${brotli.length} bytes, lossless Brotli.`);
