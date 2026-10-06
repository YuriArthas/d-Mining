import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {downloadModel} from '../../src/game/assets/downloadModel.ts';
const source=Buffer.from('bounded streamed model '.repeat(2000)),gzip=gzipSync(source);
const asset={parts:['a'],bytes:gzip.length,decodedBytes:source.length};
test('streamed decompression yields exact preallocated bytes',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(gzip));
 const result=await downloadModel(asset,new AbortController().signal);assert.deepEqual(Buffer.from(result.buffer),source);assert.equal(result.bytes,gzip.length);
});
test('rejects either compressed or decompressed size mismatch',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(gzip));
 for(const key of ['bytes','decodedBytes'])for(const delta of [-1,1])await assert.rejects(downloadModel({...asset,[key]:asset[key]+delta},new AbortController().signal),/length mismatch/);
});
test('bad gzip and HTTP errors propagate',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(gzip.length)));
 await assert.rejects(downloadModel(asset,new AbortController().signal));mock.mock.mockImplementation(async()=>new Response(null,{status:503}));await assert.rejects(downloadModel(asset,new AbortController().signal),/503/);
});
test('abort during response cancels stream and rejects',async t=>{
 let cancelled=false,open;const ready=new Promise(resolve=>open=resolve);
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(gzip.subarray(0,15));open();},cancel(){cancelled=true;}})));
 const parent=new AbortController(),task=downloadModel(asset,parent.signal);await ready;parent.abort(new Error('stop load'));await assert.rejects(task,/stop load/);await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);
});
test('all shipped manifests reserve the actual gunzip size and fit queue budget',()=>{
 const dir=new URL('../../src/game/assets/camp/',import.meta.url);let count=0;
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.manifest.json'))){const m=JSON.parse(readFileSync(new URL(name,dir))),packed=Buffer.concat(m.parts.map(p=>readFileSync(new URL(p,dir))));assert.equal(packed.length,m.bytes,name);assert.equal(createHash('sha256').update(packed).digest('hex'),m.sha256,name);assert.equal(gunzipSync(packed).length,m.decodedBytes,name);assert.ok(m.decodedBytes<=4*1024*1024,name);count++;}
 assert.ok(count>=77);
});
