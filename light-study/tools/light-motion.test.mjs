import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LightMotion,MOTION_PERIOD} from '../src/lightMotion.ts';
test('same elapsed time follows the same route regardless of frame rate, including turnaround',()=>{
 const a=new LightMotion(),b=new LightMotion();a.setMode('moving');b.setMode('moving');a.tick(0);b.tick(0);
 for(let i=1;i<=960;i++)a.tick(i*1000/60);for(let i=1;i<=480;i++)b.tick(i*1000/30);
 assert.ok(Math.abs(a.seconds-b.seconds)<1e-10);assert.ok(Math.abs(a.pose()[2]+13)<1e-9);
 a.seek(MOTION_PERIOD);assert.ok(Math.abs(a.pose()[2]-7)<1e-9);
});
test('pause, hidden-page clock reset and resume preserve the exact position',()=>{
 const m=new LightMotion();m.setMode('moving');m.tick(0);m.tick(1000);const pose=m.pose();
 m.setMode('paused');m.tick(60000);assert.deepEqual(m.pose(),pose);
 m.setMode('moving');m.tick(120000);assert.deepEqual(m.pose(),pose);m.tick(121000);assert.equal(m.seconds,2);
 m.resetClock();m.tick(999999);assert.equal(m.seconds,2);
});
