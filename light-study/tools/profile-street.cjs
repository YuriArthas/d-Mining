const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
(async()=>{
const dir=path.resolve(__dirname,process.env.ARTIFACT_DIR||'../artifacts/night-profile');fs.mkdirSync(dir,{recursive:true});
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?light=night'+(process.env.QUERY||'');
const report={url,startedAt:new Date().toISOString(),errors:[],warnings:[],bundles:[],profiles:[]};const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));let browser;
try{
 browser=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(240000);const scripts=new Set();page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))scripts.add(r.url());});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
 await page.addInitScript(()=>{window.__shaders=[];const original=GPUDevice.prototype.createShaderModule;GPUDevice.prototype.createShaderModule=function(d){window.__shaders.push({label:d.label,code:d.code});const m=original.call(this,d);m.getCompilationInfo().then(i=>{for(const e of i.messages)if(e.type==='error')console.error('WGSL '+e.message);});return m;};});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.querySelector('.loading.error')||(window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden),null,{timeout:240000});if(await page.locator('.loading.error').count())throw Error(await page.locator('.loading.error').innerText());
 const call=(method,...args)=>page.evaluate(({method,args})=>window.__lightStudy[method](...args),{method,args});
 for(const source of scripts){const r=await page.request.get(source);assert.ok(r.ok());report.bundles.push({url:source,sha256:createHash('sha256').update(await r.body()).digest('hex')});}
 await call('capture',true);await call('draw');
 const profile=async name=>{const frames=[];for(let i=0;i<Number(process.env.SAMPLES||2);i++){await call('draw');const s=await call('snapshot');assert.equal(s.gpuSampleFrame,s.submitted);assert.deepEqual(s.errors,[]);assert.deepEqual(report.errors,[]);frames.push(s);console.log(name+' frame '+s.submitted+': '+s.gpuMs+' ms; '+JSON.stringify(s.gpuPasses));}await page.screenshot({path:path.join(dir,name+'.png'),timeout:120000});report.profiles.push({name,frames});save();};
 await profile('full');
 if(process.env.SHADOW_ONLY){await call('softShadows',false);await profile('hard-shadow');}
 else if(!process.env.FULL_ONLY){await call('ao',false);await profile('without-ao');await call('softShadows',false);await profile('without-ao-hard-shadow');}
 const shaders=await page.evaluate(()=>window.__shaders);fs.mkdirSync(path.join(dir,'shaders'),{recursive:true});shaders.forEach((s,i)=>fs.writeFileSync(path.join(dir,'shaders',i+'.wgsl'),'// '+s.label+'\n'+s.code));report.shaders=shaders.map((s,i)=>({file:i+'.wgsl',label:s.label,bytes:s.code.length}));
 assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();save();
}catch(e){report.failure=String(e.stack||e);save();throw e;}finally{if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
