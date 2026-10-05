import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderChunk } from 'three';
import { compileShadowFilter } from '../../src/game/presentation/stableShadow.ts';

test('stable shadows retain five taps and avoid screen-space jitter without changing global Three shaders',()=>{
 const original=ShaderChunk.shadowmap_pars_fragment;
 const shader={fragmentShader:'#include <shadowmap_pars_fragment>'};compileShadowFilter(shader,5);
 const start=shader.fragmentShader.indexOf('float getShadow('),end=shader.fragmentShader.indexOf('return mix( 1.0, shadow, shadowIntensity )',start);
 const body=shader.fragmentShader.slice(start,end);
 assert.equal((body.match(/texture\(shadowMap,/g)||[]).length,5);
 assert.equal(body.includes('gl_FragCoord'),false);assert.equal(ShaderChunk.shadowmap_pars_fragment,original);
});

test('compact shadow filter keeps hardware PCF, depth bias and frustum guards with one lookup',()=>{
 const shader={fragmentShader:'#include <shadowmap_pars_fragment>'};compileShadowFilter(shader,1);
 const start=shader.fragmentShader.indexOf('float getShadow('),end=shader.fragmentShader.indexOf('return mix( 1.0, shadow, shadowIntensity )',start);
 const body=shader.fragmentShader.slice(start,end);
 assert.equal((body.match(/texture\(shadowMap,/g)||[]).length,1);
 assert.ok(body.includes('sampler2DShadow'));
 assert.ok(body.includes('shadowCoord.z += shadowBias'));
 assert.ok(body.includes('if ( frustumTest )'));
 assert.equal(body.includes('gl_FragCoord'),false);
});
