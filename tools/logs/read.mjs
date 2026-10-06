import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.env.MINING_LOG_DIR??'/var/lib/mining-log';
const session=process.argv[2],events=[];
for(const day of (await readdir(root)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-2)){
 for(const file of await readdir(join(root,day))){
  if(!file.endsWith('.jsonl')||(session&&file!==session+'.jsonl'))continue;
  for(const line of (await readFile(join(root,day,file),'utf8')).trim().split('\n'))if(line){try{events.push(JSON.parse(line));}catch{}}
 }
}
const unique=[...new Map(events.map(e=>[e.sessionId+':'+e.seq,e])).values()];
if(session){for(const e of unique.sort((a,b)=>a.seq-b.seq))console.log(JSON.stringify(e));}
else{
 const sessions=new Map();
 for(const e of unique.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.seq-b.seq)){
  const row=sessions.get(e.sessionId)??{sessionId:e.sessionId,first:e.receivedAt,page:e.page,agent:e.agent,events:0,errors:0};
  row.last=e.receivedAt;row.lastEvent=e.type;row.events++;if(/error|failed|rejection/.test(e.type))row.errors++;sessions.set(e.sessionId,row);
 }
 for(const row of [...sessions.values()].slice(-30))console.log(JSON.stringify(row));
}
