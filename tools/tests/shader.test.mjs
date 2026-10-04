import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderChunk } from 'three';
import { compileStableShadow } from '../../src/game/presentation/stableShadow.ts';

test('stable shadows retain five taps and avoid screen-space jitter without changing global Three shaders',()=>{
 const original=ShaderChunk.shadowmap_pars_fragment;
 const shader={fragmentShader:'#include <shadowmap_pars_fragment>'};compileStableShadow(shader);
 const start=shader.fragmentShader.indexOf('float getShadow('),end=shader.fragmentShader.indexOf('return mix( 1.0, shadow, shadowIntensity )',start);
 const body=shader.fragmentShader.slice(start,end);
 assert.equal((body.match(/texture\(shadowMap,/g)||[]).length,5);
 assert.equal(body.includes('gl_FragCoord'),false);assert.equal(ShaderChunk.shadowmap_pars_fragment,original);
});
