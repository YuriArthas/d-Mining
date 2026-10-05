type FenceContext=Pick<WebGL2RenderingContext,'fenceSync'|'clientWaitSync'|'deleteSync'|'flush'|'isContextLost'|'SYNC_GPU_COMMANDS_COMPLETE'|'TIMEOUT_EXPIRED'|'WAIT_FAILED'>;

// Normal RAF lets the browser own presentation/backpressure. Optional bounded
// fences are retained for diagnosis, not polled synchronously in normal gameplay.
export class RenderSubmission {
 private pending:WebGLSync[]=[];
 submitted=0;skipped=0;
 private readonly context:FenceContext;
 private limit:number;
 private mode:'browser'|'fenced';
 waitCpuMs=0;
 constructor(context:FenceContext,maxInFlight=2,mode:'browser'|'fenced'='browser'){this.context=context;this.limit=this.validateLimit(maxInFlight);this.mode=mode;}
 private validateLimit(value:number){if(value!==1&&value!==2)throw new Error('GPU 队列只允许 1 或 2 帧');return value;}
 setMode(mode:'browser'|'fenced'){if(this.mode!==mode){this.dispose();this.mode=mode;}}
 setMaxInFlight(value:number){this.limit=this.validateLimit(value);}
 draw(render:()=>void){
  const gl=this.context;this.waitCpuMs=0;
  if(gl.isContextLost()){this.dispose();this.skipped++;return false;}
  if(this.mode==='browser'){render();if(gl.isContextLost())return false;this.submitted++;return true;}
  const waitStart=performance.now();
  while(this.pending.length){
   const status=gl.clientWaitSync(this.pending[0],0,0);
   if(status===gl.TIMEOUT_EXPIRED)break;
   gl.deleteSync(this.pending.shift()!);
   if(status===gl.WAIT_FAILED){this.dispose();throw new Error('GPU 绘制同步失败');}
  }
  this.waitCpuMs=performance.now()-waitStart;
  if(this.pending.length>=this.limit){this.skipped++;return false;}
  render();
  if(gl.isContextLost()){this.dispose();return false;}
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!fence)throw new Error('无法创建 GPU 绘制同步点');
  this.pending.push(fence);gl.flush();this.submitted++;return true;
 }
 snapshot(){return {mode:this.mode,waitCpuMs:this.waitCpuMs,submitted:this.submitted,skipped:this.skipped,inFlight:this.pending.length>0,queued:this.pending.length,maxInFlight:this.limit};}
 dispose(){for(const fence of this.pending)this.context.deleteSync(fence);this.pending=[];}
}
