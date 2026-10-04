import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {surfaceHub} from './surface-hub.mjs';
// Use the existing local Tripo profile; never write its credential to artifacts.
const c=JSON.parse(readFileSync('/root/.tripo/config.json','utf8'));
const profile=c.profiles[c.active_profile];
const key=process.env.TRIPO_API_KEY??profile.api_key;
if(!key)throw Error('Tripo credential unavailable');
const response=await fetch('https://api.tripo3d.com/v2/openapi/user/balance',{headers:{authorization:`Bearer ${key}`}});
const balance=await response.json();console.log('Tripo balance',JSON.stringify(balance));
if(!response.ok)throw Error('Tripo balance unavailable');
const queue=process.argv.slice(2).length?process.argv.slice(2):['portal-timber','portal-fungal','portal-crystal','portal-frozen','portal-volcanic','portal-fossil','portal-core','egg-meadow'],results=[];
async function worker(){
 while(queue.length){const name=queue.shift();const result=await new Promise(resolve=>{
  const child=spawn(process.execPath,['tools/tripo/generate-quarry-v2.mjs',name],{env:{...process.env,TRIPO_API_KEY:key}});let log='';
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;writeFileSync(`artifacts/surface-hub/${name}.log`,log);});
  child.on('close',code=>resolve({name,code}));
 });results.push(result);console.log(JSON.stringify(result));}
}
await Promise.all([worker(),worker(),worker()]);
writeFileSync('artifacts/surface-hub/generation.json',JSON.stringify(results,null,2));
if(results.some(r=>r.code!==0))process.exitCode=1;
