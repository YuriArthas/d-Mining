import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {expansion} from './camp-expansion.mjs';
await mkdir('artifacts/tripo-expansion',{recursive:true});
const names=Object.keys(expansion).filter((_,i)=>!process.argv.includes('--non-trees')||i>=8),queue=[...names],results=[];let stopped=false;
async function worker(){while(queue.length&&!stopped){const name=queue.shift();try{const r=JSON.parse(await readFile(`assets-source/quarry-v2/${name}/result.json`));if(r.status==='success'){results.push({name,status:'success',taskId:r.taskId});continue}}catch{}
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,['tools/tripo/generate-quarry-v2.mjs',name],{stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>{log+=b;process.stdout.write(b)});child.stderr.on('data',b=>{log+=b;process.stderr.write(b)});child.on('close',code=>resolve({code,log}));});
 await writeFile(`artifacts/tripo-expansion/${name}.log`,result.log);
 results.push({name,status:result.code===0?'success':'error'});
 if(result.code!==0&&/insufficient|balance.*(?:low|enough)|credit.*(?:enough|exhaust)|quota|failed \(402\)/i.test(result.log)){stopped=true;console.error('STOP: Tripo credit/quota error. No further submissions.');}
 await writeFile('artifacts/tripo-expansion/progress.json',JSON.stringify({total:names.length,results,unsubmitted:queue,stopped},null,2));
}}
await Promise.all(Array.from({length:8},worker));
console.log('EXPANSION_BATCH_COMPLETE',JSON.stringify({results,unsubmitted:queue,stopped}));
if(stopped||results.some(r=>r.status!=='success'))process.exitCode=1;
