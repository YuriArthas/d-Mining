// Desktop public test only. Run after publish:preview; uses an isolated save and real mining/sale funds.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '../../d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const dir=require('node:path').resolve(__dirname,'../artifacts/attack-speed');await fs.mkdir(dir,{recursive:true});
 const url=`https://w-sunjun-public.dev.clock-p.com/games/mining-test/index.html?debug=1&saveTest=attack-${Date.now()}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1120,height:700},deviceScaleFactor:1});page.setDefaultTimeout(60000);
 const report={url,checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
 const snap=()=>page.evaluate(()=>window.__miningValidation.snapshot());
 const ready=()=>page.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:180000,polling:500});
 const press=name=>page.getByRole('button',{name,exact:true}).click();
 const travel=async t=>{await page.evaluate(t=>window.__miningValidation.teleport(t),t);await ready();await page.waitForFunction(()=>window.__miningValidation.snapshot().grounded,null,{timeout:60000});};
 try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();console.log('ready');
 await page.evaluate(()=>{window.__miningValidation.performance({submission:'fenced',framesInFlight:1});const gl=document.querySelector('canvas').getContext('webgl2');setInterval(()=>gl.flush(),100);});
 await press('升级');assert.equal((await snap()).economy.pickaxe.speed,2);
 for(let level=1;level<6;level++)await press(`花费 ${5+(level-1)*2} 金币升级`);assert.equal((await snap()).economy.pickaxe.speed,4);
 report.checks.push('real upgrade button increases speed from 2 to 4 at level6');
 for(let level=6;level<13;level++)await press(`花费 ${5+(level-1)*2} 金币升级`);
 assert.equal((await snap()).economy.pickaxe.speed,8);await press('关闭升级界面');console.log('level13');
 await travel('deep');console.log('deep', (await snap()).position);
 const targets=await page.evaluate(()=>{const out=[];for(let y=-1801;y>=-1810;y--)for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(window.__miningValidation.cell([x,y,z])===31)out.push([x,y,z]);return out.slice(0,2);});assert.equal(targets.length,2);console.log('targets',targets);
 for(const cell of targets){
   const end=Date.now()+30000;
   while(await page.evaluate(c=>window.__miningValidation.cell(c),cell)){
     if(Date.now()>end)throw Error('Mining timeout');
     await page.evaluate(c=>window.__miningValidation.hit(c),cell);await page.waitForTimeout(85);
   }
 }
 const afterMine=(await snap()).economy;assert.equal(afterMine.inventory.items['ore.core_crystal'],2);report.checks.push('real terrain mining awards two core crystals using level13 stats');console.log('mined');
 const sell=(await snap()).sellZone;await travel([sell.x,sell.y,sell.z]);
 await page.waitForFunction(()=>window.__miningValidation.snapshot().economy.coins===538);
 await travel('deep');await press('升级');
 for(let level=13;level<21;level++)await press(`花费 ${5+(level-1)*2} 金币升级`);
 const stats=(await snap()).economy.pickaxe;assert.equal(stats.speed,16);assert.equal(stats.power,220);assert.equal(stats.overflowPower,110);
 assert.match(await page.locator('.speed-step').innerText(),/已计入 \+110/);
 report.checks.push('mining and sale fund level21; capped 16 attacks/sec and converted 220 power appear in UI');
 await page.screenshot({path:dir+'/upgrade-level21.png',timeout:30000});console.log('screenshot');await press('关闭升级界面');
 const target=await page.evaluate(()=>{for(let y=-1801;y>=-1810;y--)for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(window.__miningValidation.cell([x,y,z])===31)return [x,y,z];});
 const hp=await page.evaluate(c=>window.__miningValidation.health(c),target);
 const hit=await page.evaluate(c=>window.__miningValidation.hit(c),target);assert.equal(hit.damage,220);assert.equal(hit.remaining,hp-220);
 report.checks.push('converted power actually removes 220 HP from real terrain');
 await page.evaluate(()=>window.__miningSave.flush());await page.reload({waitUntil:'domcontentloaded'});await ready();
 assert.equal((await snap()).economy.pickaxe.level,21);assert.equal((await snap()).economy.pickaxe.power,220);report.checks.push('saved level restores with converted power after reload');
 report.stats=stats;assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
 }catch(e){report.failure=String(e);report.snapshot=await snap().catch(()=>null);throw e;}
 finally{await fs.writeFile(dir+'/public-report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
