import {readFile,rename,mkdir,access,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {expansion} from './camp-expansion.mjs';
const queue=Object.keys(expansion).slice(0,8);
const run=args=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit'});p.on('close',c=>c===0?resolve():reject(Error(`Exit ${c}: ${args}`)))});
async function worker(){while(queue.length){const name=queue.shift(),base=`assets-source/quarry-v2/${name}`,deadline=Date.now()+30*60*1000;let result;
 while(true){if(Date.now()>deadline)throw Error(`Tree replacement waiting timed out ${name}`);try{result=JSON.parse(await readFile(`${base}/runtime.json`));await access(expansion[name].image);break}catch{await new Promise(r=>setTimeout(r,5000))}}
 if(JSON.parse(await readFile(`${base}/task.json`)).type==='image_to_model'){console.log('Already regenerated',name);continue}
 await mkdir('assets-source/quarry-v2-rejected',{recursive:true});
 await rename(base,`assets-source/quarry-v2-rejected/${name}-${result.taskId}`);
 console.log('REPLACING_TREE',name,result.taskId);
 await run(['tools/tripo/generate-quarry-v2.mjs',name]);
 await run(['tools/pack-camp.mjs',name]);
 console.log('REPLACED_TREE',name);
}}
await Promise.all([worker(),worker()]);console.log('ALL_TREES_REGENERATED');
