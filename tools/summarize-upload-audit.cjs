const fs=require('node:fs'),assert=require('node:assert/strict');
const root='artifacts/upload-batch-audit';
const read=(mode,i)=>JSON.parse(fs.readFileSync(`${root}/${mode}-${i}/cold.json`));
const before=[1,2,3].map(i=>read('before',i)),after=[1,2,3].map(i=>read('after',i));
const resourceShape=r=>({bytes:r.snapshot.assets.bytes,models:r.snapshot.assets.assets.map(a=>[a.name,a.triangles,a.instances]),textures:r.snapshot.assets.textureMemory,geometryCount:r.snapshot.render.geometries,textureCount:r.snapshot.render.textures});
for(const r of [...before,...after])assert.deepEqual(r.errors,[]);
for(const r of after){assert.deepEqual(resourceShape(r),resourceShape(before[0]));assert.ok(r.snapshot.assets.textureUploads.maxBatchBytes<=4*1024*1024);assert.equal(r.snapshot.assets.textureUploads.textures,206);}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const metrics={assetPreparationMs:r=>r.snapshot.assets.prepareMs,fenceCount:r=>r.fences.length,fenceMs:r=>r.fences.reduce((n,f)=>n+f.ms,0),firstPlayableMs:r=>r.snapshot.startup.firstPlayableMs,maxLongTaskMs:r=>Math.max(...r.longTasks.map(t=>t.duration)),encodedMipBytes:r=>r.snapshot.assets.textureMemory.encodedMipBytes};
const result={beforeCommit:'61327bd',runs:3,environment:'public Chromium + SwiftShader 960x540; not device performance acceptance',metrics:Object.fromEntries(Object.entries(metrics).map(([key,fn])=>{const a=before.map(fn),b=after.map(fn);return [key,{before:a,after:b,beforeMedian:median(a),afterMedian:median(b)}];})),uploadPolicy:after[0].snapshot.assets.textureUploads,resourceShapeUnchanged:true};
fs.writeFileSync(`${root}/summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
