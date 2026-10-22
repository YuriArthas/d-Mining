import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Color, WebGLCoordinateSystem, WebGLRenderTarget, CubeUVReflectionMapping } from 'three';
import { SurfaceEnvironment } from '../../src/game/presentation/SurfaceEnvironment.ts';
import { RenderSubmission } from '../../src/game/presentation/RenderSubmission.ts';
import { ENVIRONMENT_CONFIG } from '../../src/game/world/environment.ts';
import { surfaceLightStrength } from '../../src/game/world/SurfaceLightFade.ts';

function setup() {
  let target = null, face = 0, mip = 0, blend = null;
  const counters = { draws: 0, cubeDisposals: 0, targetDisposals: 0, generatorDisposals: 0 };
  const cubes = new Set();
  const renderer = {
    coordinateSystem: WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    setRenderTarget(t, f = 0, m = 0) {
      target = t; face = f; mip = m;
      if(t&&!cubes.has(t)){cubes.add(t);t.addEventListener('dispose',()=>counters.cubeDisposals++);}
    },
    render(scene) {
      counters.draws++;
      const uniforms = scene.children[0].material.uniforms;
      if (uniforms.dayMap) blend = uniforms.daytime.value;
    },
  };
  const allocated = [], updates = [];
  const prefilter = {
    fromCubemap(source, existing) {
      if(existing){updates.push({target:existing,blend});return existing;}
      const target=new WebGLRenderTarget(384,512);target.texture.mapping=CubeUVReflectionMapping;
      target.addEventListener('dispose',()=>counters.targetDisposals++);allocated.push(target);return target;
    },
    dispose(){counters.generatorDisposals++;},
  };
  const scene = new Scene(), background = new Color('#123456');scene.background = background;
  const sky = new SurfaceEnvironment(renderer, scene, ENVIRONMENT_CONFIG.sky,prefilter);
  return { sky, scene, background, counters, cubes, allocated, updates };
}

test('admitted sky and environment share the latest blend, reuse targets and release all owned resources', () => {
  const { sky, scene, background, counters, cubes, allocated, updates } = setup();
  assert.equal(allocated.length,3);
  assert.equal(counters.draws,12);sky.setEnabled(true);
  const night = scene.environment;
  assert.equal(night.mapping,CubeUVReflectionMapping);
  assert.equal(sky.diagnostics().daylightBlend,0);
  assert.equal(sky.diagnostics().submittedDaylightBlend,null);
  sky.prepareDraw();sky.markSubmitted();
  assert.equal(counters.draws,12);assert.equal(sky.diagnostics().submittedDaylightBlend,0);
  sky.setDaylight(.25);assert.equal(counters.draws,12);
  const blended = scene.environment;
  assert.notEqual(blended,night);
  assert.equal(scene.getObjectByName('surface-sky').material.uniforms.daytime.value,.25);
  assert.equal(scene.environmentIntensity,.65+(.55-.65)*.25);
  sky.prepareDraw();assert.equal(counters.draws,18);assert.equal(updates[0].blend,.25);
  sky.markSubmitted();assert.equal(sky.diagnostics().submittedDaylightBlend,.25);
  sky.setEnabled(true);sky.setDaylight(.25);sky.prepareDraw();assert.equal(counters.draws,18);
  sky.setDaylight(.4);sky.setDaylight(.75);assert.equal(counters.draws,18);
  sky.prepareDraw();assert.equal(counters.draws,24);assert.equal(scene.environment,blended);
  assert.equal(allocated.length,3);assert.equal(updates.length,2);assert.equal(updates[0].target,updates[1].target);assert.equal(updates[1].blend,.75);
  sky.setEnabled(false);sky.setDaylight(.5);sky.prepareDraw();sky.markSubmitted();
  assert.equal(counters.draws,24);assert.equal(scene.environment,null);assert.equal(sky.diagnostics().submittedSurface,false);
  sky.setEnabled(true);assert.equal(counters.draws,24);assert.equal(scene.environment,blended);
  sky.prepareDraw();sky.markSubmitted();assert.equal(counters.draws,30);assert.equal(updates[2].blend,.5);assert.equal(sky.diagnostics().submittedSurface,true);
  sky.setDaylight(1);sky.prepareDraw();assert.equal(counters.draws,30);assert.notEqual(scene.environment,blended);assert.notEqual(scene.environment,night);
  sky.dispose();assert.equal(scene.environment,null);assert.equal(scene.background,background);assert.equal(scene.getObjectByName('surface-sky'),undefined);
  assert.equal(counters.targetDisposals,3);assert.equal(counters.generatorDisposals,1);assert.equal(cubes.size,3);assert.equal(counters.cubeDisposals,3);
  sky.dispose();assert.equal(counters.targetDisposals,3);assert.equal(counters.generatorDisposals,1);
  assert.throws(()=>sky.setEnabled(true),/disposed/);
  assert.throws(()=>sky.setDaylight(.2),/disposed/);
  assert.throws(()=>sky.setLightingStrength(.2),/disposed/);
  assert.throws(()=>sky.prepareDraw(),/disposed/);
  assert.throws(()=>sky.markSubmitted(),/disposed/);
});

