import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {fetchAssetParts} from '../../src/game/assets/fetchAssetParts.ts';

test('bounded transport parts form one exact decompression stream',async t=>{
 const source=Buffer.from('streamed model payload '.repeat(1000)),packed=gzipSync(source),parts=[];
 for(let offset=0;offset<packed.length;offset+=7)parts.push(packed.subarray(offset,offset+7));
 const seen=[];t.mock.method(globalThis,'fetch',async url=>{seen.push(url);return new Response(parts[Number(url)])});
 const result=await new Response(fetchAssetParts(parts.map((_,i)=>String(i)),new AbortController().signal).pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 assert.deepEqual(Buffer.from(result),source);assert.deepEqual(seen,parts.map((_,i)=>String(i)));
});
test('failed part stops the stream instead of decoding a partial asset',async t=>{
 const seen=[];t.mock.method(globalThis,'fetch',async url=>{seen.push(url);return url==='bad'?new Response(null,{status:503}):new Response(new Uint8Array([1,2,3]))});
 await assert.rejects(new Response(fetchAssetParts(['first','bad','never'],new AbortController().signal)).arrayBuffer(),/503/);
 assert.deepEqual(seen,['first','bad']);
});
test('cancel does not request the remaining parts',async t=>{
 const seen=[];t.mock.method(globalThis,'fetch',async url=>{seen.push(url);return new Response(new Uint8Array([1,2,3]))});
 const reader=fetchAssetParts(['first','never'],new AbortController().signal).getReader();await reader.read();await reader.cancel();
 assert.deepEqual(seen,['first']);
});
