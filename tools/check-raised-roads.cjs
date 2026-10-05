// Public desktop regression: real linked programs must fit a 16-unit WebGL2 GPU,
// even when the validation software GPU offers 32. Never infer this from pixels alone.
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const out='artifacts/raised-roads-v6';await fs.mkdir(out,{recursive:true});
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
  await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,38]);window.__miningValidation.look(0,.35)});
  await page.waitForFunction(()=>window.__miningValidation.snapshot().grounded);
  await page.locator('.scene').focus();await page.keyboard.down('d');
  try{await page.waitForFunction(()=>window.__miningValidation.snapshot().position[0]>6,null,{polling:300});}finally{await page.keyboard.up('d');}
  report.crossCurbToGrass=await page.evaluate(()=>window.__miningValidation.snapshot().position);
  await page.keyboard.down('a');
  try{await page.waitForFunction(()=>window.__miningValidation.snapshot().position[0]<.5,null,{polling:300});}finally{await page.keyboard.up('a');}
  report.crossCurbToRoad=await page.evaluate(()=>window.__miningValidation.snapshot().position);

  for(const [name,position,yaw,pitch] of [['arrival',[0,.1,38],0,.35],['junction',[0,.1,30],.6,.65],['services',[0,.1,38],Math.PI,.42]].filter(([name])=>!process.env.VIEW_NAMES||process.env.VIEW_NAMES.split(',').includes(name))){
   await page.evaluate(({position,yaw,pitch})=>{window.__miningValidation.teleport(position);window.__miningValidation.look(yaw,pitch)},{position,yaw,pitch});
   await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight});
   const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
   await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+3,frame);
   if(!process.env.SHOT_NAMES||process.env.SHOT_NAMES.split(',').includes(name))await page.screenshot({path:`${out}/${name}.png`});
   report.views.push({name,state:await page.evaluate(()=>window.__miningValidation.snapshot())});console.log('captured',name);
  }
  assert.equal((await page.evaluate(()=>window.__miningValidation.snapshot())).startup.sky.time,'night');
  await page.getByRole('button',{name:'切换到白天',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='day');
  const night=report.views.at(-1).state;assert.equal(night.facilities.surfaceDetails.windowEmissiveIntensity,2.5);assert.equal(night.facilities.surfaceDetails.pendantEmissiveMultiplier,1);
  const day=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(day.facilities.surfaceDetails.windowEmissiveIntensity,0);assert.equal(day.facilities.surfaceDetails.pendantEmissiveMultiplier,0);assert.equal(day.lighting.surfaceArea.intensity,0);report.day=day;
  const frame=await page.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);
  await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>=n+2,frame);
  await page.screenshot({path:`${out}/roads-day.png`});
  await page.getByRole('button',{name:'切换到夜晚',exact:true}).click();await page.waitForFunction(()=>window.__miningValidation.snapshot().startup.sky.time==='night');
  const restored=await page.evaluate(()=>window.__miningValidation.snapshot());assert.equal(restored.startup.sceneAttachMs,night.startup.sceneAttachMs);assert.ok(restored.position.every((v,i)=>Math.abs(v-night.position[i])<.01));report.togglePreservesScene=true;assert.equal(restored.facilities.surfaceDetails.windowEmissiveIntensity,2.5);
  for(const v of report.views){const d=v.state.facilities.surfaceDetails;assert.equal(d.grassInstances,780);assert.ok(d.grassDrawCalls>0&&d.grassDrawCalls<=12);assert.ok(d.grassTriangles<=22000);assert.ok(d.grassBufferBytes<100000);}report.restored=restored;
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
