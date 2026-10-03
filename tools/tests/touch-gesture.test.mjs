import assert from 'node:assert/strict';
import test from 'node:test';
import { TouchGesture } from '../../src/game/TouchGesture.ts';
import { GAME_CONFIG } from '../../src/game/config.ts';
const delay = GAME_CONFIG.input.mineHoldMs, threshold = GAME_CONFIG.input.lookThresholdPx;

test('short tap or cancellation never turns into a delayed mine', () => {
  const g = new TouchGesture(100,200,1000);
  assert.equal(g.hold(1000+delay-1),'pending');
  g.end(); assert.equal(g.hold(2000),'ended'); assert.deepEqual(g.move(200,300),{x:0,y:0});
});
test('hold tolerates small jitter and keeps mining while sliding to another target', () => {
  const g = new TouchGesture(100,200,1000);
  assert.deepEqual(g.move(103,202),{x:0,y:0});
  assert.equal(g.hold(1000+delay),'mine');
  assert.deepEqual(g.move(300,400),{x:0,y:0}); assert.equal(g.phase,'mine');
  g.end(); assert.equal(g.hold(3000),'ended');
});
test('drag threshold measures displacement from initial touch; camera receives accumulated motion', () => {
  const g = new TouchGesture(100,200,1000);
  assert.deepEqual(g.move(100+threshold/2,200),{x:0,y:0});
  assert.deepEqual(g.move(101+threshold,200),{x:1+threshold,y:0});
  assert.equal(g.hold(5000),'look'); // Pausing a look never starts mining.
  assert.deepEqual(g.move(105+threshold,198),{x:4,y:-2});
});
test('diagonal displacement and exact threshold use one consistent role boundary', () => {
  const g = new TouchGesture(0,0,0);
  g.move(threshold,0); assert.equal(g.phase,'pending');
  g.move(threshold,1); assert.equal(g.phase,'look');
  const h = new TouchGesture(0,0,0); h.move(threshold*.8,threshold*.8); assert.equal(h.phase,'look');
});
