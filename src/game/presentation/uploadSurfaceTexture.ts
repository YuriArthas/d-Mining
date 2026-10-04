import type { Texture, WebGLRenderer } from 'three';

// Avoid a first-frame burst of all model texture uploads. Yield while one upload
// completes; no CPU wait, no simultaneous staging of every scene texture.
export async function uploadSurfaceTexture(renderer:WebGLRenderer,texture:Texture,signal:AbortSignal){
 signal.throwIfAborted();
 const gl=renderer.getContext() as WebGL2RenderingContext;
 if(gl.isContextLost())throw new Error('纹理上传时 WebGL 上下文丢失');
 renderer.initTexture(texture);
 const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!fence)throw new Error('无法创建纹理上传同步点');
 gl.flush();const began=performance.now();
 try{
  while(true){
   signal.throwIfAborted();
   if(gl.isContextLost())throw new Error('纹理上传时 WebGL 上下文丢失');
   const state=gl.clientWaitSync(fence,0,0);
   if(state===gl.WAIT_FAILED)throw new Error('纹理上传同步失败');
   if(state!==gl.TIMEOUT_EXPIRED)return;
   if(performance.now()-began>30000)throw new Error('纹理上传超过 30 秒未完成');
   await new Promise(resolve=>setTimeout(resolve,8));
  }
 }finally{gl.deleteSync(fence);}
}
