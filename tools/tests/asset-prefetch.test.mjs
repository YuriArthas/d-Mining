import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetPrefetch} from '../../src/game/assets/AssetPrefetch.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('four downloads, completion order, and byte budget includes the consumer lease',async()=>{
 const pending=Array.from({length:8},deferred),started=[];
 const pool=new AssetPrefetch([0,1,2,3,4,5,6,7],()=>1,async i=>{started.push(i);return pending[i].promise;},new AbortController().signal,{downloads:4,bytes:4,items:8});
 try{
  await tick();assert.deepEqual(started,[0,1,2,3]);
  pending[2].resolve('fast');const fast=await pool.take();assert.equal(fast.item,2);assert.equal(fast.value,'fast');
  await tick();assert.equal(started.length,4,'lease retains reservation');
  fast.release();await tick();assert.deepEqual(started,[0,1,2,3,4]);
  fast.release();await tick();assert.equal(started.length,5,'release is idempotent');
  for(const p of pending)p.resolve('done');
  const order=[];for(;;){const item=await pool.take();if(!item)break;order.push(item.item);item.release();}
  assert.deepEqual(order.sort(),[0,1,3,4,5,6,7]);
  assert.equal(pool.stats.maxDownloads,4);assert.equal(pool.stats.maxReservedBytes,4);assert.equal(pool.stats.completed,8);
 }finally{for(const p of pending)p.resolve();await pool.close();}
});
test('tiny assets stop at item limit when consumer is paused',async()=>{
 const started=[];const pool=new AssetPrefetch(Array.from({length:40},(_,i)=>i),()=>1,async i=>{started.push(i);return i;},new AbortController().signal,{downloads:4,bytes:100,items:8});
 try{await tick();assert.equal(started.length,8);assert.equal(pool.stats.maxResidentItems,8);const a=await pool.take();await tick();assert.equal(started.length,8);a.release();await tick();assert.equal(started.length,9);}finally{await pool.close();}
});
test('download failure wakes consumer and cancels other downloads',async()=>{
 const failure=new Error('network broke'),gate=deferred(),aborted=[];
 const pool=new AssetPrefetch([0,1,2,3],()=>1,(i,signal)=>i===0?gate.promise:new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted.push(i);reject(signal.reason);},{once:true})),new AbortController().signal);
 const waiting=pool.take();await tick();gate.reject(failure);await assert.rejects(waiting,failure);await pool.close();assert.deepEqual(aborted.sort(),[1,2,3]);
});
test('parent cancellation aborts jobs and pending take; close waits for cleanup',async()=>{
 const parent=new AbortController();let cleaned=0;
 const pool=new AssetPrefetch([1,2],()=>1,(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{setImmediate(()=>{cleaned++;reject(signal.reason);});},{once:true})),parent.signal);
 const waiting=pool.take();await tick();parent.abort(new Error('leave game'));await assert.rejects(waiting,/leave game/);await pool.close();assert.equal(cleaned,2);
});
test('rejects invalid or oversized reservations before downloading',()=>{
 for(const size of [0,-1,NaN,1.2,5])assert.throws(()=>new AssetPrefetch([1],()=>size,()=>{throw Error('must not run');},new AbortController().signal,{downloads:4,bytes:4,items:8}),/budget/);
});
test('empty and already aborted pools settle without starting work',async()=>{
 const empty=new AssetPrefetch([],()=>1,async()=>0,new AbortController().signal);assert.equal(await empty.take(),null);await empty.close();
 const parent=new AbortController();parent.abort(new Error('cancelled'));const stopped=new AssetPrefetch([1],()=>1,async()=>{assert.fail('started');},parent.signal);await assert.rejects(stopped.take(),/cancelled/);await stopped.close();
});
