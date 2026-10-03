const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'reach-public':'reach-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[];
 const page=await browser.newPage({viewport:{width:1120,height:630}});page.on('pageerror',e=>errors.push(e.message));
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 try{
  await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');
  await page.waitForFunction(()=>window.__miningValidation?.snapshot().ready);
  await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
  await page.evaluate(()=>window.__miningValidation.teleport([22,.1,-47]));
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&!s.queue&&!s.inFlight});await page.waitForTimeout(250);
  const s=await snap(),camera=new PerspectiveCamera(55,1120/630,.08,1000);camera.position.fromArray(s.camera.position);camera.lookAt(camera.position.clone().sub(new Vector3(...s.camera.direction)));camera.updateMatrixWorld();
  const project=p=>{const v=new Vector3(...p).project(camera);return [(v.x+1)*560,(1-v.y)*315]};
  await page.mouse.move(...project([29,0,-49]));await page.waitForFunction(()=>window.__miningValidation.snapshot().target?.join(',')==='14,-1,-25');
  await page.mouse.click(...project([29,0,-49]));await page.waitForFunction(()=>window.__miningValidation.health([14,-1,-25])===340);
  await page.screenshot({path:`artifacts/${label}-inside.png`});
  await page.mouse.move(...project([31,0,-49]));await page.waitForFunction(()=>window.__miningValidation.snapshot().target===null);
  await page.waitForTimeout(550);await page.mouse.click(...project([31,0,-49]));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__miningValidation.health([15,-1,-25])),350);assert.deepEqual(errors,[]);
  const checks=['actual mouse strike reaches surface about 7.35m from hand (previously out of reach)','surface beyond 8m is not selected and takes no damage'];
  await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
