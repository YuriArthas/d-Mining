import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {expansion} from './camp-expansion.mjs';
const pending=new Set(Object.keys(expansion));const deadline=Date.now()+60*60*1000;
while(pending.size&&Date.now()<deadline){
 for(const name of pending){let result;try{result=JSON.parse(await readFile(`assets-source/quarry-v2/${name}/result.json`));}catch{continue;}if(result.status!=='success')continue;
  try{const m=JSON.parse(await readFile(`src/game/assets/camp/${name}.manifest.json`));if(m.taskId===result.taskId){pending.delete(name);continue}}catch{}
  const code=await new Promise(resolve=>{const p=spawn(process.execPath,['tools/pack-camp.mjs',name],{stdio:'inherit'});p.on('close',resolve)});
  if(code!==0)throw new Error(`Packing failed: ${name}`);pending.delete(name);console.log('PACKED',name,'remaining',pending.size);
 }
 if(pending.size)await new Promise(r=>setTimeout(r,10000));
}
if(pending.size)throw Error(`Timed out waiting for generation: ${[...pending]}`);
console.log('ALL_EXPANSION_PACKED');
