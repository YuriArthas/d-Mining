import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceLightStrength, surfaceLightStrengthAtFeet, SURFACE_LIGHT_FADE} from '../../src/game/world/SurfaceLightFade.ts';
import {CELL} from '../../src/game/terrain/grid.ts';

test('entrance stays lit and the old two-block cutoff fades continuously to zero at 15 blocks',()=>{
 assert.equal(SURFACE_LIGHT_FADE.end,15*CELL);
 assert.equal(surfaceLightStrength(-5),1);
 assert.equal(surfaceLightStrength(2*CELL),1);
 assert.ok(surfaceLightStrength(2*CELL+.01)>.99999);
 assert.ok(surfaceLightStrength(3*CELL)>.98);
 assert.equal(surfaceLightStrength(8.5*CELL),.5);
 assert.ok(surfaceLightStrength(15*CELL-.01)<.00001);
 assert.equal(surfaceLightStrength(15*CELL),0);
 assert.equal(surfaceLightStrength(500),0);
 let previous=1;
 for(let depth=0;depth<=32;depth+=.02){
  const strength=surfaceLightStrength(depth);
  assert.ok(strength<=previous&&strength>=0);
  assert.ok(previous-strength<.002);
  previous=strength;
 }
});

// Measured grounded feet include Rapier's .025m skin and .002m contact slack.
test('15-block floor removes all lights despite contact margin and float32 rounding',()=>{
 for(const feet of [-29.97300033569336,-29.972999572753906,-30,-32])
  assert.equal(surfaceLightStrengthAtFeet(feet),0);
 assert.ok(surfaceLightStrengthAtFeet(-27.973)>.01);
});
