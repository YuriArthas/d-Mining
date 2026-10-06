import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLoading,updateLoading} from '../../src/game/ui/loadingState.ts';
test('parallel terrain and assets preserve independent completion and await first frame',()=>{
 let state=initialLoading();state=updateLoading(state,{stage:'terrain',done:1,total:1,complete:true});state=updateLoading(state,{stage:'assets',done:4,total:77});
 assert.equal(state.steps.terrain.complete,true);assert.equal(state.steps.assets.done,4);assert.equal(state.ready,false);
 for(const stage of ['assets','rooms','shaders'])state=updateLoading(state,{stage,done:1,total:1,complete:true});assert.equal(state.ready,false);
 state=updateLoading(state,{ready:true});assert.equal(state.ready,true);
});
test('failure survives late progress or ready events; a new initialization resets it',()=>{
 let state=updateLoading(initialLoading(),{error:'HTTP 503'});state=updateLoading(state,{stage:'terrain',done:1,total:1,complete:true});state=updateLoading(state,{ready:true});assert.equal(state.error,'HTTP 503');assert.equal(state.ready,false);
 assert.deepEqual(updateLoading(state,{reset:true}),initialLoading());
});
test('one overall progress never rewinds across concurrent stages or revised totals',()=>{
 let state=initialLoading();assert.equal(state.progress,0);
 const events=[{stage:'assets',done:30,total:77},{stage:'terrain',done:48,total:48,complete:true},{stage:'assets',done:77,total:77,complete:true},{stage:'rooms',done:1,total:9},{stage:'rooms',done:9,total:9,complete:true},{stage:'shaders',done:60,total:100},{stage:'shaders',done:60,total:150},{stage:'shaders',done:1,total:1,complete:true}];
 for(const event of events){const previous=state.progress;state=updateLoading(state,event);assert.ok(state.progress>=previous);assert.ok(state.progress<1);}
 assert.equal(state.progress,.98);state=updateLoading(state,{ready:true});assert.equal(state.progress,1);
 assert.equal(updateLoading(state,{stage:'shaders',done:0,total:100}).progress,1);
});
