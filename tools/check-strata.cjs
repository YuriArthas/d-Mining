const {LAYERS}=require('../src/game/content/layers.ts');
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
   assert.deepEqual(kinds,LAYERS.slice(0,3).map(l=>[l.base,...l.ores.map(o=>o.kind)].sort()));
   assert.notEqual(await page.evaluate(()=>window.__miningValidation.cell([14,-1,-25])),6);
   const samples=[];
   for(const layer of LAYERS.slice(0,3)){
    const sample=await page.evaluate(({from,name,base})=>{
     const y=-from/2-1;
     for(let x=-3;x<=2;x++)for(let z=-3;z<=1;z++)if(window.__miningValidation.cell([x,y,z])===base)return {name,feet:[x*2+1,-from+.1,z*2+3],point:[x*2+1,-from,z*2+1],cell:[x,y,z],kind:base};
     throw Error('No base mineral at entry');
    },layer);samples.push(sample);
   }
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
   const damaged=await page.evaluate(c=>window.__miningValidation.health(c),samples[2].cell);
   await teleport('surface');await teleport(samples[2].feet);
   assert.equal(await page.evaluate(c=>window.__miningValidation.health(c),samples[2].cell),damaged);
   assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),samples[0].cell),0);
   if(layout==='desktop'){
    await digCells(page,[samples[2].cell]);await ready();const state=(await snap()).economy;
    assert.equal(state.inventory.items[oreDefinition(samples[2].kind).itemId],1);const quote=state.sale.coins;
    await teleport([-12,-799.9,12]);assert.equal((await snap()).economy.coins,quote);assert.equal((await snap()).economy.inventory.used,0);
   }
   assert.equal((await snap()).cellBytes,0);
   checks.push(`${layout}: production world without ore sample overrides; shallow/middle/deep mineral sets; layer labels; actual ${touch?'touch':'mouse'} hit uses intrinsic HP, volume and price; cross-layer reload preserves damage and excavation`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
