// All scene checks use the already-published desktop URL. Software GPU timings
// are not iPhone results; post-start API counts verify the actual submission path.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const out='artifacts/shadow-budget-v21';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],environment:'public desktop / software GPU / 400ms RAF throttle'};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));
   window.__syncCalls={};window.__shadowPrograms=[];
   const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram;
   proto.linkProgram=function(program){
    link.call(this,program);
    const uniforms=[];
    for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++)uniforms.push(this.getActiveUniform(program,i));
    const sampler=name=>uniforms.find(u=>u.name===name+'[0]'||u.name===name)?.size??0;
    const lights=name=>Math.max(0,...uniforms.filter(u=>u.name.startsWith(name+'[')).map(u=>Number(u.name.split('[')[1].split(']')[0])+u.size));
    window.__shadowPrograms.push({spot:sampler('spotShadowMap'),directional:sampler('directionalShadowMap'),spotLights:lights('spotLights'),pointLights:lights('pointLights')});
   };
   for(const key of ['fenceSync','clientWaitSync','flush','beginQuery','getQueryParameter']){
    const original=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){window.__syncCalls[key]=(window.__syncCalls[key]??0)+1;return original.apply(this,args);};
   }
  });
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);console.log('ready');
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const frames=async(n=3)=>{const count=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);await page.waitForFunction(({count,n})=>window.__miningValidation.snapshot().renderer.submission.submitted>=count+n,{count,n});};
  await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,34]);window.__miningValidation.look(0,.32);});
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight;});
  await frames();await page.evaluate(()=>window.__syncCalls={});await frames(5);
  report.surface=await page.evaluate(()=>window.__miningValidation.snapshot());report.syncCalls=await page.evaluate(()=>window.__syncCalls);
  assert.deepEqual(report.syncCalls,{});assert.equal(report.surface.renderer.submission.mode,'browser');assert.equal(report.surface.renderer.profile.gpu.enabled,false);
  assert.equal(report.surface.startup.sky.skyDepthTest,true);assert.equal(report.surface.startup.sky.skyRenderOrder,1000);
  assert.equal(report.surface.renderer.profile.reflectionCalls,0);assert.equal(report.surface.lighting.shadowEnabled,true);assert.equal(report.surface.terrainVisuals.shadowReceivers,0);
  assert.equal(report.surface.lighting.surfaceArea.activeShadowLights,1); // plus the moon
  assert.equal(report.surface.lighting.surfaceArea.activeLights,12);
  report.programs=await page.evaluate(()=>window.__shadowPrograms);
  assert.ok(report.programs.some(p=>p.spot===1&&p.directional===1));
  assert.ok(report.programs.every(p=>p.spot<=1&&p.directional<=1));
  await page.screenshot({path:`${out}/surface.png`});console.log('night: two shadow samplers maximum');
  await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));
  if(!process.env.SKIP_DAY){
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().lighting.surfaceArea.time==='day');await frames(3);
  report.day=await page.evaluate(()=>window.__miningValidation.snapshot());
  assert.equal(report.day.lighting.surfaceArea.activeLights,0);assert.equal(report.day.lighting.surfaceArea.activeShadowLights,0);
  const programs=await page.evaluate(()=>window.__shadowPrograms);
  assert.ok(programs.some(p=>p.spot===0&&p.directional===1&&p.spotLights===0&&p.pointLights===0));
  await page.screenshot({path:`${out}/day.png`});
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().lighting.surfaceArea.time==='night');await frames(3);
  assert.equal((await page.evaluate(()=>window.__miningValidation.snapshot())).lighting.surfaceArea.activeLights,12);
  console.log('day/night light list restored');
  await fs.writeFile(`${out}/day-report.json`,JSON.stringify({day:report.day,programs,errors:report.errors},null,2));
  }
  await page.evaluate(()=>window.__miningValidation.teleport([0,-80,0]));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.position[1]<-60&&!s.lighting.shadowEnabled;});
  await frames(2);report.shallow=await page.evaluate(()=>window.__miningValidation.snapshot());
  assert.equal(report.shallow.lighting.surfaceArea.active,false);assert.equal(report.shallow.lighting.sunCastsShadow,false);assert.equal(report.shallow.terrainVisuals.shadowReceivers,0);assert.equal(report.shallow.terrainVisuals.shadowCasters,0);
  console.log('80m shadow audit passed');
  await page.getByRole('button',{name:'返回地表',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.lighting.shadowEnabled&&s.lighting.surfaceArea.active;});
  await frames();report.returned=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(report.returned.lighting.sunCastsShadow,true);
  assert.deepEqual(report.errors,[]);
  await page.getByRole('button',{name:/^退出游戏/}).click();await page.waitForURL('https://w-sunjun-public.dev.clock-p.com/');report.exit=true;
  assert.equal(await page.locator('a[href$="games/mining-test/index.html"]').count(),1);assert.equal(await page.locator('a[href$="games/mining/index.html"]').count(),1);
 }finally{await fs.writeFile(`${out}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
