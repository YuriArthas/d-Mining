import {createServer} from 'node:http';
import {appendFile,mkdir,readdir,rm,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const SESSION=/^[a-zA-Z0-9_-]{16,80}$/;
const MAX_BODY=64*1024,MAX_PENDING=8*1024*1024;
export function createLogReceiver({directory,origins=['https://w-sunjun-public.dev.clock-p.com'],retentionDays=7,maxDailyBytes=256*1024*1024}={}){
 if(!directory)throw Error('Log directory is required');
 const root=resolve(directory),writers=new Map(),usage=new Map();
 const metrics={requests:0,events:0,rejected:0,pendingBytes:0,writeErrors:0};
 const ready=mkdir(root,{recursive:true,mode:0o700});
 const allowed=new Set(origins);
 async function reserve(day,bytes){
  // Serialize accounting, including first-use disk scan after process restart.
  if(!usage.has(day)){
   const path=join(root,day);await mkdir(path,{recursive:true,mode:0o700});
   const files=await readdir(path);let size=0;
   for(const f of files)size+=(await stat(join(path,f))).size;
   usage.set(day,size);
  }
  if(usage.get(day)+bytes>maxDailyBytes)throw Object.assign(Error('Daily log limit reached'),{status:429});
  usage.set(day,usage.get(day)+bytes);
 }
 let accounting=Promise.resolve();
 function persist(day,session,lines){
  const bytes=Buffer.byteLength(lines);
  if(metrics.pendingBytes+bytes>MAX_PENDING)return Promise.reject(Object.assign(Error('Log receiver busy'),{status:503}));
  metrics.pendingBytes+=bytes;
  const accounted=accounting.then(()=>ready).then(()=>reserve(day,bytes));accounting=accounted.catch(()=>{});
  const key=day+'/'+session,prior=writers.get(key)??Promise.resolve();
  const task=Promise.all([accounted,prior.catch(()=>{})]).then(()=>appendFile(join(root,day,session+'.jsonl'),lines,{mode:0o600}));
  writers.set(key,task);
  return task.finally(()=>{metrics.pendingBytes-=bytes;if(writers.get(key)===task)writers.delete(key);});
 }
 function reject(response,status,message){metrics.rejected++;response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({error:message}));}
 const server=createServer(async(request,response)=>{
  const origin=request.headers.origin;
  if(origin&&!allowed.has(origin)){reject(response,403,'Origin not allowed');request.resume();return;}
  if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
  let path;
  try{path=new URL(request.url,'http://localhost').pathname;}
  catch{reject(response,400,'Invalid request URL');request.resume();return;}
  if(request.method==='OPTIONS'&&path==='/ingest'){
   response.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});response.end();return;
  }
  if(request.method==='GET'&&(path==='/healthz'||path==='/')){
   response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   response.end(JSON.stringify({service:'mining-log',status:'ok',...metrics}));return;
  }
  if(request.method!=='POST'||path!=='/ingest'){reject(response,404,'Not found');request.resume();return;}
  if(Number(request.headers['content-length']??0)>MAX_BODY){reject(response,413,'Batch too large');request.resume();return;}
  const chunks=[];let length=0;
  try{
   for await(const chunk of request){length+=chunk.length;if(length>MAX_BODY){reject(response,413,'Batch too large');request.resume();return;}chunks.push(chunk);}
   let batch;try{batch=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reject(response,400,'Invalid JSON');return;}
   if(!batch||batch.version!==1||!SESSION.test(batch.sessionId??'')||!Array.isArray(batch.events)||!batch.events.length||batch.events.length>40){reject(response,400,'Invalid batch');return;}
   const receivedAt=new Date().toISOString(),day=receivedAt.slice(0,10);
   const meta={sessionId:batch.sessionId,page:String(batch.page??'').slice(0,300),agent:String(batch.agent??'').slice(0,400),build:String(batch.build??'').slice(0,100)};
   const records=[];
   for(const e of batch.events){
    if(!e||!Number.isSafeInteger(e.seq)||e.seq<1||!Number.isFinite(e.elapsedMs)||typeof e.type!=='string'||e.type.length>80||JSON.stringify(e).length>5000){reject(response,400,'Invalid event');return;}
    records.push(JSON.stringify({...meta,receivedAt,clientTime:String(e.time??'').slice(0,40),seq:e.seq,elapsedMs:e.elapsedMs,type:e.type,data:e.data??null,dropped:Number(batch.dropped)||0}));
   }
   await persist(day,batch.sessionId,records.join('\n')+'\n');
   metrics.requests++;metrics.events+=records.length;
   response.writeHead(202,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({accepted:records.length}));
  }catch(error){
   if(!error.status){metrics.writeErrors++;console.error('Log write failed:',error.code??error.message);}
   if(!response.headersSent)reject(response,error.status??503,'Log receiver temporarily unavailable');else response.destroy();
  }
 });
 server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;server.maxConnections=256;
 async function cleanup(){
  await ready;const cutoff=new Date(Date.now()-retentionDays*86400000).toISOString().slice(0,10);
  for(const day of await readdir(root))if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<cutoff){await rm(join(root,day),{recursive:true,force:true});usage.delete(day);}
 }
 const timer=setInterval(()=>cleanup().catch(e=>console.error('Log retention:',e.message)),3600000);timer.unref();
 server.on('close',()=>clearInterval(timer));
 return {server,metrics,ready:ready.then(cleanup),drain:()=>Promise.allSettled([...writers.values()])};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const receiver=createLogReceiver({directory:process.env.MINING_LOG_DIR??'/var/lib/mining-log',origins:(process.env.MINING_LOG_ORIGINS??'https://w-sunjun-public.dev.clock-p.com').split(',')});
 await receiver.ready;
 receiver.server.listen(Number(process.env.PORT??4186),'127.0.0.1',()=>console.log('Mining log receiver listening on 127.0.0.1:'+receiver.server.address().port));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>receiver.server.close(async()=>{await receiver.drain();process.exit(0);}));
}
