import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../../src/boot/telemetry.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot({config={},fetcher=async()=>({ok:true}),path='/games/mining-test/index.html'}={}){
 const calls=[],listeners={},nodes=Object.fromEntries(['boot-status','boot-detail','boot-session','boot-retry'].map(id=>[id,{}]));
 const window={__MINING_LOG_CONFIG__:config,crypto:webcrypto,addEventListener:(type,cb)=>listeners[type]=cb};
 const ctx={window,crypto:webcrypto,Uint8Array,Blob,AbortController,URL,console:{warn(){},error(){}},location:{pathname:path,origin:'https://w-sunjun-public.dev.clock-p.com'},navigator:{userAgent:'test-agent'},document:{documentElement:{getAttribute:()=> 'test-build'},getElementById:id=>nodes[id],addEventListener(){},visibilityState:'visible'},innerWidth:960,innerHeight:540,devicePixelRatio:1,setInterval(){},setTimeout:()=>0,clearTimeout(){},fetch:(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return fetcher();}};
 runInNewContext(source,ctx);return {log:window.__MINING_LOG__,calls,listeners,nodes};
}
test('each tab is independent; disabled and production entries send no requests',async()=>{
 const a=boot(),b=boot();assert.notEqual(a.log.sessionId,b.log.sessionId);
 assert.equal(a.calls[0].body.events[0].type,'boot.start');
 const off=boot({config:{enabled:false}}),production=boot({path:'/games/mining/index.html'});
 off.log.write('test');off.log.flush();assert.equal(off.calls.length,0);assert.equal(production.calls.length,0);
 const injected=boot({config:{endpoint:'https://logs.example/ingest'},path:'/another-game/'});
 assert.equal(injected.calls[0].url,'https://logs.example/ingest');await tick();
});
test('receiver failure stays nonblocking and queue is bounded',async()=>{
 const f=boot({fetcher:async()=>{throw Error('offline');}});await tick();
 for(let i=0;i<400;i++)f.log.write('test',i);
 assert.equal(f.log.diagnostics().queued,120);assert.ok(f.log.diagnostics().dropped>=280);
 f.log.ready();assert.equal(f.calls.length,1); // retry backoff, no storm
});
test('early script failure produces a visible error, retry and identifiable event',async()=>{
 const f=boot();await tick();
 f.listeners.error({target:{tagName:'SCRIPT',src:'https://example/main.js'}});await tick();
 assert.equal(f.nodes['boot-status'].textContent,'暂时没能进入矿场');assert.equal(f.nodes['boot-retry'].hidden,false);
 assert.equal(f.nodes['boot-session'].textContent,undefined);
 assert.ok(!f.nodes['boot-detail'].textContent.includes('main.js'));
 assert.ok(f.calls.flatMap(c=>c.body.events).some(e=>e.type==='boot.script-failed'));
});
test('multibyte and escape-heavy records fit the server batch limits',async()=>{
 const f=boot();await tick();
 for(let i=0;i<12;i++)f.log.write('payload','矿'.repeat(2400));
 f.log.flush();await tick();
 f.log.write('payload','\u0000'.repeat(2400));f.log.flush();await tick();
 for(const call of f.calls){
  assert.ok(Buffer.byteLength(JSON.stringify(call.body))<65536);
  assert.ok(call.body.events.every(e=>JSON.stringify(e).length<=5000));
 }
});
