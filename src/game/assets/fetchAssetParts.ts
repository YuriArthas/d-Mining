// Bounded transport chunks, read in order with stream backpressure. No joining
// large ArrayBuffers or retaining all compressed downloads before decompression.
export function fetchAssetParts(urls:readonly string[],signal:AbortSignal):ReadableStream<Uint8Array>{
 let index=0,reader:ReadableStreamDefaultReader<Uint8Array>|null=null,cancelled=false;
 return new ReadableStream<Uint8Array>({
  async pull(controller){
   try{
    while(!cancelled){
     signal.throwIfAborted();
     if(!reader){
      if(index===urls.length){controller.close();return;}
      const url=urls[index++],response=await fetch(url,{signal});
      if(!response.ok||!response.body)throw new Error(`模型资源下载失败 HTTP ${response.status}: ${url}`);
      if(cancelled){await response.body.cancel();return;}
      reader=response.body.getReader();
     }
     const current=reader,result=await current.read();
     if(cancelled)return;
     if(result.done){current.releaseLock();reader=null;continue;}
     controller.enqueue(result.value);return;
    }
   }catch(error){await reader?.cancel(error).catch(()=>{});reader=null;if(!cancelled)controller.error(error);}
  },
  async cancel(reason){cancelled=true;await reader?.cancel(reason);reader=null;},
 });
}
