const fs=require('node:fs'),assert=require('node:assert/strict');
const root='artifacts/loading-pipeline';
const read=path=>JSON.parse(fs.readFileSync(`${path}/cold.json`));
const before=[`${root}/before-network`,`${root}/before-network-2`,`${root}/before-network-3`].map(read);
const after=[1,2,3].map(i=>read(`${root}/after-network-${i}`));
const ordered=a=>[...a].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const shape=r=>{const a=r.snapshot.assets;return {bytes:a.bytes,instances:a.instances,models:ordered(a.assets.map(m=>[m.name,m.triangles,m.instances,m.bytes])),textures:{...a.textureMemory,maps:ordered(a.textureMemory.maps)},geometryCount:r.snapshot.render.geometries,textureCount:r.snapshot.render.textures};};
for(const r of [...before,...after]){assert.deepEqual(r.errors,[]);assert.deepEqual(shape(r),shape(before[0]));}
for(const r of after){const a=r.snapshot.assets,p=a.prefetch;assert.ok(p.maxDownloads<=4);assert.ok(p.maxResidentItems<=8);assert.ok(p.maxReservedBytes<=4*1024*1024);assert.equal(p.completed,77);assert.equal(a.maxConcurrentModelDecodes,1);assert.equal(a.maxTextureWorkers,2);assert.ok(a.textureUploads.maxBatchBytes<=4*1024*1024);}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const metrics={assetPreparationMs:r=>r.snapshot.assets.prepareMs,firstPlayableMs:r=>r.snapshot.startup.firstPlayableMs,maxLongTaskMs:r=>Math.max(...r.longTasks.map(t=>t.duration)),textureUploadWaitMs:r=>r.snapshot.assets.textureUploads.waitMs};
const result={environment:'public Chromium + SwiftShader 960x540; CDP latency 60ms, download 2.5MiB/s, upload 1MiB/s; not PC/iPhone performance acceptance',runs:3,resourceShapeUnchanged:true,metrics:Object.fromEntries(Object.entries(metrics).map(([key,fn])=>{const a=before.map(fn),b=after.map(fn);return [key,{before:a,after:b,beforeMedian:median(a),afterMedian:median(b)}];})),prefetch:after.map(r=>r.snapshot.assets.prefetch),resourceTotals:{models:77,bytes:after[0].snapshot.assets.bytes,textureBytes:after[0].snapshot.assets.textureMemory.encodedMipBytes}};
fs.writeFileSync(`${root}/summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
