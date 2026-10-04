import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir='src/game/assets/camp';mkdirSync(dir,{recursive:true});
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit',env:{...process.env,PATH:`${process.env.KTX_BIN??'/opt/ktx/bin'}:${process.env.PATH}`}});if(r.status!==0)throw Error(`${cmd} failed`)};
const cli=args=>run('npm',['exec','--yes','--package=@gltf-transform/cli@4.5.1','--','gltf-transform',...args]);
const json=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
const tris=j=>j.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+j.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
for(const name of process.argv.slice(2)){
 const base=`assets-source/quarry-v2/${name}`,source=readFileSync(`${base}/model.glb`),task=JSON.parse(readFileSync(`${base}/result.json`));
 if(tris(json(source))>task.faceLimit)throw Error(`${name} exceeds Tripo face limit`);
 run('python',['tools/prepare-camp-textures.py',`${base}/model.glb`,`${base}/textures.glb`,name.startsWith('bank-')?'0.5':'1']);
 cli(['uastc',`${base}/textures.glb`,`${base}/ktx.glb`,'--level','2','--zstd','18','--jobs','1']);
 cli(['meshopt',`${base}/ktx.glb`,`${base}/runtime.glb`,'--quantize-position','16']);
 const buffer=readFileSync(`${base}/runtime.glb`),download=gzipSync(buffer,{level:9}),doc=json(buffer);
 if(tris(doc)!==tris(json(source)))throw Error('Packing changed topology');
 const parts=[];for(let off=0;off<download.length;off+=4*1024*1024){const file=`${name}.${String(parts.length).padStart(3,'0')}.part`;writeFileSync(`${dir}/${file}`,download.subarray(off,off+4*1024*1024));parts.push(file)}
 const manifest={parts,bytes:download.length,sha256:createHash('sha256').update(download).digest('hex'),taskId:task.taskId,sourceSha256:createHash('sha256').update(source).digest('hex'),triangles:tris(doc),faceLimit:task.faceLimit,source:`new Tripo ${task.type??'text_to_model'}`,reference:task.reference,geometryEdits:false,positionQuantizationBits:16};
 writeFileSync(`${dir}/${name}.manifest.json`,JSON.stringify(manifest));writeFileSync(`${base}/runtime.json`,JSON.stringify(manifest,null,2));console.log(name,manifest.triangles,manifest.bytes);
}
