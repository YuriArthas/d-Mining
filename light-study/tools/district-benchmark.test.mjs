import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameBenchmarkCamera} from '../src/districtBenchmark.ts';
const pose={position:[50,47,55],target:[0,0,0]};
test('OrbitControls normalization roundoff does not invalidate an unchanged comparison',()=>{
 assert.equal(sameBenchmarkCamera(pose,{position:[49.99999999999999,47.00000000000001,55],target:[0,0,0]}),true);
});
test('actual camera/target changes and invalid coordinates invalidate the comparison',()=>{
 assert.equal(sameBenchmarkCamera(pose,{...pose,position:[50.001,47,55]}),false);
 assert.equal(sameBenchmarkCamera(pose,{...pose,target:[0,.0001,0]}),false);
 assert.equal(sameBenchmarkCamera(pose,{...pose,target:[NaN,0,0]}),false);
});
