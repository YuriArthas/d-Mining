import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {downloadModel} from '../../src/game/assets/downloadModel.ts';
const source=Buffer.from('bounded streamed model '.repeat(2000)),gzip=gzipSync(source);
const asset={parts:['a'],bytes:gzip.length,decodedBytes:source.length};
for(const local of [false,true])test(`model download with ${local?'Safari 16.0 local':'native'} gzip decoder`,async t=>{
 if(local)t.mock.property(globalThis,'DecompressionStream',undefined);
 await t.test('streamed decompression yields exact preallocated bytes',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(gzip));
  const result=await downloadModel(asset,new AbortController().signal);assert.deepEqual(Buffer.from(result.buffer),source);assert.equal(result.bytes,gzip.length);
 });
 await t.test('gzip headers and trailers may cross transport boundaries',async t=>{
  for(const size of [1,7,16]){
   const parts=[];for(let i=0;i<gzip.length;i+=size)parts.push(gzip.subarray(i,i+size));
   const seen=[];
   const mock=t.mock.method(globalThis,'fetch',async url=>{seen.push(url);return new Response(parts[Number(url)]);});
   const result=await downloadModel({...asset,parts:parts.map((_,i)=>String(i))},new AbortController().signal);
   assert.deepEqual(Buffer.from(result.buffer),source);assert.equal(seen.length,parts.length);mock.mock.restore();
  }
 });
 await t.test('rejects either compressed or decompressed size mismatch',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(gzip));
  for(const key of ['bytes','decodedBytes'])for(const delta of [-1,1])await assert.rejects(downloadModel({...asset,[key]:asset[key]+delta},new AbortController().signal),/length mismatch/);
 });
 await t.test('bad gzip, corrupt checksums, truncation and HTTP errors propagate',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:503}));
  await assert.rejects(downloadModel(asset,new AbortController().signal),/503/);
  const crc=Buffer.from(gzip),size=Buffer.from(gzip);crc[crc.length-8]^=1;size[size.length-4]^=1;
  for(const data of [new Uint8Array(gzip.length),crc,size,gzip.subarray(0,-1),gzip.subarray(0,-8),gzip.subarray(0,15)]){
   mock.mock.mockImplementation(async()=>new Response(data));
   await assert.rejects(downloadModel({...asset,bytes:data.length},new AbortController().signal));
  }
 });
 await t.test('abort during response cancels stream and rejects',async t=>{
  let cancelled=false,open;const ready=new Promise(resolve=>open=resolve);
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(gzip.subarray(0,15));open();},cancel(){cancelled=true;}})));
  const parent=new AbortController(),task=downloadModel(asset,parent.signal);await ready;parent.abort(new Error('stop load'));await assert.rejects(task,/stop load/);await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);
 });
});
test('largest shipped scene decodes identically without DecompressionStream',async t=>{
 t.mock.property(globalThis,'DecompressionStream',undefined);
 const dir=new URL('../../src/game/assets/scene/',import.meta.url);
 const manifests=readdirSync(dir).filter(n=>n.endsWith('.manifest.json')).map(n=>JSON.parse(readFileSync(new URL(n,dir))));
 const largest=manifests.sort((a,b)=>b.decodedBytes-a.decodedBytes)[0];
 t.mock.method(globalThis,'fetch',async url=>new Response(readFileSync(new URL(url,dir))));
 const result=await downloadModel(largest,new AbortController().signal);
 const packed=Buffer.concat(largest.parts.map(p=>readFileSync(new URL(p,dir))));
 assert.deepEqual(Buffer.from(result.buffer),gunzipSync(packed));
});
test('all shipped manifests reserve the actual gunzip size and fit queue budget',()=>{
 const dir=new URL('../../src/game/assets/scene/',import.meta.url);let count=0;
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.manifest.json'))){const m=JSON.parse(readFileSync(new URL(name,dir))),packed=Buffer.concat(m.parts.map(p=>readFileSync(new URL(p,dir))));assert.equal(packed.length,m.bytes,name);assert.equal(createHash('sha256').update(packed).digest('hex'),m.sha256,name);assert.equal(gunzipSync(packed).length,m.decodedBytes,name);assert.ok(m.decodedBytes<=8*1024*1024,name);count++;}
 assert.ok(count>0);
});
