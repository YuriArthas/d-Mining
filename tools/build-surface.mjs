import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
for(const [command,args] of [
 ['blender',['-b','--python','tools/blender/build_valley.py']],
 ['node',['tools/pack-surface.mjs']],
 ['python3',['tools/blender/prepare_meadow_texture.py']],
]){const result=spawnSync(command,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
