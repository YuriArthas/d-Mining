import {fetchAssetParts} from './fetchAssetParts.ts';
import {Gunzip} from 'three/addons/libs/fflate.module.js';
interface ModelDownload {parts:readonly string[];bytes:number;decodedBytes:number}
const crcTable=Uint32Array.from({length:256},(_,value)=>{
 for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
 return value;
});
/** Safari 16.0 has streams, but not DecompressionStream (added in 16.4).
 * Use the decoder already shipped with Three; no external helper download.
 * Scene bundles contain one gzip member. fflate does not validate its trailer,
 * so check CRC32 and ISIZE explicitly, including a truncated/missing trailer. */
function localGzipDecoder(append:(chunk:Uint8Array)=>void){
 let crc=0xffffffff,length=0,packed=0;
 const tail=new Uint8Array(8);
 const decoder=new Gunzip(chunk=>{
  append(chunk);
  for(let i=0;i<chunk.length;i++)crc=(crc>>>8)^crcTable[(crc^chunk[i])&255];
  length+=chunk.length;
 });
 decoder.onmember=()=>{throw new Error('Expected a single gzip model member');};
 return {
  push(chunk:Uint8Array){
   packed+=chunk.length;
   if(chunk.length>=8)tail.set(chunk.subarray(-8));
   else {tail.copyWithin(0,chunk.length);tail.set(chunk,8-chunk.length);}
   // Bound synchronous decoding work and its temporary output per push.
   for(let offset=0;offset<chunk.length;offset+=4096)decoder.push(chunk.subarray(offset,offset+4096));
  },
  finish(){
   decoder.push(new Uint8Array(0),true);
   const trailer=new DataView(tail.buffer);
   if(packed<18||trailer.getUint32(0,true)!==((crc^0xffffffff)>>>0)||trailer.getUint32(4,true)!==(length>>>0))throw new Error('Invalid gzip model checksum or length');
  },
 };
}
/** Stream gzip directly into a reserved buffer, rejecting incorrect metadata
 * before any out-of-bounds write. Never retain/join all transport chunks. */
export async function downloadModel(asset:ModelDownload,signal:AbortSignal){
 if(!Number.isSafeInteger(asset.bytes)||asset.bytes<1||!Number.isSafeInteger(asset.decodedBytes)||asset.decodedBytes<1)throw new Error('Invalid model byte lengths');
 signal.throwIfAborted();
 const start=performance.now(),buffer=new ArrayBuffer(asset.decodedBytes),target=new Uint8Array(buffer);
 let bytes=0,offset=0;
 const counted=fetchAssetParts(asset.parts,signal).pipeThrough(new TransformStream<Uint8Array<ArrayBuffer>,Uint8Array<ArrayBuffer>>({transform(chunk,controller){
  bytes+=chunk.byteLength;if(bytes>asset.bytes)throw new Error('Compressed model length mismatch');controller.enqueue(chunk);
 }}));
 const native=typeof DecompressionStream!=='undefined';
 const reader=(native?counted.pipeThrough(new DecompressionStream('gzip')):counted).getReader();
 const append=(chunk:Uint8Array)=>{
  if(offset+chunk.byteLength>target.byteLength)throw new Error('Decoded model length mismatch');
  target.set(chunk,offset);offset+=chunk.byteLength;
 };
 const decoder=native?null:localGzipDecoder(append);
 const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
 signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){
   signal.throwIfAborted();const result=await reader.read();signal.throwIfAborted();
   if(result.done)break;
   if(decoder)decoder.push(result.value);else append(result.value);
  }
  decoder?.finish();
  if(bytes!==asset.bytes)throw new Error('Compressed model length mismatch');
  if(offset!==asset.decodedBytes)throw new Error('Decoded model length mismatch');
  return {buffer,bytes,downloadMs:performance.now()-start};
 }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
