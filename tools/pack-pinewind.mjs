import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory='src/game/assets/camp',source='surface-game-art/public/assets/pinewind';
const cli=fileURLToPath(new URL('../surface-game-art/node_modules/@gltf-transform/cli/bin/cli.js',import.meta.url));
const env={...process.env,PATH:process.env.KTX_BIN?process.env.KTX_BIN+':'+process.env.PATH:process.env.PATH};
const provenanceOnly=process.argv.includes('--provenance-only');
if(process.argv.slice(2).some(arg=>arg!=='--provenance-only'))throw Error('Expected no arguments or --provenance-only');
const json=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
const triangles=d=>(d.meshes??[]).reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+d.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
const hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(directory,{recursive:true});
for(const name of provenanceOnly?[]:['architecture','landscape']){
 const original=readFileSync(`${source}/${name}.glb`);
 execFileSync(process.execPath,[cli,'uastc',`${source}/${name}.glb`,`${source}/${name}.ktx.glb`,'--level','2','--zstd','18','--jobs','1'],{env,stdio:'inherit'});
 execFileSync(process.execPath,[cli,'meshopt',`${source}/${name}.ktx.glb`,`${source}/${name}.runtime.glb`,'--quantize-position','16'],{env,stdio:'inherit'});
 const buffer=readFileSync(`${source}/${name}.runtime.glb`),compressed=gzipSync(buffer,{level:9});
 if(triangles(json(original))!==triangles(json(buffer)))throw Error('Topology changed');
 const asset=`pinewind-${name}`,part=`${asset}.000.part`;
 writeFileSync(`${directory}/${part}`,compressed);
 const manifest={parts:[part],bytes:compressed.length,decodedBytes:buffer.length,sha256:hash(compressed),sourceSha256:hash(original),triangles:triangles(json(buffer)),source:'Authored Pinewind; Blender architecture and offline procedural landscape',materialProfile:'authored-color',coordinateSpace:'authored',geometryEdits:false,textureEncoding:'KTX2 UASTC',reference:'surface-study final 2026-10-19T16:13:15.123Z'};
 writeFileSync(`${directory}/${asset}.manifest.json`,JSON.stringify(manifest,null,2)+'\n');console.log(asset,manifest.triangles,manifest.bytes);
}
const files=['tools/blender/build_architecture.py','tools/blender/build_nature.py','tools/terrain/kit.ts','tools/terrain/landscape.ts','tools/terrain/terrainTexture.ts','tools/terrain/bakeShadows.mjs','source-art/architecture.blend','source-art/nature.blend','layout.json','package.json','package-lock.json','../tools/export-pinewind-layout.mjs','../tools/export-pinewind-scene.mjs','../tools/pack-pinewind.mjs','../src/game/content/pinewind/authored.json','public/assets/pinewind/architecture-atlas.png','public/assets/pinewind/nature-atlas.png','artifacts/architecture-asset.json','artifacts/nature-asset.json','artifacts/landscape-asset.json'];
writeFileSync('surface-game-art/provenance.json',JSON.stringify({method:'Blender and offline Three authoring; no Tripo',files:files.map(file=>({file,sha256:hash(readFileSync('surface-game-art/'+file))})),runtimeAssets:['architecture','landscape'].map(n=>JSON.parse(readFileSync(`${directory}/pinewind-${n}.manifest.json`)))},null,2)+'\n');
