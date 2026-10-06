// Run only after publishing the test entry. PLAYWRIGHT_MODULE may point to a local install.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1';
const endpoint='https://mining-log-sunjun-public.dev.clock-p.com';
const report={publicUrl:url,endpoint};
async function records(id){
 const dir='/var/lib/mining-log/'+new Date().toISOString().slice(0,10);
 try{return (await fs.readFile(dir+'/'+id+'.jsonl','utf8')).trim().split('\n').map(JSON.parse);}catch(e){if(e.code==='ENOENT')return [];throw e;}
}
async function persisted(id,type){
 for(let i=0;i<30;i++){
  const rows=await records(id);if(rows.some(e=>e.type===type))return rows;
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error('Missing persisted event '+type+' session '+id);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.setDefaultTimeout(180000);
  const failure=await browser.newPage({viewport:{width:960,height:540}});
  await failure.route('**/assets/main-*.js',r=>r.abort('failed'));
  await Promise.all([page.goto(url,{waitUntil:'domcontentloaded'}),failure.goto(url,{waitUntil:'domcontentloaded'})]);
  await failure.waitForFunction(()=>document.getElementById('boot-status')?.textContent==='暂时没能进入矿场');
  const failedId=await failure.evaluate(()=>window.__MINING_LOG__.sessionId);
  report.failedSession=failedId;report.failureText=await failure.locator('.boot-loading').innerText();
  assert.ok(!/诊断编号|dynamically imported|main-.*\.js/.test(report.failureText));
  assert.ok(await failure.locator('#boot-retry').isVisible());
  await persisted(failedId,'game.import-failed');
  console.log('Public early-import failure visible and persisted:',failedId);
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),undefined,{polling:500});
  report.normal=await page.evaluate(()=>({log:window.__MINING_LOG__.diagnostics(),ready:window.__miningValidation.snapshot().ready}));
  assert.notEqual(report.normal.log.sessionId,failedId);
  const rows=await persisted(report.normal.log.sessionId,'game.ready');
  const types=new Set(rows.map(e=>e.type));
  for(const type of ['boot.start','game.ui-mounted','game.module-evaluated','loading.phase','game.ready'])assert.ok(types.has(type),type);
  assert.equal(rows.filter(e=>/window.error|loading.error|promise.rejection/.test(e.type)).length,0);
  report.normal.eventTypes=[...types];
  console.log('Public normal startup persisted:',report.normal.log.sessionId);
  await page.close();
  await failure.unroute('**/assets/main-*.js');
  await failure.locator('#boot-retry').click();
  await failure.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),undefined,{polling:500});
  report.retrySession=await failure.evaluate(()=>window.__MINING_LOG__.sessionId);
  assert.notEqual(report.retrySession,failedId);await persisted(report.retrySession,'game.ready');
  console.log('Retry recovered and persisted:',report.retrySession);
  await failure.close();
  const disabled=await browser.newPage({viewport:{width:960,height:540}});
  disabled.setDefaultTimeout(180000);
  let requests=0;disabled.on('request',r=>{if(r.url().startsWith(endpoint))requests++;});
  await disabled.addInitScript(()=>window.__MINING_LOG_CONFIG__={enabled:false});
  await disabled.goto(url,{waitUntil:'domcontentloaded'});
  await disabled.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),undefined,{polling:500});
  report.disabled={requests,diagnostics:await disabled.evaluate(()=>window.__MINING_LOG__.diagnostics())};
  assert.equal(requests,0);assert.equal(report.disabled.diagnostics.enabled,false);
  report.passed=true;console.log('Disabled logger: game ready, zero log requests');
 }finally{
  await fs.mkdir('artifacts/mining-log',{recursive:true});
  await fs.writeFile('artifacts/mining-log/public-report.json',JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
