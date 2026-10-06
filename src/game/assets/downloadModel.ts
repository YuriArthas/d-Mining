import {fetchAssetParts} from './fetchAssetParts.ts';
export interface ModelDownload {parts:readonly string[];bytes:number;decodedBytes:number}
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
 const reader=counted.pipeThrough(new DecompressionStream('gzip')).getReader();
 const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
 signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){
   signal.throwIfAborted();const result=await reader.read();signal.throwIfAborted();
   if(result.done)break;
   if(offset+result.value.byteLength>target.byteLength)throw new Error('Decoded model length mismatch');
   target.set(result.value,offset);offset+=result.value.byteLength;
  }
  if(bytes!==asset.bytes)throw new Error('Compressed model length mismatch');
  if(offset!==asset.decodedBytes)throw new Error('Decoded model length mismatch');
  return {buffer,bytes,downloadMs:performance.now()-start};
 }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
