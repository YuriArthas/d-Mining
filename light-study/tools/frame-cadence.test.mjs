import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameCadence,summarizeIntervals} from '../src/frameCadence.ts';
test('render FPS is measured from submissions and retains slow frame intervals',()=>{
 const s=summarizeIntervals([10,10,10,70]);assert.equal(s.fps,40);assert.equal(s.intervalMs.median,10);assert.equal(s.intervalMs.p95,70);
});
test('hidden/idle reset excludes the gap and resumes a fresh rolling window',()=>{
 const c=new FrameCadence();c.add(0);c.add(10);assert.equal(c.snapshot().fps,100);c.reset();c.add(10000);assert.equal(c.snapshot().fps,null);c.add(10020);assert.equal(c.snapshot().fps,50);
});
