const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');

// Public-only targeted evidence for the finite-size lantern shadow.
(async()=>{
  const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?light=night&study=both&view=wall';
  const dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/soft-shadow');
  fs.mkdirSync(dir,{recursive:true});
  const report={url,startedAt:new Date().toISOString(),errors:[],warnings:[],views:[],checks:[]};
  const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  let browser;
  try{
    browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
    page.setDefaultTimeout(180000);
    await page.addInitScript(()=>{
      const original=GPUDevice.prototype.createShaderModule;
      GPUDevice.prototype.createShaderModule=function(descriptor){
        const module=original.call(this,descriptor);
        module.getCompilationInfo().then(info=>{for(const message of info.messages)if(message.type==='error')console.error('WGSL '+descriptor.label+': '+message.message+' at '+message.lineNum+':'+message.linePos);});
        return module;
      };
    });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>document.querySelector('.loading.error')||(window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden),null,{timeout:240000});
    if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
    const debug=(method,...args)=>page.evaluate(({method,args})=>window.__lightStudy[method](...args),{method,args});
    const snap=()=>debug('snapshot');
    const shot=async name=>{
      await debug('draw');
      await debug('capture',true);
      const s=await snap();
      assert.deepEqual(s.errors,[]);assert.deepEqual(report.errors,[]);
      assert.equal(s.lighting.lamp.shadowNeedsUpdate,false);
      await page.screenshot({path:path.join(dir,name+'.png'),timeout:120000});
      report.views.push({name,...s});save();console.log('Captured',name);
      return s;
    };
    const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.src));
    report.bundles=[];
    for(const source of scripts){const response=await page.request.get(source);assert.ok(response.ok());const bytes=await response.body();report.bundles.push({url:source,sha256:createHash('sha256').update(bytes).digest('hex')});}
    const wall=await shot('wall');
    assert.equal(wall.lighting.lamp.filter,'contact-hardening PCSS');
    assert.equal(wall.lighting.lamp.sourceRadius,.22);
    if(process.env.WALL_ONLY!=='1'&&process.env.RUNTIME_ONLY!=='1'){
      await debug('view','courtyard');await shot('courtyard');
      await debug('view','ground');await shot('ground');
      await debug('orbit',[9,5,-9],[-.5,1,0]);await shot('rear');
      await debug('view','wall');await debug('ao',false);await shot('wall-no-ao');
      await debug('ao',true);const restored=await shot('wall-restored');
      assert.equal(restored.lighting.shadowInvalidations,wall.lighting.shadowInvalidations);
      assert.equal(restored.render.frameCalls,8);
      const before=await snap();await page.waitForTimeout(2000);const after=await snap();
      assert.equal(after.submitted,before.submitted);
      report.checks.push('Camera and AO changes reuse shadows; AO restoration is stable; idle submits no frames');
    }
    if(process.env.RUNTIME_ONLY==='1'){
      await debug('draw');const restored=await snap();
      report.profile=[];
      for(const soft of [false,true]){
        await debug('softShadows',soft);await debug('draw');
        const warm=await snap();
        assert.equal(warm.lighting.lamp.filter,soft?'contact-hardening PCSS':'PCF');
        assert.equal(warm.lighting.shadowInvalidations,restored.lighting.shadowInvalidations);
        const frames=[];
        for(let i=0;i<3;i++){
          await debug('draw');const s=await snap();
          assert.equal(s.render.frameCalls,8);assert.equal(s.render.drawCalls,42);
          assert.equal(s.lighting.lamp.shadowNeedsUpdate,false);
          assert.equal(s.gpuSampleFrame,s.submitted);
          frames.push({frame:s.submitted,cpu:s.cpuSubmitMs,gpu:s.gpuMs,render:s.render,memory:s.memory});
        }
        report.profile.push({soft,viewport:warm.viewport,camera:warm.camera,adapter:warm.adapter,frames});
        await shot(soft?'wall-soft':'wall-hard');
      }
      report.checks.push('Same-light hard/soft comparison changes only shadow filtering; three exact warm frames each use cached maps and 42 draws / 8 passes');
      for(const mode of ['day','golden','night']){
        await debug('light',mode);await debug('draw');const s=await snap();
        assert.equal(s.lighting.mode,mode);
        assert.equal(s.lighting.lamp.filter,mode==='night'?'contact-hardening PCSS':'PCF');
        assert.deepEqual(s.errors,[]);
      }
      await shot('wall-night-restored');
      await debug('view','courtyard');await debug('study','baseline');
      await debug('draw');
      const baseline=await shot('baseline');assert.equal(baseline.lighting.lamp.filter,'PCF');
      assert.equal(baseline.render.frameCalls,6);
      report.checks.push('Day/golden/baseline use original PCF; focused night restores after camera.far changes; baseline screenshot recorded');
    }
    report.checks.push('Public bundle, finite-source settings and screenshots recorded without page/GPU errors');
    report.completedAt=new Date().toISOString();save();
  }catch(error){report.failure=String(error.stack||error);save();throw error;}
  finally{if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
