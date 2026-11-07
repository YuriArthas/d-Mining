import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarizeFrame} from '../src/gpuTiming.ts';

function summarize(intervals,base=0n){
  return summarizeFrame(intervals.map((_,i)=>({label:`pass ${i}`,samples:1,offset:i*2})),
    new BigUint64Array(intervals.flat().map(ms=>base+BigInt(ms)*1000000n)));
}
test('overlapping GPU stages are not summed into elapsed frame time',()=>{
  const result=summarize([[0,7],[2,9],[8,10]],90071992547409930n);
  assert.equal(result.frameMs,10);assert.equal(result.passSumMs,16);assert.equal(result.overlapMs,6);
  assert.deepEqual(result.passes.map(p=>[p.startMs,p.endMs,p.ms]),[[0,7,7],[2,9,7],[8,10,2]]);
});
test('idle gaps count toward frame span but not overlap',()=>{
  const result=summarize([[1,2],[3,4],[8,11]]);
  assert.equal(result.frameMs,10);assert.equal(result.passSumMs,5);assert.equal(result.overlapMs,0);
});
test('nested and out-of-order intervals preserve pass labels',()=>{
  const result=summarize([[8,10],[1,12],[4,6],[1,2]]);
  assert.equal(result.frameMs,11);assert.equal(result.passSumMs,16);assert.equal(result.overlapMs,5);
  assert.deepEqual(result.passes.map(p=>p.label),['pass 0','pass 1','pass 2','pass 3']);
});
test('zero-length timestamps and back-to-back passes are valid',()=>{
  const result=summarize([[0,0],[0,2],[2,3]]);
  assert.equal(result.frameMs,3);assert.equal(result.passSumMs,3);assert.equal(result.overlapMs,0);
});
test('missing or backward timestamps are explicit errors',()=>{
  assert.throws(()=>summarize([]),/no timestamp records/);
  assert.throws(()=>summarize([[2,1]]),/Invalid GPU timestamps/);
  assert.throws(()=>summarizeFrame([{label:'missing',samples:1,offset:2}],new BigUint64Array(2)),/Invalid GPU timestamps/);
});
