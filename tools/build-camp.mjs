import {spawnSync} from 'node:child_process';
import {QUARRY_PLACEMENTS} from '../src/game/world/QuarryLayout.ts';
for(const name of [...new Set(QUARRY_PLACEMENTS.map(p=>p.asset))]){
 const r=spawnSync(process.execPath,['tools/pack-camp.mjs',name],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);
}
const r=spawnSync(process.execPath,['tools/tripo/audit-camp.mjs'],{stdio:'inherit'});process.exitCode=r.status??1;
