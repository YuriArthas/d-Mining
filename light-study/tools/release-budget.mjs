import {readdirSync,readFileSync,lstatSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const releaseByteTarget=5_000_000;
export function auditRelease(directory){
  const files=[];
  function walk(dir){
    for(const name of readdirSync(dir).sort()){
      const path=join(dir,name),stat=lstatSync(path);
      if(stat.isSymbolicLink())throw Error(`Release cannot depend on symlinks: ${path}`);
      if(stat.isDirectory())walk(path);
      else if(stat.isFile())files.push({file:relative(directory,path),bytes:stat.size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
      else throw Error(`Unexpected release entry: ${path}`);
    }
  }
  walk(directory);
  const bytes=files.reduce((total,file)=>total+file.bytes,0);
  return {bytes,referenceTargetBytes:releaseByteTarget,aboveReferenceBytes:Math.max(0,bytes-releaseByteTarget),files};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(import.meta.dirname,'..'),report=auditRelease(join(root,'dist'));
  writeFileSync(join(root,'artifacts/release-size.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Complete deployable release: ${report.bytes} bytes (${report.files.length} files); 5 MB is a reference, not a release gate.`);
}
