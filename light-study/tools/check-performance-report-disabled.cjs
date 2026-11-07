const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:585,height:982}});page.setDefaultTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html?timing=off',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.loading.error')||window.__lightStudy?.snapshot().ready&&document.querySelector('.loading')?.hidden);
  assert.equal(await page.locator('.loading.error').count(),0);
  await page.locator('.metrics-toggle').click();await page.locator('.report-performance').click();
  await page.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);
  const id=await page.locator('.report-status').getAttribute('data-report-id');
  const result=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+id+'.json','utf8'));
  assert.equal(result.report.device.timestampSupported,true);assert.equal(result.report.device.timestampEnabled,false);
  assert.equal(result.report.latestFrame.gpu,null);assert.equal(result.report.latestFrame.gpuPassSumMs,null);assert.equal(result.report.latestFrame.gpuOverlapMs,null);
  assert.ok(result.report.latestFrame.completionMs>0);assert.deepEqual(errors,[]);
  const output={passed:true,id,device:result.report.device,frame:result.report.latestFrame,build:result.report.build,errors};
  fs.writeFileSync(path.resolve(__dirname,'../artifacts/performance-report/timing-disabled.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
