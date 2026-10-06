import test from 'node:test';
import assert from 'node:assert/strict';
import {DisposalScope} from '../../src/game/runtime/DisposalScope.ts';
import {PlayerController} from '../../src/game/runtime/PlayerController.ts';
test('startup resources release in reverse order, including late arrivals after cancellation',()=>{
 const scope=new DisposalScope(),log=[];
 scope.defer(()=>log.push('world'));scope.defer(()=>log.push('terrain'));scope.defer(()=>log.push('colliders'));
 scope.dispose();scope.dispose();scope.defer(()=>log.push('late model'));
 assert.deepEqual(log,['colliders','terrain','world','late model']);
});
test('a broken release cannot prevent the remaining resources from being freed',()=>{
 const scope=new DisposalScope(),log=[];
 scope.defer(()=>log.push('world'));scope.defer(()=>{throw Error('bad view')});scope.defer(()=>log.push('colliders'));
 assert.throws(()=>scope.dispose(),AggregateError);assert.deepEqual(log,['colliders','world']);scope.dispose();
});
test('travel waits for terrain; installation precedes physics and input is not consumed while waiting',()=>{
 const log=[];let ready=false,jumps=0;
 const physics={feet:()=>[0,0,0],grounded:true,teleport:()=>log.push('teleport'),tick:()=>log.push('physics')};
 const terrain={relocate:()=>log.push('relocate'),recenter:()=>{},process:()=>log.push('install'),ready:()=>ready};
 const input={reset:()=>{},getSnapshot:()=>({moveX:0,moveY:0}),consumeJump:()=>{jumps++;return false;}};
 const session={resetPosition:()=>{},updatePosition:()=>log.push('position')};
 const player=new PlayerController(physics,terrain,input,session);player.travelTo([0,-400,0]);
 player.step(1/60,0,()=>log.push('camera reset'));assert.equal(jumps,0);assert.ok(player.travelling);
 ready=true;log.length=0;player.step(1/60,0,()=>log.push('camera reset'));
 assert.deepEqual(log,['install','teleport','camera reset','physics','position']);assert.equal(player.travelling,null);assert.equal(jumps,1);
});
