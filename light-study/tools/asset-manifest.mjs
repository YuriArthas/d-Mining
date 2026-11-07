import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'..');
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const record=p=>({file:relative(root,p),bytes:readFileSync(p).length,sha256:hash(p)});
const provenance=['courtyard','materials','focused-lantern','street','moving-lantern'].map(name=>JSON.parse(readFileSync(join(root,'artifacts',name+'-asset.json'),'utf8')));
const [model,materials,lantern,street,movingLantern]=provenance;
const validate=(path,expected)=>{if(!expected||hash(join(root,path))!==expected)throw Error('Stale provenance: '+path);};
const transfer=JSON.parse(readFileSync(join(root,'artifacts/street-transfer.json'),'utf8'));
validate(transfer.source.path,transfer.source.sha256);validate(transfer.encoded.path,transfer.encoded.sha256);
if(!gunzipSync(readFileSync(join(root,transfer.encoded.path))).equals(readFileSync(join(root,transfer.source.path))))throw Error('Street HTTP representation does not decode to the authored GLB');
validate(transfer.brotli.path,transfer.brotli.sha256);
if(!brotliDecompressSync(readFileSync(join(root,transfer.brotli.path))).equals(readFileSync(join(root,transfer.source.path))))throw Error('Street Brotli does not decode to the authored GLB');
provenance.push(transfer);
for(const asset of [model,lantern,street,movingLantern])for(const key of ['source','script','resource'])validate(asset[key],asset[key+'Sha256']);
validate(street.layout,street.layoutSha256);
for(const key of ['source','loader','manifest'])validate(materials[key].path,materials[key].sha256);
const materialRecords=[...Object.values(materials.materials),...Object.values(materials.variants??{}).flatMap(variant=>Object.values(variant.materials))];
const materialMaps=new Map(materialRecords.flatMap(material=>Object.values(material.maps??{})).map(map=>[map.file,map]));
for(const map of materialMaps.values())validate('public/assets/materials/'+map.file,map.sha256);
const materialDir=join(root,'public/assets/materials');
const recordedFiles=new Set(['materials.json',...materialMaps.keys()]);
for(const path of files(materialDir))if(!recordedFiles.has(relative(materialDir,path)))throw Error('Unrecorded material resource: '+path);
if(materialMaps.size!==materials.textureCount)throw Error('Material texture count does not match provenance');
const shadow=JSON.parse(readFileSync(join(root,'artifacts/street-shadow-asset.json'),'utf8'));
validate(shadow.resource,shadow.resourceSha256);validate(shadow.bakeReport,shadow.bakeReportSha256);
for(const [path,sha] of Object.entries(shadow.dependencies)){
  const compatibility=shadow.runtimeCompatibility?.[path];
  if(compatibility){
    // Retain the exact code used by the historical bake, independently from
    // a reviewed rendering-only revision. This does not claim a new bake.
    if(!compatibility.reason)throw Error('Missing shadow compatibility rationale: '+path);
    validate(compatibility.bakeSourceSnapshot,sha);
    validate(path,compatibility.runtimeSha256);
  }else validate(path,sha);
}
provenance.push(shadow);
const packed=JSON.parse(readFileSync(join(root,'artifacts/street-packed.json'),'utf8'));
validate('tools/pack-street.py',packed.scriptSha256);
validate('public/assets/materials/materials.json',packed.sourceManifestSha256);
validate('dist/assets/materials/materials.json',packed.packedManifestSha256);
for(const texture of packed.textures){validate(texture.source,texture.sourceSha256);validate('dist/'+texture.file,texture.sha256);}
const district=JSON.parse(readFileSync(join(root,'artifacts/district-asset.json'),'utf8'));
for(const key of ['source','script','helpers','resource','layout'])validate(district[key],district[key+'Sha256']);
const districtTransfer=JSON.parse(readFileSync(join(root,'artifacts/district-transfer.json'),'utf8'));
const districtCompression=JSON.parse(readFileSync(join(root,'artifacts/district-compression.json'),'utf8'));
for(const key of ['source','script','resource'])validate(districtCompression[key],districtCompression[key+'Sha256']);
if(districtCompression.triangles!==district.triangles||!districtCompression.decodedArraysIdentical)throw Error('District compression validation missing');
validate(districtTransfer.source.path,districtTransfer.source.sha256);validate(districtTransfer.brotli.path,districtTransfer.brotli.sha256);
if(!brotliDecompressSync(readFileSync(join(root,districtTransfer.brotli.path))).equals(readFileSync(join(root,districtTransfer.source.path))))throw Error('Invalid district transfer encoding');
validate('dist/assets/district.glb.br',districtTransfer.brotli.sha256);validate('dist/assets/district-layout.json',district.layoutSha256);
const districtLight=JSON.parse(readFileSync(join(root,'artifacts/district-light-asset.json'),'utf8'));
validate(districtLight.script,districtLight.scriptSha256);validate(district.source,districtLight.sourceSha256);validate(district.resource,districtLight.modelSha256);validate(district.layout,districtLight.layoutSha256);
validate(districtLight.finishScript,districtLight.finishScriptSha256);
validate('artifacts/district-bake/rgbm-top-down.npy',districtLight.rawSha256);
validate('public/assets/materials/materials.json',districtLight.materialManifestSha256);
for(const [path,sha] of Object.entries(districtLight.textureDependencies))validate(path,sha);
validate(districtLight.resource,districtLight.resourceSha256);validate('dist/assets/district-light.webp',districtLight.resourceSha256);
validate('dist/assets/district-light.json',hash(join(root,'public/assets/district-light.json')));
provenance.push(district,districtLight,districtCompression,districtTransfer);
const packedMaterials=JSON.parse(readFileSync(join(root,'dist/assets/materials/materials.json'),'utf8'));
for(const material of [...Object.values(packedMaterials.materials),...Object.values(packedMaterials.variants.crafted.materials)]){
  for(const map of Object.values(material.maps??{}))validate('dist/assets/materials/'+map.file,map.sha256);
}
provenance.push(packed);
const manifest={generatedAt:new Date().toISOString(),method:'New Blender courtyard and street geometry with correlated authored PBR surface textures; no imported source or decimation. Independent Three.js WebGPU lighting sample.',sources:files(join(root,'src')).map(record),provenance,resources:files(join(root,'public/assets')).map(record),artifacts:files(join(root,'dist')).map(p=>({...record(p),file:relative(join(root,'dist'),p)}))};
mkdirSync(join(root,'artifacts'),{recursive:true});writeFileSync(join(root,'artifacts/asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Model, material and runtime provenance verified.');