test('thousands of skipped logic frames enqueue no cube or PMREM work and the next admitted frame uses the latest blend', () => {
  const { sky, scene, counters, allocated, updates } = setup();
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,status:2,
    fenceSync:()=>({}),clientWaitSync(){return this.status;},deleteSync(){},flush(){},isContextLost:()=>false,
  };
  const gate = new RenderSubmission(gl,1,'fenced');
  let worldDraws = 0;
  const submit = () => {
    const accepted = gate.draw(() => {
      sky.prepareDraw();
      assert.equal(updates.at(-1).blend,scene.getObjectByName('surface-sky').material.uniforms.daytime.value);
      worldDraws++;
    });
    if (accepted) sky.markSubmitted();
    return accepted;
  };
  sky.setEnabled(true);sky.setDaylight(.1);assert.equal(submit(),true);
  assert.equal(counters.draws,18);assert.equal(updates.length,1);
  for(let i=1;i<=3000;i++) {
    sky.setDaylight(.1+i*.0002);sky.setEnabled(true);
    assert.equal(submit(),false);
  }
  assert.equal(counters.draws,18);assert.equal(updates.length,1);assert.equal(worldDraws,1);
  assert.equal(gate.snapshot().queued,1);assert.equal(gate.snapshot().skipped,3000);
  assert.equal(sky.diagnostics().submittedDaylightBlend,.1);assert.equal(sky.diagnostics().submittedFrames,1);
  const latest = sky.diagnostics().daylightBlend;
  assert.ok(latest>.69&&latest<.71);
  gl.status=4;assert.equal(submit(),true);
  assert.equal(counters.draws,24);assert.equal(updates.length,2);assert.equal(worldDraws,2);
  assert.equal(updates[1].blend,latest);assert.equal(updates[0].target,updates[1].target);assert.equal(allocated.length,3);
  assert.equal(sky.diagnostics().submittedDaylightBlend,latest);assert.equal(sky.diagnostics().submittedFrames,2);
  gate.dispose();sky.dispose();
});

test('preparing a frame never claims it was submitted, including a failed world draw', () => {
  const { sky } = setup();
  sky.setEnabled(true);sky.setDaylight(.25);sky.prepareDraw();
  assert.equal(sky.diagnostics().submittedDaylightBlend,null);assert.equal(sky.diagnostics().submittedFrames,0);
  sky.markSubmitted();
  sky.setDaylight(.5);sky.prepareDraw();
  // An unsuccessful world draw never invokes markSubmitted.
  assert.equal(sky.diagnostics().submittedDaylightBlend,.25);assert.equal(sky.diagnostics().submittedFrames,1);
  sky.setEnabled(false);sky.prepareDraw();sky.markSubmitted();
  assert.equal(sky.diagnostics().submittedDaylightBlend,.5);assert.equal(sky.diagnostics().submittedSurface,false);
  assert.equal(sky.diagnostics().submittedFrames,2);
  assert.throws(()=>sky.markSubmitted(),/No environment frame/);
  sky.dispose();assert.throws(()=>sky.markSubmitted(),/disposed/);
});

test('IBL fades independently of the visible sky, stops all deep PMREM work and restores the latest blend on ascent', () => {
  const { sky, scene, counters, allocated, updates } = setup();
  sky.setEnabled(true);sky.setDaylight(.25);sky.prepareDraw();sky.markSubmitted();
  const map=scene.environment,draws=counters.draws,fullIntensity=scene.environmentIntensity;
  sky.setLightingStrength(.5);sky.prepareDraw();sky.markSubmitted();
  assert.equal(scene.environment,map);assert.equal(scene.environmentIntensity,fullIntensity*.5);
  assert.equal(counters.draws,draws,'changing depth alone never rebakes an unchanged sky');
  assert.equal(sky.diagnostics().environmentLightingStrength,.5);
  assert.equal(sky.diagnostics().submittedEnvironmentLightingIntensity,fullIntensity*.5);
  sky.setLightingStrength(surfaceLightStrength(29.99));
  assert.ok(scene.environmentIntensity>0&&scene.environmentIntensity<.000001);
  sky.setLightingStrength(0);
  assert.equal(scene.environment,null);assert.equal(scene.environmentIntensity,0);
  assert.equal(sky.active,true);assert.equal(scene.getObjectByName('surface-sky').visible,true);
  assert.equal(sky.diagnostics().environmentLightingActive,false);
  assert.equal(sky.diagnostics().submittedEnvironmentLightingStrength,.5,'logical depth must not overwrite the last submitted diagnostic');
  for(let i=0;i<=100;i++) {
   sky.setDaylight(i/100);sky.prepareDraw();sky.markSubmitted();
   assert.equal(scene.environment,null);assert.equal(scene.environmentIntensity,0);
   assert.equal(scene.getObjectByName('surface-sky').material.uniforms.daytime.value,i/100);
   assert.equal(sky.diagnostics().submittedEnvironmentLightingStrength,0);
   assert.equal(sky.diagnostics().submittedEnvironmentLightingIntensity,0);
  }
  assert.equal(counters.draws,draws);assert.equal(updates.length,1);assert.equal(sky.diagnostics().environmentUpdates,1);
  sky.setDaylight(.75);sky.setLightingStrength(surfaceLightStrength(29.99));
  assert.equal(counters.draws,draws);assert.equal(scene.environment,map);
  sky.prepareDraw();sky.markSubmitted();
  assert.equal(updates.at(-1).blend,.75);assert.equal(counters.draws,draws+6);
  sky.setLightingStrength(1);sky.prepareDraw();sky.markSubmitted();
  assert.equal(counters.draws,draws+6);assert.equal(scene.environmentIntensity,.65+(.55-.65)*.75);
  assert.equal(sky.diagnostics().environmentLightingActive,true);assert.equal(sky.diagnostics().submittedEnvironmentLightingStrength,1);
  assert.equal(allocated.length,3);assert.equal(updates[0].target,updates[1].target);
  assert.throws(()=>sky.setLightingStrength(NaN),/finite/);
  sky.dispose();
});
