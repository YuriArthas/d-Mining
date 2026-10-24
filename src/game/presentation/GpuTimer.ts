type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};

// Async non-nested queries, one per sampled frame: no CPU wait, gl.finish() or readPixels().
export class GpuTimer {
 private readonly gl:WebGL2RenderingContext;
 private readonly ext:TimerExtension|null;
 private readonly enabled:boolean;
 private pending:WebGLQuery[]=[];
 private query:WebGLQuery|null=null;
 private frame=0;
 private samples:number[]=[];
 private disjoint=false;
 constructor(gl:WebGL2RenderingContext,enabled=true){this.gl=gl;this.enabled=enabled;this.ext=enabled?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;}
 private clear(){
  if(this.query){this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.query);this.query=null;}
  for(const query of this.pending)this.gl.deleteQuery(query);
  this.pending=[];this.samples=[];
 }
 poll(){
  const gl=this.gl,ext=this.ext;if(!ext)return;
  if(gl.isContextLost()){this.clear();return;}
  this.disjoint=Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
  if(this.disjoint){this.clear();return;}
  while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){
   const query=this.pending.shift()!;
   this.samples.push(Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6);gl.deleteQuery(query);
   if(this.samples.length>20)this.samples.shift();
  }
 }
 beginFrame(){
  this.poll();
  if(!this.ext||this.disjoint||this.gl.isContextLost()||this.frame++%4!==0||this.pending.length>=8)return;
  const query=this.gl.createQuery();if(!query)return;
  this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);this.query=query;
 }
 endFrame(){
  if(!this.query)return;
  this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);this.pending.push(this.query);this.query=null;
 }
 snapshot(){
  const count=this.samples.length,mainMs=count?this.samples.reduce((n,s)=>n+s,0)/count:null;
  return {enabled:this.enabled,supported:!!this.ext,disjoint:this.disjoint,samples:count,pending:this.pending.length,mainMs};
 }
 dispose(){this.clear();}
}
