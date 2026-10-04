import {spawn} from 'node:child_process';
import {existsSync,writeFileSync,mkdirSync} from 'node:fs';
const names=process.argv.length>2?process.argv.slice(2):['grid-mine-timber-v2','grid-mine-trim-v2','grid-mine-roof-v2'];
const deadline=Date.now()+10*60_000;
while(names.some(name=>!existsSync(`output/imagegen/grid-mine/${name}.png`))){
 if(Date.now()>deadline)throw Error('Missing reference images');
 await new Promise(resolve=>setTimeout(resolve,1000));
}
mkdirSync('artifacts/grid-mine',{recursive:true});
const results=await Promise.all(names.map(name=>new Promise(resolve=>{
 const child=spawn(process.execPath,['tools/tripo/generate-quarry-v2.mjs',name],{env:process.env});let log='';
 for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);writeFileSync(`artifacts/grid-mine/${name}.log`,log);});
 child.on('close',code=>resolve({name,code}));
})));
console.log(JSON.stringify(results));if(results.some(r=>r.code!==0))process.exitCode=1;
