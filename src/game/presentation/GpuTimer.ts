type Pass='main'|'reflection';
type Part={query:WebGLQuery;pass:Pass};
type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};

// Async non-nested queries. Reflection splits main into two GPU segments so no
// CPU wait, gl.finish(), readPixels(), or overlapping TIME_ELAPSED query occurs.
export class GpuTimer {
 private readonly gl:WebGL2RenderingContext;
 private readonly ext:TimerExtension|null;
 private readonly enabled:boolean;
 private pending:Part[][]=[];
 private parts:Part[]|null=null;
 private active=false;
 private frame=0;
 private samples:{mainMs:number;reflectionMs:number}[]=[];
 private disjoint=false;
 constructor(gl:WebGL2RenderingContext,enabled=true){this.gl=gl;this.enabled=enabled;this.ext=enabled?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;}
 private clear(){
  if(this.active){this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);this.active=false;}
  for(const frame of [...this.pending,this.parts??[]])for(const part of frame)this.gl.deleteQuery(part.query);
  this.pending=[];this.parts=null;this.samples=[];
 }
 poll(){
  const gl=this.gl,ext=this.ext;if(!ext)return;
  if(gl.isContextLost()){this.clear();return;}
  this.disjoint=Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
  if(this.disjoint){this.clear();return;}
  while(this.pending.length){
   const parts=this.pending[0];
   if(!gl.getQueryParameter(parts[parts.length-1].query,gl.QUERY_RESULT_AVAILABLE))break;
   const sample={mainMs:0,reflectionMs:0};
   for(const part of parts){sample[part.pass==='main'?'mainMs':'reflectionMs']+=Number(gl.getQueryParameter(part.query,gl.QUERY_RESULT))/1e6;gl.deleteQuery(part.query);}
   this.pending.shift();this.samples.push(sample);if(this.samples.length>20)this.samples.shift();
  }
 }
 beginFrame(){
  this.poll();
  if(!this.ext||this.disjoint||this.gl.isContextLost()||this.frame++%4!==0||this.pending.length>=8)return;
  this.parts=[];this.segment('main');
 }
 segment(pass:Pass){
  if(!this.parts||!this.ext)return;
  if(this.active){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.active=false;}
  const query=this.gl.createQuery();if(!query)return;
  this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);this.parts.push({query,pass});this.active=true;
 }
 endFrame(){
  if(!this.parts)return;
  if(this.active){this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);this.active=false;}
  if(this.parts.length)this.pending.push(this.parts);this.parts=null;
 }
 snapshot(){
  const count=this.samples.length,mainMs=count?this.samples.reduce((n,s)=>n+s.mainMs,0)/count:null;
  const reflectionMs=count?this.samples.reduce((n,s)=>n+s.reflectionMs,0)/count:null;
  return {enabled:this.enabled,supported:!!this.ext,disjoint:this.disjoint,samples:count,pending:this.pending.length,mainMs,reflectionMs,totalMs:mainMs===null||reflectionMs===null?null:mainMs+reflectionMs};
 }
 dispose(){this.clear();}
}
