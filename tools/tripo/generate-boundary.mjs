import {boundary as worksite} from './timber-boundary.mjs';
import {access,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const queue=Object.keys(worksite),results=[];let stop=false;
const run=(args)=>new Promise(resolve=>{const p=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',b=>{log+=b;process.stdout.write(b)});p.stderr.on('data',b=>{log+=b;process.stderr.write(b)});p.on('close',code=>resolve({code,log}))});
async function worker(){while(queue.length&&!stop){const name=queue.shift(),until=Date.now()+10*60*1000;
 while(true){try{await access(worksite[name].image);break}catch{if(Date.now()>until)throw Error('Reference missing '+name);await new Promise(r=>setTimeout(r,3000));}}
 let done=false;try{done=JSON.parse(await readFile(`assets-source/quarry-v2/${name}/result.json`)).status==='success'}catch{}
 const r=done?{code:0,log:'Previously completed'}:await run(['tools/tripo/generate-quarry-v2.mjs',name]);
 await writeFile(`artifacts/timber-boundary/${name}.log`,r.log);
 if(r.code!==0&&/insufficient|credit.*(?:enough|exhaust)|balance.*low|failed \(402\)/i.test(r.log)){stop=true;console.error('CREDIT EXHAUSTED');}
 if(r.code===0){const packed=await run(['tools/pack-camp.mjs',name]);if(packed.code!==0)throw Error('Packing failed '+name)}
 results.push({name,success:r.code===0});await writeFile('artifacts/timber-boundary/progress.json',JSON.stringify({results,remaining:queue,stopped:stop},null,2));
}}
await Promise.all(Array.from({length:4},worker));console.log('BOUNDARY_DONE',JSON.stringify(results));if(stop||results.some(r=>!r.success))process.exitCode=1;
