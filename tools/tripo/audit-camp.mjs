import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {QUARRY_PLACEMENTS} from '../../src/game/world/QuarryLayout.ts';
const components=[];const taskIds=new Set(),hashes=new Set();
for(const name of [...new Set(QUARRY_PLACEMENTS.map(p=>p.asset))]){
 const manifest=JSON.parse(await readFile(`src/game/assets/camp/${name}.manifest.json`));
 const source=await readFile(`assets-source/quarry-v2/${name}/model.glb`);
 const result=JSON.parse(await readFile(`assets-source/quarry-v2/${name}/result.json`));
 if(result.status!=='success'||(result.generationId??result.taskId)!==(manifest.generationId??manifest.taskId))throw Error(`Task mismatch ${name}`);
 if(createHash('sha256').update(source).digest('hex')!==manifest.sourceSha256)throw Error(`Hash mismatch ${name}`);
 if(taskIds.has(manifest.generationId??manifest.taskId)||hashes.has(manifest.sourceSha256))throw Error(`Duplicate independent model identity ${name}`);
 if(manifest.triangles>manifest.faceLimit||manifest.geometryEdits)throw Error(`Generation budget/topology mismatch ${name}`);
 taskIds.add(manifest.generationId??manifest.taskId);hashes.add(manifest.sourceSha256);
 components.push({name,...manifest,instances:QUARRY_PLACEMENTS.filter(p=>p.asset===name).length});
}
const total={version:'camp-tripo-v2-expanded',uniqueModels:components.length,instances:QUARRY_PLACEMENTS.length,uniqueTriangles:components.reduce((s,c)=>s+c.triangles,0),placedTriangles:components.reduce((s,c)=>s+c.triangles*c.instances,0),downloadBytes:components.reduce((s,c)=>s+c.bytes,0),components};
await writeFile('docs/art/quarry-v2/assets.json',JSON.stringify(total,null,2));
await writeFile('docs/art/quarry-v2/assets.md','# 公开场景独立模型清单\n\n环境组件记录独立 Tripo 任务；矿棚方块按用户授权由 Blender 建模，记录 generationId 与脚本来源。实例数为摆放次数，不计作新模型。\n\n|模型|任务 / Blender 生成标识|三角面|实例|传输 KiB|\n|---|---|---:|---:|---:|\n'+components.map(c=>`|${c.name}|${c.taskId??c.generationId}|${c.triangles}|${c.instances}|${(c.bytes/1024).toFixed(1)}|`).join('\n')+'\n');
console.log(JSON.stringify({...total,components:undefined},null,2));
