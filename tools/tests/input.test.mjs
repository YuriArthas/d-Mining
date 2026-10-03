import assert from 'node:assert/strict';
import test from 'node:test';
import { GameInput, stickVector } from '../../src/game/GameInput.ts';

test('combined movement preserves analog strength and caps diagonal speed', () => {
  const input = new GameInput();
  input.move(0.25, 0); assert.equal(input.getSnapshot().moveX, 0.25);
  input.key('KeyW', true); input.key('KeyD', true);
  let state = input.getSnapshot();
  assert.ok(Math.abs(Math.hypot(state.moveX, state.moveY) - 1) < 1e-12);
  input.move(0, 0); input.key('KeyS', true); input.key('KeyA', true);
  state = input.getSnapshot(); assert.equal(state.moveX, 0); assert.equal(state.moveY, 0);
});

test('jump is an edge shared by input sources, not keyboard repeats', () => {
  const input = new GameInput();
  input.key('Space', true); input.key('Space', true);
  input.jump('touch:1', true);
  assert.equal(input.getSnapshot().jumpCount, 1);
  assert.equal(input.consumeJump(), true); assert.equal(input.consumeJump(), false);
  input.key('Space', false); assert.equal(input.getSnapshot().jumpHeld, true);
  input.jump('touch:1', false); input.key('Space', true);
  assert.equal(input.getSnapshot().jumpCount, 2);
});

test('releasing one mining source does not release another', () => {
  const input = new GameInput();
  input.mine('mouse', true); input.mine('touch:2', true); input.mine('mouse', false);
  assert.equal(input.getSnapshot().mining, true);
  input.mine('touch:2', false); assert.equal(input.getSnapshot().mining, false);
});

test('stick dead zone, range clamp and screen-to-forward direction', () => {
  assert.deepEqual(stickVector(1, 1, 46, 0.12), {x:0,y:0});
  const vector = stickVector(200, -200, 46, 0.12);
  assert.ok(vector.x > 0 && vector.y > 0);
  assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-12);
});

test('look deltas are consumed once; exit clears pending actions and subscriptions detach', () => {
  const input = new GameInput(); let updates = 0;
  const detach = input.subscribe(() => updates++);
  input.look(0.5, -0.25); input.look(0.25, 0.125);
  assert.deepEqual(input.consumeLook(), {x:0.75,y:-0.125});
  assert.deepEqual(input.consumeLook(), {x:0,y:0});
  input.key('KeyW', true); input.key('Space', true); input.mine('touch:1', true);
  input.reset();
  assert.equal(input.getSnapshot().moveY, 0); assert.equal(input.getSnapshot().mining, false);
  assert.equal(input.getSnapshot().jumpHeld, false); assert.equal(input.consumeJump(), false);
  detach(); const previous = updates; input.look(1, 1); assert.equal(updates, previous);
});

test('mouse and touch aim use independent positions; reset clears either mode', () => {
  const input = new GameInput(); let updates = 0;
  input.subscribe(() => updates++);
  input.point(.4,-.6,true);
  assert.equal(updates,0);
  input.look(.1,.2);
  assert.deepEqual(input.getAim(),{x:.4,y:-.6,active:true,mode:'mouse'});
  input.point(.4,-.6,false); assert.equal(input.getAim().active,false);
  input.touchAim(.2,.5,true); assert.deepEqual(input.getAim(),{x:.2,y:.5,active:true,mode:'touch'});
  input.reset(); assert.equal(input.getAim().active,false);
  input.point(.4,-.6,true); input.reset(); assert.equal(input.getAim().active,false);
});
test('a mouse click between frames keeps its pressed position and is consumed once', () => {
  const input = new GameInput(); input.point(.3,.6,true);
  input.mine('mouse',true); input.mine('mouse',false); input.point(-.4,-.7,true);
  assert.deepEqual(input.consumeMinePress(),{x:.3,y:.6,active:true,mode:'mouse'});
  assert.equal(input.consumeMinePress(),null); assert.equal(input.getSnapshot().mining,false);
  input.mine('mouse',true); input.reset(); assert.equal(input.consumeMinePress(),null);
});

test('touch mining has no deferred click after release or reset', () => {
  const input = new GameInput(); input.touchAim(.3,.6,true);
  input.mine('pointer:1',true); assert.equal(input.getSnapshot().mining,true);
  input.mine('pointer:1',false); assert.equal(input.consumeMinePress(),null);
  input.reset(); assert.equal(input.getAim().active,false); assert.equal(input.resetRevision,1);
});
