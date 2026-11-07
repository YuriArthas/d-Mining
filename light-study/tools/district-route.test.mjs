import {test} from 'node:test';
import assert from 'node:assert/strict';
import {districtPose,DistrictTour,TOUR_PERIOD} from '../src/districtRoute.ts';
test('fixed tour stays on the connected roads and repeats without a pose jump',()=>{
  for(let t=0;t<TOUR_PERIOD;t+=.025){
    const {eye:[x,y,z],target}=districtPose(t);
    assert.equal(y,2.65);assert.ok(Math.abs(x)<=28&&Math.abs(z)<=28);
    assert.ok(Math.abs(x)<=3||Math.abs(z)<=3||Math.abs(x)>=22||Math.abs(z)>=22,`inside a block at ${t}: ${x},${z}`);
    assert.ok(Math.hypot(target[0]-x,target[2]-z)>1);
  }
  assert.deepEqual(districtPose(0),districtPose(TOUR_PERIOD));
  const a=districtPose(TOUR_PERIOD-.001).eye,b=districtPose(.001).eye;assert.ok(Math.hypot(a[0]-b[0],a[2]-b[2])<.02);
});
test('tour time is frame-rate independent, and pause/background gaps do not advance it',()=>{
  const a=new DistrictTour(),b=new DistrictTour();a.setRunning(true);b.setRunning(true);
  a.tick(0);for(let t=100;t<=2000;t+=100)a.tick(t);b.tick(0);b.tick(2000);
  assert.ok(Math.abs(a.seconds-b.seconds)<1e-10);
  a.resetClock();a.tick(60000);assert.ok(Math.abs(a.seconds-2)<1e-10);
  a.setRunning(false);a.tick(90000);assert.ok(Math.abs(a.seconds-2)<1e-10);
  a.seek(8);assert.equal(a.seconds,8);assert.throws(()=>a.seek(NaN));
});
