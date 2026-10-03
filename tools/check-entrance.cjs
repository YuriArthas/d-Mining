const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../../d-Block-Blast/node_modules/playwright');
const {PerspectiveCamera,Vector3}=require('../node_modules/three');
const {digCells}=require('./combat-browser.cjs');
(async()=>{
 const origin=process.argv[2]||'http://127.0.0.1:4175',hosted=process.argv[3]==='hosted',label=hosted?'entrance-public':'entrance-local';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),checks=[],errors=[];
 const layouts=[['desktop',{width:1120,height:630},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true],['compact',{width:640,height:320},true]];
 try{for(const [layout,viewport,touch] of layouts.filter(([name])=>!process.env.LAYOUTS||process.env.LAYOUTS.split(',').includes(name))){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));
  const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
  const ready=()=>page.waitForFunction(()=>{const s=window.__miningValidation?.snapshot();return s?.ready&&s.grounded&&!s.queue&&!s.inFlight&&!s.pendingEdit});
  const teleport=async p=>{await page.evaluate(p=>window.__miningValidation.teleport(p),p);await ready();await page.waitForTimeout(200)};
  const cdp=await page.context().newCDPSession(page),send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const press=async name=>{const b=page.getByRole('button',{name,exact:true});await(touch?b.tap():b.click())};
  const project=async point=>{const s=await snap(),rotated=viewport.height>viewport.width,w=rotated?viewport.height:viewport.width,h=rotated?viewport.width:viewport.height;
   const c=new PerspectiveCamera(55,w/h,.08,1000);c.position.fromArray(s.camera.position);c.lookAt(c.position.clone().sub(new Vector3(...s.camera.direction)));c.updateMatrixWorld();const v=new Vector3(...point).project(c),x=(v.x+1)*w/2,y=(1-v.y)*h/2;return {x:rotated?viewport.width-y:x,y:rotated?x:y,id:1};};
  const hold=async(point,until)=>{const p=await project(point);if(touch)await send('touchStart',[p]);else{await page.mouse.move(p.x,p.y);await page.mouse.down()}try{await until()}finally{if(touch)await send('touchEnd');else await page.mouse.up()}};
  const moveRight=async(until)=>{
   if(touch){const r=await page.locator('.joystick').boundingBox(),p={id:1,x:r.x+r.width/2,y:r.y+r.height/2};await send('touchStart',[p]);if(viewport.height>viewport.width)p.y+=40;else p.x+=40;await send('touchMove',[p]);try{await until()}finally{await send('touchEnd')}}
   else{await page.locator('.scene').focus();await page.keyboard.down('d');try{await until()}finally{await page.keyboard.up('d')}}
  };
  try{
   await page.goto(origin+(hosted?'/games/mining/index.html':'/')+'?debug=1');await ready();await page.addStyleTag({content:'.validation-panel,.input-monitor{display:none}'});
   const counts=await page.evaluate(()=>[-1,-201,-401].map(y=>{let n=0;for(let x=(y===-1?-48:-10);x<=(y===-1?51:9);x++)for(let z=(y===-1?-48:-10);z<=(y===-1?51:9);z++)if(window.__miningValidation.canMine([x,y,z]))n++;return n}));assert.deepEqual(counts,[64,64,64]);
   if(!touch){await page.locator('.scene').focus();await page.keyboard.down('w');await page.waitForFunction(()=>window.__miningValidation.snapshot().position[2]<7);await page.keyboard.up('w');await ready();assert.ok((await snap()).position[1]<.1)}
   for(const [depth,z] of [[0,-2],[400,0],[800,-2]]){
    const y=-depth/2-1,c=[3,y,z];await teleport([7,-depth+.1,z*2+1.5]);
    const before=await snap();await hold([9,-depth,z*2+.5],()=>page.waitForTimeout(650));
    assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),[4,y,z]),7);
    assert.equal((await snap()).economy.inventory.used,before.economy.inventory.used);
    assert.equal((await snap()).combat.damagedCells,before.combat.damagedCells);
    assert.equal((await snap()).target,null);
    await hold([7,-depth,z*2+.5],()=>page.waitForFunction(c=>window.__miningValidation.cell(c)===0,c));await ready();
    // Excavate a two-cell shaft and an adjoining cell immediately under the protected skin.
    await digCells(page,[[3,y-1,z],[4,y-1,z]]);await ready();await teleport([7,-depth-3.9,z*2+1]);
    await moveRight(()=>page.waitForFunction(()=>window.__miningValidation.snapshot().position[0]>9));await ready();
    const s=await snap();assert.ok(s.position[0]>8);assert.ok(s.position[1]<-depth-3.9);assert.equal(await page.evaluate(c=>window.__miningValidation.cell(c),[4,y,z]),7);
    await teleport([0,depth===0?2.1:-depth+.1,14]);
    await page.screenshot({path:`artifacts/${label}-${layout}-${depth}.png`});
   }
   await press('返回地表');await ready();await press('传送');const b=page.locator('.travel-list button').nth(1);await(touch?b.tap():b.click());await ready();
   let s=await snap();assert.ok(Math.abs(s.position[0])<.01&&Math.abs(s.position[2]-14)<.01);assert.ok(Math.abs(s.position[1]+800)<.05);
   assert.equal(await page.evaluate(()=>window.__miningValidation.cell([3,-401,-2])),0);assert.equal(await page.evaluate(()=>window.__miningValidation.cell([4,-401,-2])),7);
   const quote=s.economy.sale.coins;await teleport([-12,-799.9,12]);assert.equal((await snap()).economy.coins,quote);assert.equal((await snap()).economy.inventory.used,0);
   await teleport([9.5,-799.9,12]);await moveRight(()=>page.waitForFunction(()=>window.__miningValidation.snapshot().economy.shopId==='rest-800'));
   await page.getByRole('heading',{name:'升级商店',exact:true}).waitFor();await press('花费 5 金币升级');assert.equal((await snap()).economy.pickaxe.level,2);
   checks.push(`${layout}: exactly 64 aligned entrance cells on all floors; real ${touch?'touch':'mouse'} cannot damage skin and digs entry; actual movement expands sideways below one-cell skin; safe return/room travel; edits persist; moved sale and shop work`);
  }catch(e){await page.screenshot({path:`artifacts/${label}-${layout}-failure.png`});console.error(JSON.stringify({layout,snapshot:await snap().catch(()=>null),errors}));throw e}finally{await page.close()}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`artifacts/${label}-report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
