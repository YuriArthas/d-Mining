/** Bounded completed-order prefetch. Reservations include downloads, ready items
 * and consumer leases. Parsing/uploading a lease cannot grow the ready queue
 * beyond the same budget. This does not bound the final resident scene. */
export class AssetPrefetch<I, O> {
 readonly stats = {maxDownloads:0,maxReservedBytes:0,maxResidentItems:0,maxReadyItems:0,completed:0};
 private controller = new AbortController();
 private jobs = new Set<Promise<void>>();
 private ready: {item:I; value:O; release:()=>void}[] = [];
 private next = 0;
 private downloads = 0;
 private reserved = 0;
 private resident = 0;
 private stopped = false;
 private failure: unknown;
 private wake?: ()=>void;
 private parent: AbortSignal;
 private items:readonly I[];
 private size:(item:I)=>number;
 private load:(item:I,signal:AbortSignal)=>Promise<O>;
 readonly limits:{downloads:number;bytes:number;items:number};
 private onAbort = () => this.stop(this.parent.reason ?? new Error('Asset loading aborted'));
 constructor(
  items:readonly I[],
  size:(item:I)=>number,
  load:(item:I,signal:AbortSignal)=>Promise<O>,
  signal:AbortSignal,
  limits = {downloads:4,bytes:4*1024*1024,items:8},
 ) {
  this.items=items;this.size=size;this.load=load;this.limits=limits;
  for(const n of Object.values(limits))if(!Number.isSafeInteger(n)||n<1)throw new Error('Invalid prefetch limits');
  for(const item of items){const n=size(item);if(!Number.isSafeInteger(n)||n<1||n>limits.bytes)throw new Error('Asset exceeds prefetch byte budget');}
  this.parent=signal;
  signal.addEventListener('abort',this.onAbort,{once:true});
  if(signal.aborted)this.onAbort();else this.pump();
 }
 private notify(){this.wake?.();this.wake=undefined;}
 private stop(reason:unknown){
  if(this.stopped)return;
  this.stopped=true;this.failure=reason;this.controller.abort(reason);
  for(const entry of this.ready)entry.release();
  this.ready=[];this.notify();
 }
 private pump(){
  while(!this.stopped&&this.next<this.items.length&&this.downloads<this.limits.downloads&&this.resident<this.limits.items){
   const item=this.items[this.next],bytes=this.size(item);
   if(this.reserved+bytes>this.limits.bytes)break;
   this.next++;this.downloads++;this.reserved+=bytes;this.resident++;
   this.stats.maxDownloads=Math.max(this.stats.maxDownloads,this.downloads);
   this.stats.maxReservedBytes=Math.max(this.stats.maxReservedBytes,this.reserved);
   this.stats.maxResidentItems=Math.max(this.stats.maxResidentItems,this.resident);
   let released=false;
   const release=()=>{if(released)return;released=true;this.reserved-=bytes;this.resident--;this.pump();};
   // Defer load so even a synchronous throw follows the same rejection path.
   const job=Promise.resolve().then(()=>{this.controller.signal.throwIfAborted();return this.load(item,this.controller.signal);}).then(value=>{
    if(this.stopped){release();return;}
    this.ready.push({item,value,release});this.stats.completed++;
    this.stats.maxReadyItems=Math.max(this.stats.maxReadyItems,this.ready.length);this.notify();
   }).catch(error=>{this.stop(error);release();}).finally(()=>{
    this.downloads--;this.jobs.delete(job);this.pump();this.notify();
   });
   this.jobs.add(job);
  }
 }
 /** One consumer; release only after parsing/uploading has finished. */
 async take():Promise<{item:I;value:O;release:()=>void}|null>{
  for(;;){
   if(this.stopped)throw this.failure;
   const entry=this.ready.shift();if(entry)return entry;
   if(this.next===this.items.length&&this.downloads===0)return null;
   await new Promise<void>(resolve=>{this.wake=resolve;});
  }
 }
 async close(){
  this.parent.removeEventListener('abort',this.onAbort);
  this.stop(new Error('Asset prefetch closed'));
  await Promise.all(this.jobs);
 }
}
