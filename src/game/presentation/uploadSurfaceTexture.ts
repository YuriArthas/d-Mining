import type { Texture, WebGLRenderer } from 'three';
import {surfaceTextureMemory} from './surfaceTextureMemory.ts';

export const TEXTURE_UPLOAD_LIMITS={maxTextures:4,maxBytes:4*1024*1024} as const;
export function planTextureUploads(textures:Iterable<Texture>,limits:{maxTextures:number;maxBytes:number}=TEXTURE_UPLOAD_LIMITS){
 if(!Number.isInteger(limits.maxTextures)||limits.maxTextures<1||!Number.isFinite(limits.maxBytes)||limits.maxBytes<=0)throw new Error('无效的贴图上传预算');
 const batches:{textures:Texture[];bytes:number}[]=[];let batch={textures:[] as Texture[],bytes:0};
 for(const texture of new Set(textures)){
  const bytes=surfaceTextureMemory([texture]).encodedMipBytes;
  if(!Number.isFinite(bytes)||bytes<=0||bytes>limits.maxBytes)throw new Error('单张贴图超出上传预算，请检查资源尺寸');
  if(batch.textures.length&&(batch.textures.length>=limits.maxTextures||batch.bytes+bytes>limits.maxBytes)){batches.push(batch);batch={textures:[],bytes:0};}
  batch.textures.push(texture);batch.bytes+=bytes;
 }
 if(batch.textures.length)batches.push(batch);return batches;
}
export type TextureUploadStats={textures:number;batches:number;waitMs:number;maxBatchBytes:number};
// Only one bounded batch is in flight. Fence completion covers every texture in
// that batch; the next model still cannot decode until this model finishes.
export async function uploadSurfaceTextures(renderer:WebGLRenderer,textures:Iterable<Texture>,signal:AbortSignal):Promise<TextureUploadStats>{
 signal.throwIfAborted();
 const stats:TextureUploadStats={textures:0,batches:0,waitMs:0,maxBatchBytes:0};
 const gl=renderer.getContext() as WebGL2RenderingContext;
 for(const batch of planTextureUploads(textures)){
  signal.throwIfAborted();
  if(gl.isContextLost())throw new Error('纹理上传时 WebGL 上下文丢失');
  for(const texture of batch.textures){signal.throwIfAborted();renderer.initTexture(texture);}
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!fence)throw new Error('无法创建纹理上传同步点');
  const began=performance.now();
  try{
   gl.flush();
   while(true){
    signal.throwIfAborted();
    if(gl.isContextLost())throw new Error('纹理上传时 WebGL 上下文丢失');
    const state=gl.clientWaitSync(fence,0,0);
    if(state===gl.WAIT_FAILED)throw new Error('纹理上传同步失败');
    if(state!==gl.TIMEOUT_EXPIRED)break;
    if(performance.now()-began>30000)throw new Error('纹理上传超过 30 秒未完成');
    await new Promise(resolve=>setTimeout(resolve,8));
   }
  }finally{gl.deleteSync(fence);}
  stats.textures+=batch.textures.length;stats.batches++;stats.waitMs+=performance.now()-began;stats.maxBatchBytes=Math.max(stats.maxBatchBytes,batch.bytes);
 }
 return stats;
}
export async function uploadSurfaceTexture(renderer:WebGLRenderer,texture:Texture,signal:AbortSignal){await uploadSurfaceTextures(renderer,[texture],signal);}
