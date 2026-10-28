const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const dir=path.resolve('artifacts/shop-mobile-retry');await fs.mkdir(dir,{recursive:true});
 const report={tier:'Mobile Chromium emulation, landscape 640x320, Android UA, touch, SwiftShader; not physical device.',checks:[],errors:[]};
 const b=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-quic']});
 const p=await b.newPage({viewport:{width:640,height:320},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});p.setDefaultTimeout(90000);p.on('pageerror',e=>report.errors.push(e.message));
 let interrupted=false;await p.route(/\/showroom-[^/]+\.glb/,async route=>{if(!interrupted){interrupted=true;await route.abort('failed');}else await route.continue();});
 try{
  await p.goto('https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html?lang=zh&debug=1&submission=fenced&framesInFlight=1&saveTest=shop-retry-'+Date.now(),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:240000});
  await p.locator('.game-shell').evaluate(e=>{e.style.setProperty('--safe-left','24px');e.style.setProperty('--safe-right','18px');e.style.setProperty('--safe-top','4px');e.style.setProperty('--safe-bottom','8px');});
  await p.evaluate(()=>window.__miningValidation.teleport([-20,.1,-6.3]));await p.getByRole('dialog',{name:'商店分类',exact:true}).waitFor();
  for(const node of await p.locator('.shop-category,.shop-category-box,.shop-close').all()){const r=await node.boundingBox();assert.ok(r.x>=24&&r.y>=0&&r.x+r.width<=640-18&&r.y+r.height<=320-8);}
  await p.screenshot({path:path.join(dir,'01-short-phone-categories.png')});report.checks.push('All three category cards and close fit 640x320 plus safe area.');
  await p.locator('.shop-category[data-category=tools]').tap();await p.getByRole('alert').waitFor();assert.equal((await p.evaluate(()=>window.__mining.getShop())).ready,false);await p.screenshot({path:path.join(dir,'02-resource-error.png')});
  await p.getByRole('button',{name:'重新加载',exact:true}).tap();await p.waitForFunction(()=>{const s=window.__mining.getShop();return s.ready&&!s.error&&s.frames>2;});await p.evaluate(()=>document.querySelector('canvas').getContext('webgl2').finish());await p.screenshot({path:path.join(dir,'03-resource-recovered.png')});
  await p.getByRole('button',{name:'关闭商店',exact:true}).tap();await p.locator('.joystick').waitFor();assert.equal(await p.getByRole('dialog').count(),0);
  report.checks.push('Intentional showroom network failure displays Retry; retry renders the real 3D scene and close returns to game controls without page errors.');assert.deepEqual(report.errors,[]);report.ok=true;
 }catch(e){report.failure=String(e);await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e;}
 finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
