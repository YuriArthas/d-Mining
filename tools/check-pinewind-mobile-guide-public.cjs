const {chromium}=require('/root/threejs_space/d-Block-Blast/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-surface-play/index.html',dir=path.resolve('artifacts/pinewind-mobile-guide-public');
(async()=>{
 await fs.mkdir(dir,{recursive:true});
 const report={url,startedAt:new Date().toISOString(),tier:'Mobile Chromium emulation / Android UA / touch / 844x390 landscape / DPR 2 / SwiftShader, not physical phone',scope:'Final follow-up to the full mobile flow; only dynamic mine hint wording changed in this release.',checks:[],errors:[]};
 const b=await chromium.launch({args:['--no-sandbox','--disable-quic','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});p.setDefaultTimeout(60000);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const ready=()=>p.waitForFunction(()=>window.__miningValidation?.snapshot().ready&&!document.querySelector('.loading-screen'),null,{timeout:240000});
 const draw=async()=>{const n=await p.evaluate(()=>window.__miningValidation.snapshot().renderer.submission.submitted);await p.waitForFunction(n=>{document.querySelector('canvas').getContext('webgl2').finish();return window.__miningValidation.snapshot().renderer.submission.submitted>=n+2;},n,{timeout:120000,polling:300});};
 const shot=async name=>{await draw();await p.screenshot({path:path.join(dir,name+'.png'),timeout:60000});console.log('SHOT',name);};
 try{
  await p.goto(url+'?debug=1&submission=fenced&framesInFlight=1&saveTest=phone-guide-'+Date.now(),{waitUntil:'domcontentloaded'});await ready();
  report.loadedScripts=await p.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
  await p.evaluate(()=>{window.__miningValidation.teleport([0,.1,4]);window.__miningValidation.look(0,.65);});await ready();await draw();
  await p.waitForFunction(()=>document.querySelector('.guide-dig-marker')?.dataset.hasTarget==='true');
  assert.equal(await p.locator('.guide-dig-caption').innerText(),'长按这里挖矿');
  assert.ok(!(await p.locator('.guide-card').innerText()).match(/鼠标|左键|右键|WASD/));
  await shot('01-touch-mine-hint');report.checks.push('Final public phone build: targeted block caption remains touch-specific after multiple rendered frames.');
  await p.evaluate(()=>window.__miningValidation.look(0,-.55));await draw();
  await p.waitForFunction(()=>document.querySelector('.guide-dig-marker')?.dataset.hasTarget==='false');
  assert.equal(await p.locator('.guide-dig-caption').innerText(),'拖动观察，寻找可挖方块');
  await shot('02-touch-search-hint');report.checks.push('No visible mine target: guidance says drag to look, with no mouse/right-click instruction.');
  await p.getByRole('button',{name:'返回地表',exact:true}).tap();await ready();await p.evaluate(()=>window.__miningValidation.look(0,.22));await shot('03-phone-landscape-final');
  await p.getByRole('button',{name:'操作帮助',exact:true}).tap();await p.getByRole('dialog').waitFor();
  const c=await p.context().newCDPSession(p),r=await p.locator('.guide-help p').first().boundingBox();
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+30,y:r.y+10,id:1}]});await p.waitForTimeout(850);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await p.evaluate(()=>getSelection().toString()),'');
  await p.getByRole('button',{name:'关闭操作帮助',exact:true}).tap();
  assert.equal(await p.locator('.hud-settings').evaluate(e=>e.open),false);assert.equal(await p.locator('.hud-debug-tools').evaluate(e=>e.open),false);
  report.checks.push('Final DPR-2 phone follow-up: long-press has no text selection, and closing Help does not click through to settings/debug.');
  assert.deepEqual(report.errors,[]);console.log('PASS',report.checks.length,'final phone checks');
 }catch(e){report.failure=String(e);await p.screenshot({path:path.join(dir,'failure.png'),timeout:30000}).catch(()=>{});throw e;}
 finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
