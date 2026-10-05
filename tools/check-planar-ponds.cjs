// Public desktop regression: real linked programs must fit a 16-unit WebGL2 GPU,
// even when the validation software GPU offers 32. Never infer this from pixels alone.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const out=process.env.ARTIFACT_DIR||'artifacts/planar-ponds-v15';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],programs:[],views:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));
   window.__shaderAudit=[];
   const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram;
   proto.linkProgram=function(program){
    link.call(this,program);
    const ok=this.getProgramParameter(program,this.LINK_STATUS),uniforms=[];
    if(ok)for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++){
     const u=this.getActiveUniform(program,i);
     if([0x8b5e,0x8b60,0x8b62,0x8dc1,0x8dc4].includes(u.type))uniforms.push({name:u.name,size:u.size});
    }
    window.__shaderAudit.push({ok,log:this.getProgramInfoLog(program),deviceLimit:this.getParameter(this.MAX_TEXTURE_IMAGE_UNITS),samplers:uniforms.reduce((n,u)=>n+u.size,0),uniforms});
   };
  });
  await page.goto('https://w-sunjun-public.dev.clock-p.com/');
  assert.equal(await page.locator('a[href$="games/mining-test/index.html"]').count(),1);
  assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const roadVersion=await page.evaluate(()=>window.__miningValidation.snapshot().facilities.surfaceDetails.roads);
  assert.equal(roadVersion.version,'block-paths-v1');report.roads=roadVersion;
  report.player=await page.evaluate(()=>window.__miningValidation.snapshot().player);assert.equal(report.player.height,1.85);assert.equal(report.player.cameraDistance,8.5);
  for(const [name,position,yaw,pitch] of [['ponds',[0,.1,34],0,.32],['ponds-angle',[0,.1,31],.14,.15],['pond-close',[-3.5,.1,22],Math.PI/2,.55]].filter(([name])=>!process.env.VIEW_NAMES||process.env.VIEW_NAMES.split(',').includes(name))){
   if(position)await page.evaluate(({position,yaw,pitch})=>{window.__miningValidation.teleport(position);window.__miningValidation.look(yaw,pitch)},{position,yaw,pitch});
   await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight});
   const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
   await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+3,frame);
   if(!process.env.SHOT_NAMES||process.env.SHOT_NAMES.split(',').includes(name))await page.screenshot({path:`${out}/${name}.png`});
   report.views.push({name,state:await page.evaluate(()=>window.__miningValidation.snapshot())});console.log('captured',name);
  }
  const ponds=report.views[0].state.facilities.ponds;assert.equal(ponds.count,2);assert.equal(ponds.extraTextures,0);assert.equal(ponds.version,'clear-planar-ponds-v15');assert.equal(ponds.reflection,'shared-planar-scene');assert.ok(ponds.reflectionTarget.captures>0);assert.equal(ponds.reflectionTarget.maxCapturesPerFrame,1);assert.ok(ponds.reflectionTarget.estimatedTargetBytes<8*1024*1024);assert.equal(ponds.specular,true);assert.equal(ponds.waterIor,1.333);assert.equal(ponds.clearcoat,0);assert.equal(report.views[0].state.startup.sky.nightVersion,'silver-moon-v12');report.ponds=ponds;
  const seam=report.views[0].state.facilities.boundaryStitching;assert.equal(seam.version,'midpoint-cut-v1');assert.ok(seam.meshes>400);assert.ok(seam.maxOutsideError<.0001);assert.ok(seam.variants<80);assert.ok(seam.bytes<2000000);report.seams=seam;
  assert.equal((await page.evaluate(()=>window.__miningValidation.snapshot())).startup.sky.time,'night');
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day');
  const night=report.views.at(-1).state;assert.equal(night.lighting.surfaceArea.streetLights.length,2);assert.ok(night.lighting.surfaceArea.streetLights.every(p=>p.type==='PointLight'&&p.intensity===150));assert.equal(night.facilities.surfaceDetails.windowEmissiveIntensity,2.5);assert.equal(night.facilities.surfaceDetails.pendantEmissiveMultiplier,1);
  const day=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(day.facilities.surfaceDetails.windowEmissiveIntensity,0);assert.equal(day.facilities.surfaceDetails.pendantEmissiveMultiplier,0);assert.equal(day.lighting.surfaceArea.intensity,0);report.day=day;assert.ok(day.lighting.surfaceArea.streetLights.every(p=>p.intensity===0));
  const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,frame);
  await page.screenshot({path:`${out}/pond-day.png`});
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='night');
  const restored=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(restored.startup.sceneAttachMs,night.startup.sceneAttachMs);assert.ok(restored.position.every((v,i)=>Math.abs(v-night.position[i])<.01));report.togglePreservesScene=true;assert.equal(restored.facilities.surfaceDetails.windowEmissiveIntensity,2.5);
  for(const v of report.views){assert.equal(v.state.camera.obstructed,false);const d=v.state.facilities.surfaceDetails;assert.equal(d.grassInstances,780);assert.ok(d.grassDrawCalls<=12);assert.ok(d.grassTriangles<=22000);assert.ok(d.grassBufferBytes<100000);}report.restored=restored;assert.ok(restored.lighting.surfaceArea.streetLights.every(p=>p.intensity===150));
  await page.evaluate(()=>window.__miningValidation.teleport([0,.1,20]));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&Math.abs(s.position[2]-20)<.1;});
  await page.getByRole('button',{name:'返回地表',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&Math.abs(s.position[2]-46)<.01;});
  report.returnPosition=await page.evaluate(()=>window.__miningValidation.snapshot().position);
  report.programs=await page.evaluate(()=>window.__shaderAudit);
  assert.ok(report.programs.some(p=>p.uniforms.some(u=>u.name==='normalMap')),'must compile real Tripo materials');
  assert.ok(report.programs.every(p=>p.ok),'shader link failure');
  report.maxSamplers=Math.max(...report.programs.map(p=>p.samplers));
  assert.ok(report.maxSamplers<=14,`${report.maxSamplers} samplers: reserve 2 of WebGL2 minimum 16`);
  assert.deepEqual(report.errors,[]);
  console.log('linked shader sampler maximum:',report.maxSamplers);
  await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');report.exitToList=true;
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
