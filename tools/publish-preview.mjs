import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('..',import.meta.url));
const source=join(project,'dist'),host=resolve(project,'../d-game1/dist'),destination=join(host,'games/mining-test');
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-test/';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const stable=()=>Object.fromEntries(files(join(host,'games/mining')).sort().map(p=>[relative(host,p),hash(p)]));
if(!existsSync(join(source,'index.html')))throw new Error('Build Mining first.');
const launcher=readFileSync(join(host,'index.html'),'utf8');
const scripts=[...launcher.matchAll(/src="\.\/(assets\/[^\"]+\.js)"/g)].map(m=>readFileSync(join(host,m[1]),'utf8'));
if(!scripts.some(s=>s.includes('games/mining-test/index.html')))throw new Error('Publish the Mining 测试版 launcher entry first.');
const before=stable();
for(const p of files(source)){
 const name=relative(source,p);if(name==='index.html')continue;
 const target=join(destination,name);mkdirSync(dirname(target),{recursive:true});cpSync(p,target);
}
cpSync(join(source,'index.html'),join(destination,'index.html.next'));renameSync(join(destination,'index.html.next'),join(destination,'index.html'));
if(JSON.stringify(stable())!==JSON.stringify(before))throw new Error('Stable Mining was modified unexpectedly.');
const verified=[];
const verificationDirectory=mkdtempSync(join(tmpdir(),'mining-public-hash-'));
try{
for(const p of files(source)){
 const name=relative(source,p),expected=hash(p),download=join(verificationDirectory,'download');
 // Use the public HTTP/2 route and stream large assets to disk for verification.
 execFileSync('curl',['--fail','--silent','--show-error','--retry','2','--max-time','120','--output',download,url+name+'?verify='+expected.slice(0,12)]);
 const actual=hash(download);
 if(actual!==expected)throw new Error(`Public preview hash mismatch: ${name}`);
 verified.push({file:name,sha256:expected});
}
}finally{rmSync(verificationDirectory,{recursive:true,force:true});}
mkdirSync(join(project,'artifacts'),{recursive:true});writeFileSync(join(project,'artifacts/preview-release.json'),JSON.stringify({url:url+'index.html',stableMiningUnchanged:true,verified},null,2));
console.log('Mining 测试版 published and verified:',url+'index.html');
