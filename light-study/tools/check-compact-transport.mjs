import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),directory=join(root,'artifacts/compact-release/transport');mkdirSync(directory,{recursive:true});
const url='https://w-sunjun-public.dev.clock-p.com/games/mining-light/assets/street.glb';
const original=readFileSync(join(root,'public/assets/street.glb'));
const sha256=content=>createHash('sha256').update(content).digest('hex');
const results=[];
for(const [name,protocol,accept] of [['h2-br','--http2','br'],['h1-br','--http1.1','br'],['identity','--http2','identity'],['gzip-only','--http2','gzip']]){
  const body=join(directory,name+'.glb'),headerFile=join(directory,name+'.headers');
  const transfer=JSON.parse(execFileSync('curl',[protocol,'--fail','--silent','--show-error','--max-time','120','--compressed','-H','Accept-Encoding: '+accept,'-D',headerFile,'-o',body,'-w','%{json}',url+'?compact='+name],{encoding:'utf8'}));
  assert.equal(transfer.http_code,200);assert.equal(sha256(readFileSync(body)),sha256(original));
  const headers=readFileSync(headerFile,'utf8');assert.match(headers,/vary: Accept-Encoding/i);assert.match(headers,/content-type: model\/gltf-binary/i);
  if(accept==='br'){assert.match(headers,/content-encoding: br/i);assert.equal(transfer.size_download,1331284);}else assert.doesNotMatch(headers,/content-encoding:/i);
  results.push({name,httpVersion:transfer.http_version,downloadBytes:transfer.size_download,decodedSha256:sha256(original),decodedIdentical:true});
  unlinkSync(body);
}
for(const accept of ['br','identity']){
  const head=execFileSync('curl',['--fail','--silent','--show-error','--max-time','30','--head','-H','Accept-Encoding: '+accept,url+'?compact=head'],{encoding:'utf8'});
  assert.match(head,/HTTP\/2 200/);if(accept==='br')assert.match(head,/content-length: 1331284/i);
}
const refused=execFileSync('curl',['--silent','--show-error','--max-time','30','-H','Accept-Encoding: br;q=0, identity;q=0','-o','/dev/null','-w','%{http_code}',url+'?compact=refused'],{encoding:'utf8'});
assert.equal(refused,'406');
writeFileSync(join(directory,'check.json'),JSON.stringify({results,headsPassed:true,explicitRefusalStatus:406},null,2)+'\n');
console.log('Public compact GLB: HTTP/1.1 and HTTP/2 Brotli, streamed identity, HEAD and explicit refusal passed.');
