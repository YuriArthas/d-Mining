// Public desktop smoke check for one authored layer. Usage: node tools/check-authored-room.cjs ruins
const {chromium}=require('../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const {CAMP_CONTENT}=await import('../src/game/content/campContent.ts');
 const id=process.argv[2],room=CAMP_CONTENT.rooms.find(r=>r.id===id),portal=CAMP_CONTENT.session.portals.find(p=>p.id===id);
 assert.ok(room?.sceneDefinition&&portal,'Expected an authored destination and a surface pad');
 const dir=`artifacts/${room.sceneDefinition.asset}`;await fs.mkdir(dir,{recursive:true});
 const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html',report={url,id,errors:[]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);
  page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url+'?debug=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('.loading-screen')&&window.__miningValidation?.snapshot().ready,undefined,{polling:500});
  const read=()=>page.evaluate(id=>{const s=window.__miningValidation.snapshot();return {position:s.position,ready:s.ready,grounded:s.grounded,economy:s.economy,room:s.facilities.authoredRooms[id]};},id);
  report.surface=await read();console.log(id+': surface loaded');assert.ok(report.surface.economy.destinations.find(d=>d.id===id).unlocked);
  const enter=async(destination=room,pad=portal)=>{
   await page.evaluate(p=>window.__miningValidation.teleport(p),[pad.zone.x+Math.sin(pad.yaw)*1.2,.25,pad.zone.z+Math.cos(pad.yaw)*1.2]);
   await page.waitForFunction(depth=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&Math.abs(s.position[1]+depth)<1},destination.depth,{polling:500});
  };
  await enter();report.arrival=await read();assert.equal(report.arrival.room.id,room.sceneDefinition.asset);console.log(id+': surface pad / arrival passed');
  await page.addStyleTag({content:'.validation-panel{display:none!important}'});
  await page.screenshot({path:dir+'/arrival.png'});console.log(id+': public screenshot saved');
  await page.evaluate(p=>window.__miningValidation.teleport(p),[room.sell.x,room.sell.y+.1,room.sell.z]);
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.economy.inSellZone},undefined,{polling:500});report.sale=await read();
  if(room.shop){
   await page.evaluate(p=>window.__miningValidation.teleport(p),[room.shop.x,room.shop.y+.1,room.shop.z]);
   await page.waitForFunction(id=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.economy.shopId===id},id,{polling:500});
   await page.getByRole('dialog',{name:'升级商店'}).waitFor();report.shop=await read();await page.getByRole('button',{name:'关闭升级界面'}).click();
  }
  await page.getByRole('button',{name:'返回地表',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]>-1},undefined,{polling:500});report.returned=await read();
  await enter();report.repeat=await read();console.log(id+': sale / shop if available / return / repeat passed');
  if(process.argv.includes('--tour')){
   report.tour=[];
   for(const destination of CAMP_CONTENT.rooms.filter(r=>r.scene)){
    await page.getByRole('button',{name:'返回地表',exact:true}).click();
    await page.waitForFunction(()=>{const s=window.__miningValidation.snapshot();return s.ready&&s.grounded&&s.position[1]>-1},undefined,{polling:500});
    await enter(destination,CAMP_CONTENT.session.portals.find(p=>p.id===destination.id));
    const state=await page.evaluate(id=>{const s=window.__miningValidation.snapshot();return {id,position:s.position,grounded:s.grounded,room:s.facilities.authoredRooms[id]?.id};},destination.id);
    assert.equal(state.room,destination.sceneDefinition.asset);report.tour.push(state);console.log('Final tour: '+destination.id+' passed');
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=String(e);throw e;}finally{await fs.writeFile(dir+'/public-check.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
