const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const {oreDefinition}=require('../src/game/application/items.ts');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'strata-public':'strata-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 const layouts=[['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]];
 try{for(const [layout,viewport,touch] of layouts.filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const teleport=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await ready();await page.waitForTimeout(300)};
  const cdp=await page.context().newCDPSession(page),send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const project=async point=>{const s=await snap(),rotated=viewport.height>viewport.width,w=rotated?viewport.height:viewport.width,h=rotated?viewport.width:viewport.height;
   const c=new PerspectiveCamera(55,w/h,.08,1000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();const v=new Vector3(...point).project(c),x=(v.x+1)*w/2,y=(1-v.y)*h/2;return {x:rotated?viewport.width-y:x,y:rotated?x:y,id:1};};
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   assert.equal((await snap()).generation.samples,false);assert.equal(await page.locator('.ore-samples').count(),0);
   const kinds=await page.evaluate(()=>[-50,-250,-450].map(y=>{const ids=new Set();for(let x=-48;x<=51;x++)for(let z=-48;z<=51;z++)ids.add(window.__miningValidation.cell([x,y,z]));return [...ids].sort()}));
   assert.deepEqual(kinds,[[1,3,4],[2,3,4,5],[2,4,5,6]]);
   assert.notEqual(await page.evaluate(()=>window.__miningValidation.cell([14,-1,-25])),6);
   const samples=[{name:'浅层矿区',feet:[11,.1,-1],point:[11,0,-3],cell:[5,-1,-2],kind:1},
    {name:'金矿层',feet:[11,-399.9,7],point:[11,-400,5],cell:[5,-201,2],kind:2},
    {name:'水晶矿层',feet:[51,-799.9,-17],point:[51,-800,-19],cell:[25,-401,-10],kind:5}];
   for(const sample of samples){
    await teleport(sample.feet);await page.locator('.stage-label').filter({hasText:sample.name}).waitFor();
    assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),sample.cell),sample.kind);
    const maximum=oreDefinition(sample.kind).maxHp,point=await project(sample.point);
    if(touch)await send('touchStart',[point]);else {await page.mouse.move(point.x,point.y);await page.mouse.down()}
    try{await page.waitForFunction(({cell,maximum})=>{const d=window.__miningValidation;return d.cell(cell)===0||d.health(cell)<maximum},{cell:sample.cell,maximum});
     if(sample.kind!==1){const item=oreDefinition(sample.kind);await page.getByTestId('target-value').filter({hasText:`体积 ${item.volume} · 售价 ${item.price} 金币`}).waitFor();}
    }finally{if(touch)await send('touchEnd');else await page.mouse.up()}
    await ready();
    await page.screenshot({path:`artifacts/${label}-${layout}-${sample.kind}.png`});
   }
   // Source, sparse HP and voxel edits survive crossing layers and loading again.
   const damaged=await page.evaluate(()=>window.__miningValidation.health([25,-401,-10]));
   await teleport('surface');await teleport(samples[2].feet);
   assert.equal(await page.evaluate(()=>window.__miningValidation.health([25,-401,-10])),damaged);
   assert.equal(await page.evaluate(()=>window.__miningValidation.cell([5,-1,-2])),0);
   if(layout==='desktop'){
    await digCells(page,[[25,-401,-10]]);await ready();const state=(await snap()).economy;
    assert.equal(state.inventory.items['ore.gold'],1);assert.equal(state.inventory.used,11);assert.equal(state.sale.coins,41);
    await teleport([36,-799.9,-24]);assert.equal((await snap()).economy.coins,41);assert.equal((await snap()).economy.inventory.used,0);
   }
   assert.equal((await snap()).cellBytes,0);
   checks.push(`${layout}: production world without ore sample overrides; shallow/middle/deep mineral sets; layer labels; actual ${touch?'touch':'mouse'} hit uses intrinsic HP, volume and price; cross-layer reload preserves damage and excavation`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
