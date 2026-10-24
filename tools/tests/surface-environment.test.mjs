import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Color, WebGLCoordinateSystem, WebGLRenderTarget, CubeUVReflectionMapping } from 'three';
import { SurfaceEnvironment } from '../../src/game/presentation/SurfaceEnvironment.ts';
import { RenderSubmission } from '../../src/game/presentation/RenderSubmission.ts';
import { ENVIRONMENT_CONFIG } from '../../src/game/world/environment.ts';
import { surfaceLightStrength } from '../../src/game/world/SurfaceLightFade.ts';

function setup() {
  let target = null, face = 0, mip = 0;
  const counters = { draws: 0, cubeDisposals: 0, targetDisposals: 0, generatorDisposals: 0, prefilters: 0 };
  const cubes = new Set();
  const renderer = {
    coordinateSystem: WebGLCoordinateSystem, xr: { enabled: false },
    getRenderTarget: () => target, getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
    setRenderTarget(t, f = 0, m = 0) {
      target = t; face = f; mip = m;
      if(t&&!cubes.has(t)){cubes.add(t);t.addEventListener('dispose',()=>counters.cubeDisposals++);}
    },
    render() { counters.draws++; },
  };
  const prefilter = {
    fromCubemap() {
      counters.prefilters++;
      const target=new WebGLRenderTarget(384,512);target.texture.mapping=CubeUVReflectionMapping;
      target.addEventListener('dispose',()=>counters.targetDisposals++);return target;
    },
    dispose(){counters.generatorDisposals++;},
  };
  const scene = new Scene(), background = new Color('#123456');scene.background = background;
  const sky = new SurfaceEnvironment(renderer, scene, ENVIRONMENT_CONFIG.sky,prefilter);
  return { sky, scene, background, counters, cubes };
}
const IBL = ENVIRONMENT_CONFIG.sky.environmentIntensity;

test('the daytime sky is baked once, lights the scene and releases everything it owns', () => {
  const { sky, scene, background, counters, cubes } = setup();
  assert.equal(counters.draws,6);assert.equal(counters.prefilters,1);
  sky.setEnabled(true);
  assert.equal(scene.environment.mapping,CubeUVReflectionMapping);assert.equal(scene.environmentIntensity,IBL);
  assert.equal(scene.background,null);assert.equal(scene.getObjectByName('surface-sky').visible,true);
  sky.prepareDraw();sky.markSubmitted();sky.prepareDraw();sky.markSubmitted();
  assert.equal(counters.draws,6,'admitted frames never rebake the sky');
  sky.setEnabled(false);assert.equal(scene.environment,null);assert.equal(scene.getObjectByName('surface-sky').visible,false);
  sky.dispose();assert.equal(scene.environment,null);assert.equal(scene.background,background);assert.equal(scene.getObjectByName('surface-sky'),undefined);
  assert.equal(counters.targetDisposals,1);assert.equal(counters.generatorDisposals,1);assert.equal(cubes.size,1);assert.equal(counters.cubeDisposals,1);
  sky.dispose();assert.equal(counters.targetDisposals,1);
  for(const call of [()=>sky.setEnabled(true),()=>sky.setLightingStrength(.2),()=>sky.prepareDraw(),()=>sky.markSubmitted()])assert.throws(call,/disposed/);
});

test('skipped submissions enqueue no GPU work; diagnostics report only what was submitted', () => {
  const { sky, counters } = setup();
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,WAIT_FAILED:3,status:2,
    fenceSync:()=>({}),clientWaitSync(){return this.status;},deleteSync(){},flush(){},isContextLost:()=>false,
  };
  const gate = new RenderSubmission(gl,1,'fenced');
  const submit = () => { const accepted = gate.draw(() => sky.prepareDraw()); if (accepted) sky.markSubmitted(); return accepted; };
  sky.setEnabled(true);assert.equal(submit(),true);
  for(let i=0;i<3000;i++){sky.setLightingStrength(1-i/6000);assert.equal(submit(),false);}
  assert.equal(counters.draws,6);assert.equal(gate.snapshot().skipped,3000);
  assert.equal(sky.diagnostics().submittedFrames,1);assert.equal(sky.diagnostics().submittedEnvironmentLightingStrength,1);
  gl.status=4;assert.equal(submit(),true);
  assert.ok(Math.abs(sky.diagnostics().submittedEnvironmentLightingStrength-(1-2999/6000))<1e-12);
  gate.dispose();sky.dispose();
});

test('preparing a frame never claims it was submitted, including a failed world draw', () => {
  const { sky } = setup();
  sky.setEnabled(true);sky.prepareDraw();
  assert.equal(sky.diagnostics().submittedSurface,null);assert.equal(sky.diagnostics().submittedFrames,0);
  sky.markSubmitted();
  sky.setEnabled(false);sky.prepareDraw();
  // An unsuccessful world draw never invokes markSubmitted.
  assert.equal(sky.diagnostics().submittedSurface,true);assert.equal(sky.diagnostics().submittedFrames,1);
  sky.markSubmitted();assert.equal(sky.diagnostics().submittedSurface,false);
  assert.throws(()=>sky.markSubmitted(),/No environment frame/);
  sky.dispose();assert.throws(()=>sky.markSubmitted(),/disposed/);
});

test('image-based light fades independently of the visible sky down the first shaft', () => {
  const { sky, scene, counters } = setup();
  sky.setEnabled(true);const map=scene.environment;
  sky.setLightingStrength(.5);sky.prepareDraw();sky.markSubmitted();
  assert.equal(scene.environment,map);assert.equal(scene.environmentIntensity,IBL*.5);
  assert.equal(sky.diagnostics().submittedEnvironmentLightingIntensity,IBL*.5);
  sky.setLightingStrength(surfaceLightStrength(29.99));
  assert.ok(scene.environmentIntensity>0&&scene.environmentIntensity<.000001);
  sky.setLightingStrength(0);
  assert.equal(scene.environment,null);assert.equal(scene.environmentIntensity,0);
  assert.equal(sky.active,true);assert.equal(scene.getObjectByName('surface-sky').visible,true);
  assert.equal(sky.diagnostics().environmentLightingActive,false);
  sky.setLightingStrength(1);assert.equal(scene.environment,map);assert.equal(scene.environmentIntensity,IBL);
  sky.setEnvironmentOverride(.3);assert.equal(scene.environmentIntensity,.3);sky.setEnvironmentOverride(undefined);assert.equal(scene.environmentIntensity,IBL);
  assert.equal(counters.draws,6);
  assert.throws(()=>sky.setLightingStrength(NaN),/finite/);
  sky.dispose();
});
