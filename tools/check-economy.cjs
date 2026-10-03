const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {digCells,totals}=require('./combat-browser.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'economy-public':'economy-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1120,height:630}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 page.setDefaultTimeout(20000);
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&!s.queue&&!s.inFlight&&!s.pendingEdit&&s.grounded},null,{timeout:30000});
 try{
  await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1&samples=1');await ready();
  assert.equal((await snap()).economy.inventory.used,0);await page.screenshot({path:`artifacts/${label}-surface.png`});
  await page.evaluate(()=>window.__miningValidation.teleport([41,.1,-19]));await ready();await page.waitForTimeout(350);
  const state=await snap(),camera=new PerspectiveCamera(55,1120/630,.08,1000);camera.position.fromArray(state.camera.position);camera.lookAt(camera.position.clone().sub(new Vector3(...state.camera.direction)));camera.updateMatrixWorld();
  const projected=new Vector3(43,0,-19).project(camera),point={x:(projected.x+1)*560,y:(1-projected.y)*315};
  await page.mouse.move(point.x,point.y);await page.waitForFunction(()=>JSON.stringify(window.__miningValidation.snapshot().target)==='[21,-1,-10]');
  await page.mouse.down();await page.waitForFunction(()=>window.__miningValidation.cell([21,-1,-10])===0);await page.mouse.up();await ready();
  await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.inventory.used===1);checks.push('real mouse mining credits one item');
  for(const cell of Array.from({length:49},(_,i)=>[i%16,-3,-25+Math.floor(i/16)])) {if((await snap()).economy.inventory.isFull)break;await digCells(page,[cell]);}await ready();
  const full=await snap(),expected=totals(full.economy.inventory.items);assert.equal(full.economy.inventory.used,expected.used);assert.equal(full.committedEdits,expected.count);assert.ok(full.economy.inventory.isFull);
  assert.ok(Object.keys(full.economy.inventory.items).length>=3);await page.getByTestId('bag-count').filter({hasText:`${expected.used}/50`}).waitFor();
  const untouched=await page.evaluate(()=>window.__miningValidation.cell([0,-3,-21]));assert.ok(untouched);
  assert.equal(await page.evaluate(()=>window.__miningValidation.mine([0,-3,-21])),false);assert.equal(await page.evaluate(()=>window.__miningValidation.cell([0,-3,-21])),untouched);
  checks.push('weighted mining reaches full capacity; next mining request blocked');await page.screenshot({path:`artifacts/${label}-full.png`});
  await page.getByRole('button',{name:'返回地表',exact:true}).click();await ready();
  assert.equal((await snap()).economy.inventory.used,expected.used);assert.equal((await snap()).economy.coins,0);assert.equal((await snap()).economy.inSellZone,false);
  await page.keyboard.down('d');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[0]>1.8);await page.keyboard.up('d');
  await page.keyboard.down('s');await page.waitForFunction(n=>window.__miningValidation.snapshot().economy.coins===n,expected.coins);await page.keyboard.up('s');
  assert.equal((await snap()).economy.inventory.used,0);await page.waitForTimeout(300);assert.equal((await snap()).economy.coins,expected.coins);
  checks.push('return preserves quantities; walking into ring sells once at per-item prices');await page.screenshot({path:`artifacts/${label}-sold.png`});
  await page.evaluate(()=>window.__miningValidation.teleport([41,.1,-19]));await ready();
  await digCells(page,[[0,-3,-21]]);await ready();assert.equal((await snap()).economy.inventory.used,1);
  checks.push('mining resumes after sale');
  // Deep travel does not trigger the surface sale; exact vertical gate is unit-tested.
  await page.evaluate(()=>window.__miningValidation.teleport('deep'));await ready();assert.equal((await snap()).economy.coins,expected.coins);
  checks.push('deep mine travel does not trigger surface sale');
  assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,snapshot:await snap(),errors},null,2));
  console.log(JSON.stringify({checks,errors}));
 }catch(e){await page.screenshot({path:`artifacts/${label}-failure.png`});console.error(JSON.stringify({snapshot:await snap().catch(()=>null),errors}));throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
