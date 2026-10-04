import {writeFile} from 'node:fs/promises';
import {expansion as allExpansion} from './camp-expansion.mjs';
// Retired rounded cliffs are source history only; the modular timber bank replaces them.
const expansion=Object.fromEntries(Object.entries(allExpansion).filter(([name])=>!name.startsWith('cliff-')&&name!=='supply-awning'));
const placements=Object.entries(expansion).map(([asset,{place}])=>{const [x,z,width,yaw,height]=place;return {asset,x,z,width,yaw,...(height?{height}:{}),...(asset.startsWith('cliff-')?{y:-3}:{})}});
// Small detail groups sit along the outer side of the walkable circulation loop.
// Deliberately placed, not random scatter through the shaft or selling trigger.
const repeats=[
 ['grass-tussock',-11,13,1.4,.3],['grass-tussock',-16,28,1.7,.7],['grass-tussock',-22,25,1.7,-.2],['grass-tussock',-24,8,1.4,.8],
 ['grass-tussock',-28,-3,1.8,.2],['grass-tussock',-10,-16,1.6,-.5],['grass-tussock',3,-18,1.7,.7],['grass-tussock',17,-18,1.5,-.2],
 ['grass-tussock',25,-15,1.6,.4],['grass-tussock',30,22,1.5,.9],['grass-tussock',18,29,1.7,.3],['grass-tussock',3,25,1.6,-.6],
 ['flower-daisies',-18,27,1.8,.8],['flower-daisies',-23,20,1.9,.3],['flower-daisies',26,24,2,.3],['flower-daisies',5,27,1.6,-.2],
 ['shrub-round',-24,4,3,-.5],['shrub-round',27,-23,3.5,.7],['shrub-flower',-9,28,3.5,.3],['shrub-berry',28,30,3.5,.5],
 ['mushroom-cluster',-29,20,1.6,-.3],['mushroom-cluster',-28,0,1.4,.2],['boulder-moss',-25,2,3.5,.4],['boulder-moss',23,-21,4,-.5],
 ['crate-stack',-25,-9,2.8,.4],['barrel-pair',30,10,2.3,-.5],['sack-stack',23,18,2.2,.5],['ore-bin-copper',-17,-18,2.3,-.6],
 ['lantern-post',-20,21,1.1,.3],['lantern-post',21,22,1.1,.3],['lantern-post',-27,-6,1.1,.4],['lantern-post',27,-12,1.1,-.3],
];
placements.push(...repeats.map(([asset,x,z,width,yaw])=>({asset,x,z,width,yaw})));
// Low groundcover groups frame each activity area without obstructing routes.
for(const [x,z] of [[-19,22],[-22,10],[-15,-2],[-12,-11],[0,-13],[14,-14],[26,-9],[24,23],[15,22],[5,19],[-3,24],[-17,31]]){
 placements.push({asset:'grass-tussock',x,z,width:1.25,yaw:.4},{asset:'grass-tussock',x:x+1.1,z:z+.6,width:1,yaw:-.5},{asset:'flower-daisies',x:x-.7,z:z+.8,width:1.3,yaw:.2});
}
for(const p of placements){
 if(p.asset==='grass-tussock')p.height=.55;
 if(p.asset==='flower-daisies')p.height=.6;
 if(p.asset==='mushroom-cluster')p.height=.7;
 if(p.asset.startsWith('shrub-'))p.height=p.asset==='shrub-berry'?1.2:.9;
 if(p.asset==='boulder-ore')p.height=3.2;
 if(p.asset==='bench-timber')p.height=1.5;
 if(p.asset==='well-stone'){p.x=-25;p.z=26;p.height=3;}
 if(p.asset==='waystone-crystal')p.height=3.8;
}
// Avoid the spawn (-13,18) and keep the two frontages distinct.
for(const p of placements){if(p.asset==='notice-board'){p.x=-27;p.z=20;}if(p.asset==='warehouse-shed'){p.x=-26;p.z=-22;p.width=7;p.height=5;}if(p.asset==='workshop-hut'){p.x=31;p.z=0;p.yaw=-.8;}if(p.asset==='supply-awning'){p.x=-24;p.z=14;}}
// Clear the new upgrade kiosk footprint; move its previous garden props to the outside edge.
for(const p of placements){if(p.x>=-27&&p.x<=-16&&p.z>=0&&p.z<=12&&['grass-tussock','flower-daisies','shrub-round','boulder-moss'].includes(p.asset)){p.x-=8;}}
const names=Object.keys(expansion);
await writeFile('src/game/world/CampExpansion.ts',`// Authored Tripo model placement. Rebuild with tools/tripo/build-expansion-layout.mjs.\nexport const EXPANSION_ASSETS=${JSON.stringify(names)} as const;\nexport const CAMP_EXPANSION=${JSON.stringify(placements,null,1)} as const;\n`);
let doc='# 矿场细节扩充：当前保留 35 个独立模型\n\n原扩充批次共 42 种，六种圆润岩壁和旧补给棚已退出运行时，改由 TimberBoundary 模块替代。其余每种对应独立 Tripo 任务。新增近景服务区、可走近的工作痕迹和成组植被。所有新模型使用同一套暖砂岩、蜂蜜木、青绿点缀的色板。\n\n生成时限制三角面；贴图统一 512 色彩 / 256 法线 / 128 ORM 并使用 GPU 压缩。普通场景常驻，不按角色距离消失。禁止通过程序捏模型补数。\n\n|模型|用途|位置 x,z|宽度 m|三角面上限|\n|---|---|---|---:|---:|\n';
for(const [name,r] of Object.entries(expansion)){const p=placements.find(p=>p.asset===name);doc+=`|${name}|${r.zone}|${p.x}, ${p.z}|${p.width}|${r.faceLimit}|\n`;}
doc+='\n六种旧岩壁只保留源文件和生成记录，不再打包；小道具和植被另组成多处细节组，不计入独立模型数量。保留矿口、出生点与售卖通道。任务 ID、实际面数、哈希及最终采用清单在完成后生成。\n';
await writeFile('docs/art/quarry-v2/expansion-plan.md',doc);
console.log(names.length,'new models,',placements.length,'authored placements');
