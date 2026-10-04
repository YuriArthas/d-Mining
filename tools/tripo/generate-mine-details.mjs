import {spawn} from 'node:child_process';
import {existsSync,writeFileSync} from 'node:fs';
const names=['mine-badge','mine-pendant'],deadline=Date.now()+10*60_000;
while(names.some(n=>!existsSync(`output/imagegen/mine-material-light/${n}.png`))){if(Date.now()>deadline)throw Error('Missing references');await new Promise(r=>setTimeout(r,1000));}
const results=await Promise.all(names.map(name=>new Promise(resolve=>{
 const child=spawn(process.execPath,['tools/tripo/generate-quarry-v2.mjs',name],{env:process.env});let log='';
 for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);writeFileSync(`artifacts/mine-material-light/${name}.log`,log);});
 child.on('close',code=>resolve({name,code}));
})));
console.log(JSON.stringify(results));if(results.some(r=>r.code!==0))process.exitCode=1;
