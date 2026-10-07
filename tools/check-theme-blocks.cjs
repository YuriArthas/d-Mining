// Public desktop verification after publish-preview; no local game server.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs = require('node:fs/promises'), assert = require('node:assert/strict');
(async () => {
 const { LAYERS } = await import('../src/game/content/layers.ts');
 const { RESOURCES } = await import('../src/game/content/resources.ts');
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page = await browser.newPage({viewport:{width:960,height:540}});
 page.setDefaultTimeout(90000);
 const dir='artifacts/theme-blocks', report={url:'https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1',errors:[],views:[]};
 await fs.mkdir(dir,{recursive:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const snapshot=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=()=>page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&window.__miningValidation.snapshot().grounded&&!document.querySelector('.loading-screen'));
 try {
  await page.goto(report.url,{waitUntil:'domcontentloaded'}); await ready();
  await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1}); const gl=document.querySelector('canvas').getContext('webgl2');window.__testFlush=setInterval(()=>gl.flush(),80);});
  assert.equal((await snapshot()).generation.version,8);
  report.distribution=await page.evaluate(layers=>layers.map((layer,i)=>{
   const counts={};for(const depth of [layer.from,layer.from+80,(layers[i+1]?.from??4000)-2]){
    const y=-depth/2-1;
    for(let x=20;x<40;x++)for(let z=20;z<40;z++){const kind=window.__miningValidation.cell([x,y,z]); if(kind!==7)counts[kind]=(counts[kind]||0)+1;}
   }
   return {id:layer.id,base:layer.base,counts};
  }),LAYERS);
  const bases=new Set(RESOURCES.filter(r=>r.base).map(r=>r.kind));
  for(const row of report.distribution){assert.ok(row.counts[row.base]>0);for(const kind of Object.keys(row.counts).map(Number))if(bases.has(kind))assert.equal(kind,row.base);}
  console.log('All ten layers: boundary and interior theme blocks exclusive');
  for(const layer of LAYERS.slice(0,2)){
   await page.evaluate(depth=>{window.__miningValidation.teleport([0,-depth+.1,11]);window.__miningValidation.look(0,.45);},layer.from); await ready();
   const before=(await snapshot()).renderer.submission.submitted;
   await page.waitForFunction(n=>window.__miningValidation.snapshot().renderer.submission.submitted>n+2,before);
   await page.screenshot({path:`${dir}/${layer.id}.png`});
   const target=await page.evaluate(({from,base})=>{
    for(let y=-from/2-1;y>=-from/2-3;y--)for(let z=3;z>=1;z--)for(let x=-1;x<=1;x++){
     const cell=[x,y,z]; if(window.__miningValidation.cell(cell)===base&&window.__miningValidation.canMine(cell))return cell;
    }
   },layer);
   assert.ok(target,'theme block within mining reach');
   const hit=await page.evaluate(cell=>window.__miningValidation.hit(cell),target);
   assert.equal(hit.status,'breaking');
   await page.waitForFunction(cell=>window.__miningValidation.cell(cell)===0,target);
   const resource=RESOURCES.find(r=>r.kind===layer.base);
   await page.waitForFunction(id=>window.__miningValidation.snapshot().economy.inventory.items[id]===1,resource.itemId);
   report.views.push({id:layer.id,target,hit,item:resource.itemId});
   console.log(layer.id+': rendered, mined and collected '+resource.name);
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 } finally {await fs.writeFile(`${dir}/public-report.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
