type FenceContext=Pick<WebGL2RenderingContext,'fenceSync'|'clientWaitSync'|'deleteSync'|'flush'|'isContextLost'|'SYNC_GPU_COMMANDS_COMPLETE'|'TIMEOUT_EXPIRED'|'WAIT_FAILED'>;

// Never block the JS thread waiting for the GPU. A slow GPU may delay display,
// but must not accumulate queued frames or stop input/terrain simulation.
export class RenderSubmission {
 private pending:WebGLSync|null=null;
 submitted=0;skipped=0;
 private readonly context:FenceContext;
 constructor(context:FenceContext){this.context=context;}
 draw(render:()=>void){
  const gl=this.context;
  if(gl.isContextLost()){this.dispose();this.skipped++;return false;}
  if(this.pending){
   const status=gl.clientWaitSync(this.pending,0,0);
   if(status===gl.TIMEOUT_EXPIRED){this.skipped++;return false;}
   gl.deleteSync(this.pending);this.pending=null;
   if(status===gl.WAIT_FAILED)throw new Error('GPU 绘制同步失败');
  }
  render();
  if(gl.isContextLost())return false;
  this.pending=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!this.pending)throw new Error('无法创建 GPU 绘制同步点');
  gl.flush();this.submitted++;return true;
 }
 snapshot(){return {submitted:this.submitted,skipped:this.skipped,inFlight:!!this.pending};}
 dispose(){if(this.pending){this.context.deleteSync(this.pending);this.pending=null;}}
}
