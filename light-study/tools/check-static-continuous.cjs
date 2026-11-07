const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const before=process.argv[2]==='before',dir=path.resolve(__dirname,'../artifacts/static-continuous',before?'before':'after');fs.mkdirSync(dir,{recursive:true});
const result={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-light/index.html'+(before?'?motion=off':'?loop=demand'),errors:[],responses:[]};
const save=()=>fs.writeFileSync(path.join(dir,'check.json'),JSON.stringify(result,null,2)+'\n');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
try{const p=await browser.newPage({viewport:{width:960,height:640}});p.setDefaultTimeout(180000);
p.on('pageerror',e=>result.errors.push(String(e)));p.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push(m.text());});
p.on('response',r=>{const h=r.headers();result.responses.push({url:r.url(),status:r.status(),contentLength:Number(h['content-length']||0),encoding:h['content-encoding']||'identity'});});
await p.goto(result.url);await p.waitForFunction(()=>document.querySelector('.loading.error')||document.querySelector('.loading')?.hidden);assert.equal(await p.locator('.loading.error').count(),0);
await p.evaluate(()=>window.__lightStudy.draw());result.snapshot=await p.evaluate(()=>window.__lightStudy.snapshot());
assert.equal(result.snapshot.movingLantern.mode,'off');await p.evaluate(()=>window.__lightStudy.capture(true));await p.screenshot({path:path.join(dir,'static.png')});await p.evaluate(()=>window.__lightStudy.capture(false));save();console.log('static screenshot',before?'before':'after');
if(!before){
 await p.evaluate(()=>{window.__lightStudy.loop(true);});let start=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);await p.waitForFunction(n=>window.__lightStudy.snapshot().submitted>=n+3,start);
 result.continuous=await p.evaluate(()=>window.__lightStudy.snapshot());assert.equal(result.continuous.renderLoop,'continuous');assert.equal(result.continuous.movingLantern.seconds,0);assert.ok(result.continuous.cadence.fps>0);
 await p.locator('.metrics-toggle').click();await p.locator('.benchmark-performance').click();await p.waitForFunction(()=>document.querySelector('.report-status').dataset.reportId);result.reportId=await p.locator('.report-status').getAttribute('data-report-id');
 const r=JSON.parse(fs.readFileSync('/root/threejs_space/d-game1/data/mining-light-reports/'+result.reportId+'.json')).report;result.benchmark=r.scene.benchmark;result.build=r.build;assert.equal(result.benchmark.type,'static-continuous');assert.equal(result.benchmark.context.motion,'off');assert.equal(result.benchmark.seconds,30);assert.ok(result.benchmark.frameCount>=2);assert.ok(result.benchmark.gpuFrames.every(f=>!f.gpuPasses.some(p=>p.label.startsWith('Moving shadow'))));
 await p.evaluate(()=>window.__lightStudy.loop(false));start=await p.evaluate(()=>window.__lightStudy.snapshot().submitted);await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>window.__lightStudy.snapshot().submitted),start);console.log(JSON.stringify({reportId:result.reportId,benchmark:result.benchmark}));
}
assert.deepEqual(result.errors,[]);result.passed=true;save();}finally{await browser.close();save();}
})().catch(e=>{result.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
