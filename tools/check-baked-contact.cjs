const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/baked-contact-v24';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={errors:[],states:[],environment:'public desktop software GPU; not device FPS proof'};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>setTimeout(()=>cb(t),400));
   const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram;window.__programs=[];window.__audit=null;let target=null;
   const bind=proto.bindFramebuffer;proto.bindFramebuffer=function(kind,value){if(kind===this.FRAMEBUFFER||kind===this.DRAW_FRAMEBUFFER)target=value;return bind.call(this,kind,value);};
   for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','texImage2D','texSubImage2D','compileShader']){
    const old=proto[key];proto[key]=function(...args){if(window.__audit){const name=key.startsWith('draw')?(target?'offscreen':'main'):key;window.__audit[name]=(window.__audit[name]??0)+1;}return old.apply(this,args);};
   }
   proto.linkProgram=function(program){link.call(this,program);const uniforms=[];for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++){const u=this.getActiveUniform(program,i);uniforms.push({name:u.name,type:u.type,size:u.size});}window.__programs.push(uniforms);};
  });
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1');
  await page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight;});
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  const frames=async(n=2)=>{const f=await page.evaluate(()=>window.__miningValidation.snapshot().frames);await page.waitForFunction(({f,n})=>window.__miningValidation.snapshot().frames>=f+n,{f,n});};
  const state=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  await page.evaluate(()=>{window.__miningValidation.teleport([0,.1,24]);window.__miningValidation.look(0,.52);});
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded;});await frames();
  report.on=await state();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));assert.equal(report.on.lighting.shadowEnabled,false);assert.equal(report.on.lighting.surfaceArea.activeShadowLights,0);assert.equal(report.on.facilities.surfaceDetails.bakedShadows.enabled,true);
  if(process.env.SHOTS)await page.screenshot({path:`${out}/mine-on.png`});
  await page.evaluate(()=>window.__audit={});
  await page.getByRole('button',{name:'关闭烘焙阴影',exact:true}).click();
  await page.waitForFunction(()=>!window.__miningValidation.snapshot().facilities.surfaceDetails.bakedShadows.enabled);await frames();
  report.off=await state();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));if(process.env.SHOTS)await page.screenshot({path:`${out}/mine-off.png`});
  await page.getByRole('button',{name:'开启烘焙阴影',exact:true}).click();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().facilities.surfaceDetails.bakedShadows.enabled);await frames();
  report.toggleCalls=await page.evaluate(()=>{const r=window.__audit;window.__audit=null;return r;});assert.equal(report.toggleCalls.offscreen??0,0);assert.equal(report.toggleCalls.compileShader??0,0);assert.equal(report.toggleCalls.texImage2D??0,0);assert.equal(report.toggleCalls.texSubImage2D??0,0);
  assert.equal(report.on.renderer.calls,report.off.renderer.calls);assert.equal(report.on.renderer.triangles,report.off.renderer.triangles);assert.deepEqual(report.on.renderer.bufferSize,report.off.renderer.bufferSize);
  report.programs=await page.evaluate(()=>window.__programs);
  assert.ok(report.programs.some(p=>p.some(u=>u.name==='campContact')));
  assert.ok(report.programs.every(p=>p.every(u=>u.type!==0x8b62&&!/ShadowMap/.test(u.name))));
  assert.deepEqual(report.errors,[]);console.log('bake on/off: no shadow samplers, no extra passes/uploads/compiles, same draw count');
 }finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
