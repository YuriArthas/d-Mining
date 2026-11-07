import {InspectorBase,WebGPUBackend,type Scene,type Camera,type RenderTarget} from 'three/webgpu';
import {summarizeFrame,type FrameTiming} from './gpuTiming.ts';
import {CpuStageTimer} from './cpuTiming.ts';
export type {PassTiming} from './gpuTiming.ts';

// TS 7's DOM lib includes WebGPU interfaces but omits these native namespaces.
// Declarations only: the browser supplies the actual WebGPU constants.
declare const GPUBufferUsage:{readonly QUERY_RESOLVE:number;readonly COPY_SRC:number;readonly COPY_DST:number;readonly MAP_READ:number};
declare const GPUMapMode:{readonly READ:number};
// Verified in r186.1 WebGPUBackend; these hooks are absent from @types/three.
type PipelineHooks={createRenderPipeline(object:unknown,promises:Promise<unknown>[]|null):void;createProgram(program:unknown):void};
const pipelineHooks=WebGPUBackend.prototype as unknown as PipelineHooks;

/** r186 backend hook: collect only explicitly sampled frames, with our own pool.
 * Always clear timestampWrites on unsampled passes because Three reuses descriptors.
 * No changes to rendering commands, shaders or Three's installed source. */
export class StreetGPUBackend extends WebGPUBackend {
  frameProfiler:StreetProfiler|null=null;
  pipelineCreations=0;
  programCreations=0;
  createRenderPipeline(object:unknown,promises:Promise<unknown>[]|null){this.pipelineCreations++;return pipelineHooks.createRenderPipeline.call(this,object,promises);}
  createProgram(program:unknown){this.programCreations++;return pipelineHooks.createProgram.call(this,program);}
  initTimestampQuery(type:string,uid:string,descriptor:GPURenderPassDescriptor|GPUComputePassDescriptor){
    descriptor.timestampWrites=type==='render'?this.frameProfiler?.timestampWrites(uid):undefined;
  }
}

export class StreetProfiler extends InspectorBase {
  records:{uid:string;label:string;samples:number}[]=[];
  targets=new Map<RenderTarget,string>();
  readonly cpuTimer=new CpuStageTimer();
  readonly supported:boolean;
  private readonly capacity=512;
  private querySet:GPUQuerySet|null=null;
  private resolveBuffer:GPUBuffer|null=null;
  private readBuffer:GPUBuffer|null=null;
  private offsets=new Map<string,number>();
  private capturing=false;
  private count=0;
  private pending:Promise<FrameTiming>|null=null;

  constructor(private readonly device:GPUDevice,enabled=true){
    super();this.supported=enabled&&device.features.has('timestamp-query');
    if(this.supported){
      this.querySet=device.createQuerySet({label:'Street frame timestamps',type:'timestamp',count:this.capacity});
      this.resolveBuffer=device.createBuffer({label:'street-frame-resolve',size:this.capacity*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});
      this.readBuffer=device.createBuffer({label:'street-frame-times',size:this.capacity*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    }
  }
  override beginRender(uid:string,scene:Scene,_camera:Camera,target:RenderTarget){
    const texture=target?.texture?.name;
    const label=this.targets.get(target)??(scene.name==='Render Pipeline'?'Final composite':scene.name==='SSAO.Blur'?(texture==='SSAONode.AO'?'AO blur vertical':'AO blur horizontal'):({'SSAONode.AO':'Contact AO','GaussianBlurNode.horizontal':'Halo horizontal','GaussianBlurNode.vertical':'Halo vertical'}[texture]??(scene.name||texture||'Output')));
    // r186 makes fullscreen canvas quads single-sampled even if renderer.samples=4.
    const samples=target?.samples??((scene as Scene&{isQuadMesh?:boolean}).isQuadMesh?0:this.getRenderer().samples);
    this.cpuTimer.begin(uid,label,performance.now());
    if(this.capturing)this.records.push({uid,label,samples:Math.max(1,samples)});
  }
  override finishRender(uid:string){this.cpuTimer.end(uid,performance.now());}
  startFrame(capture:boolean){
    if(capture&&this.pending)throw Error('GPU frame readback is still pending');
    this.cpuTimer.reset();
    this.records=[];this.offsets.clear();this.count=0;this.capturing=capture&&this.supported;
  }
  timestampWrites(uid:string):GPURenderPassTimestampWrites|undefined{
    if(!this.capturing||!this.querySet)return undefined;
    if(this.count+2>this.capacity)throw Error('Street GPU timestamp capacity exceeded');
    const offset=this.count;this.count+=2;this.offsets.set(uid,offset);
    return {querySet:this.querySet,beginningOfPassWriteIndex:offset,endOfPassWriteIndex:offset+1};
  }
  resolve():Promise<FrameTiming>{
    this.capturing=false;
    if(this.pending||!this.querySet||!this.resolveBuffer||!this.readBuffer||this.count===0)throw Error('GPU frame cannot be resolved');
    // Snapshot before awaiting; subsequent unsampled frames may reset records.
    const records=this.records.map(r=>{
      const offset=this.offsets.get(r.uid);if(offset===undefined)throw Error(`Missing GPU timestamp: ${r.label}`);
      return {...r,offset};
    });
    if(records.length*2!==this.count)throw Error('GPU timestamp pass records are incomplete');
    const readBuffer=this.readBuffer,bytes=this.count*8;
    const encoder=this.device.createCommandEncoder({label:'Resolve one street frame'});
    encoder.resolveQuerySet(this.querySet,0,this.count,this.resolveBuffer,0);
    encoder.copyBufferToBuffer(this.resolveBuffer,0,readBuffer,0,bytes);
    this.device.queue.submit([encoder.finish()]);
    this.pending=(async()=>{
      await readBuffer.mapAsync(GPUMapMode.READ,0,bytes);
      try{return summarizeFrame(records,new BigUint64Array(readBuffer.getMappedRange(0,bytes)));}
      finally{readBuffer.unmap();}
    })().finally(()=>{this.pending=null;});
    return this.pending;
  }
  override dispose(){
    this.capturing=false;
    const destroy=()=>{this.querySet?.destroy();this.resolveBuffer?.destroy();this.readBuffer?.destroy();this.querySet=null;this.resolveBuffer=null;this.readBuffer=null;};
    if(this.pending)void this.pending.then(destroy,destroy);else destroy();
    super.dispose();
  }
}
