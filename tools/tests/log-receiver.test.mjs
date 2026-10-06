import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLogReceiver} from '../../server/logs/receiver.mjs';

const origin='https://w-sunjun-public.dev.clock-p.com';
const day=()=>new Date().toISOString().slice(0,10);
function batch(sessionId,seq=1){return {version:1,sessionId,events:[{seq,elapsedMs:5,type:'test.event',data:{seq}}]};}
async function fixture(t,options={}){
 const directory=await mkdtemp(join(tmpdir(),'mining-log-test-'));
 const receiver=createLogReceiver({directory,...options});await receiver.ready;
 await new Promise(resolve=>receiver.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{receiver.server.closeAllConnections();await new Promise(resolve=>receiver.server.close(resolve));await receiver.drain();await rm(directory,{recursive:true,force:true});});
 return {...receiver,directory,post:(body,headers={Origin:origin})=>fetch(`http://127.0.0.1:${receiver.server.address().port}/ingest`,{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)})};
}
test('parallel sessions and same-session batches persist complete records without loss',async t=>{
 const f=await fixture(t);
 const requests=Array.from({length:80},(_,i)=>f.post(batch('parallel-session-'+i%8,Math.floor(i/8)+1)));
 const responses=await Promise.all(requests);
 assert.ok(responses.every(r=>r.status===202));
 assert.equal(responses[0].headers.get('access-control-allow-origin'),origin);
 for(let i=0;i<8;i++){
  const records=(await readFile(join(f.directory,day(),`parallel-session-${i}.jsonl`),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(records.length,10);
  assert.deepEqual(records.map(r=>r.seq).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10]);
  assert.ok(records.every(r=>r.sessionId===`parallel-session-${i}`));
 }
 assert.equal(f.metrics.events,80);assert.equal(f.metrics.pendingBytes,0);
});
test('rejects malformed IDs, JSON, events, origins and oversized requests',async t=>{
 const f=await fixture(t);
 assert.equal((await f.post(batch('../../escape-me'))).status,400);
 assert.equal((await f.post('{')).status,400);
 assert.equal((await f.post({...batch('valid-session-0001'),events:[{seq:-1}]})).status,400);
 assert.equal((await f.post(batch('valid-session-0001'),{Origin:'https://bad.example'})).status,403);
 assert.equal((await f.post('x'.repeat(65537))).status,413);
 assert.equal((await f.post({...batch('valid-session-0001'),events:Array(41).fill(batch('valid-session-0001').events[0])})).status,400);
 assert.equal(f.metrics.events,0);
});
test('failed file append does not poison the session write queue',async t=>{
 const f=await fixture(t);const file=join(f.directory,day(),'recover-session-01.jsonl');
 await mkdir(file,{recursive:true});
 assert.equal((await f.post(batch('recover-session-01'))).status,503);
 await rm(file,{recursive:true});
 assert.equal((await f.post(batch('recover-session-01',2))).status,202);
 assert.equal(JSON.parse((await readFile(file,'utf8')).trim()).seq,2);
 assert.equal(f.metrics.pendingBytes,0);
});
test('daily limit accounts for existing logs after restart',async t=>{
 const f=await fixture(t,{maxDailyBytes:1000});
 await mkdir(join(f.directory,day()),{recursive:true});await writeFile(join(f.directory,day(),'previous.jsonl'),'x'.repeat(999));
 assert.equal((await f.post(batch('quota-session-0001'))).status,429);
 assert.equal(f.metrics.events,0);
});
