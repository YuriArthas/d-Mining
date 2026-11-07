import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const record=p=>({file:relative(root,p),bytes:readFileSync(p).length,sha256:hash(p)});
const sources=files(join(root,'src'));
const assets=['architecture','nature'].map(name=>{
  for(const file of [`public/assets/blockcraft/${name}.glb`,`public/assets/blockcraft/${name}-atlas.png`,`source-art/${name}.blend`,`tools/blender/build_${name}.py`,`artifacts/${name}-asset.json`]){
    if(!existsSync(join(root,file)))throw Error(`Missing authored asset provenance: ${file}`);
  }
  const asset=JSON.parse(readFileSync(join(root,`artifacts/${name}-asset.json`),'utf8'));
  for(const [file,record] of Object.entries(asset.files))if(hash(join(root,file))!==record.sha256)throw Error(`Asset provenance mismatch: ${file}`);
  return asset;
});
const terrain=JSON.parse(readFileSync(join(root,'artifacts/ground-asset.json'),'utf8'));
for(const source of terrain.generatorSources)if(hash(join(root,source.path))!==source.sha256)throw Error(`Terrain source hash changed without provenance refresh: ${source.path}`);
const manifest={
  name:'Pinewind Quarry',
  method:'New Blender-authored Roblox-inspired toy forms: continuous roofs, broad chamfered crowns and restrained small-atlas accents. Connected terrain banks and surface-mapped texture. Native-resolution WebGPU; no screen pixelation. No Tripo or decimation.',
  generatedAt:new Date().toISOString(),
  sources:sources.map(record),
  authoring:[...files(join(root,'tools/blender')),...files(join(root,'source-art'))].filter(p=>p.endsWith('.py')||p.endsWith('.blend')).map(record),
  assets,
  terrain,
  resources:files(join(root,'public/assets/blockcraft')).map(record),
  runtimeGeometry:'__surfaceStudy.snapshot().geometry includes UV-preserving batches and textured triangles.',
  artifacts:files(join(root,'dist')).map(p=>({...record(p),file:relative(join(root,'dist'),p)})),
};
const target=join(root,'artifacts/asset-manifest.json');mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(manifest,null,2));console.log('Asset source hashes recorded:',relative(root,target));
