import {writeFileSync,mkdirSync} from 'node:fs';
import {PET_DISPLAYS,SURFACE_PORTALS,PORTAL_MODEL,HUB_FENCES} from '../src/game/world/SurfaceHub.ts';
import {SURFACE_ROADS,SURFACE_SHOP,SURFACE_SALE,SURFACE_SPAWN,SURFACE_BUILDINGS} from '../src/game/world/surfaceLayout.ts';
import {CURB_EDGES} from '../src/game/world/SurfaceRoads.ts';
import {SURFACE_SITE} from '../src/game/world/SurfaceSite.ts';
import {PET_TIERS,PET_STAND,PET_STAIR_STEPS} from '../src/game/world/PetTerraces.ts';
const scale=6,X=x=>(x+76)*scale,Y=z=>(z+65)*scale;
const tags=['<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="1190" viewBox="0 0 1060 1190"><rect width="1060" height="1190" fill="#eef1e4"/>'];
const rect=(x,z,w,d,color,yaw=0)=>tags.push(`<rect x="${X(x-w/2)}" y="${Y(z-d/2)}" width="${w*scale}" height="${d*scale}" transform="rotate(${-yaw*180/Math.PI} ${X(x)} ${Y(z)})" fill="${color}" stroke="#4b5355"/>`);
const text=(x,z,t)=>tags.push(`<text x="${X(x)}" y="${Y(z)}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#1a2935">${t}</text>`);
const b=SURFACE_SITE.boundary;
for(let level=b.levels-1;level>=0;level--){const left=b.left-level*b.pitch,right=b.right+level*b.pitch,back=b.back-level*b.pitch,front=b.front+level*b.pitch;rect((left+right)/2,(back+front)/2,right-left+b.module,front-back+b.module,['#a3ba75','#83a666','#729456','#597b43'][level]);}
const floor=SURFACE_SITE.interior;rect((floor.minX+floor.maxX)/2,(floor.minZ+floor.maxZ)/2,floor.maxX-floor.minX,floor.maxZ-floor.minZ,'#c9dca8');
for(const r of SURFACE_ROADS)tags.push(`<rect x="${X(r.minX)}" y="${Y(r.minZ)}" width="${(r.maxX-r.minX)*scale}" height="${(r.maxZ-r.minZ)*scale}" fill="#ae9a7c"/>`);
for(const e of CURB_EDGES){const a=e.axis==='x'?[e.from,e.fixed]:[e.fixed,e.from],b=e.axis==='x'?[e.to,e.fixed]:[e.fixed,e.to];tags.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="#786b56" stroke-width="2"/>`);}
rect(0,0,26.1,26.1,'#aac1d5');rect(0,0,16,16,'#777f89');text(0,0,'8×8 矿口');
for(const [key,p] of Object.entries(SURFACE_BUILDINGS)){rect(p.x,p.z,10,8,'#d5b795',p.yaw);text(p.x,p.z,key==='sale'?'售卖':'商店');}
for(const p of [SURFACE_SHOP,SURFACE_SALE])tags.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${p.radius*scale}" fill="#ffcf61"/>`);
for(const p of HUB_FENCES)rect(p.x,p.z,p.width,p.depth,'#946c43',p.yaw);
for(const tier of PET_TIERS){rect(tier.x,30,6,26,['#f9eacb','#e0d0ba','#c5b395'][tier.tier]);text(tier.x,12,`${tier.y}m`);}
for(const step of PET_STAIR_STEPS)rect(step.x,step.z,step.width,step.depth,'#d0b886');
for(const [i,p] of PET_DISPLAYS.entries()){rect(p.x,p.z,2.7,2.7,p.color);text(p.x,p.z+.5,String(i+1));}
text(34,51,'右：三层蛋台');
for(const p of SURFACE_PORTALS){tags.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${p.zone.radius*scale}" fill="${p.color}" fill-opacity=".4" stroke="#65868f"/>`);rect(p.x,p.z,PORTAL_MODEL.width,PORTAL_MODEL.depth,'#809d99',p.yaw);text(p.x-5,p.z+.5,String(p.depth));}
tags.push(`<line x1="${X(-34)}" y1="${Y(SURFACE_SITE.redLine)}" x2="${X(9)}" y2="${Y(SURFACE_SITE.redLine)}" stroke="#e74750" stroke-width="3"/>`);
text(-26,10,'红线 Z=13');text(-26,54,'左：九个传送点');
tags.push(`<circle cx="${X(SURFACE_SPAWN[0])}" cy="${Y(SURFACE_SPAWN[2])}" r="5" fill="#e68b27"/>`);
text(SURFACE_SPAWN[0],SURFACE_SPAWN[2]+3,'出生 · 面向上方矿坑 ↑');text(10,-58,'V6 道路：左传送 / 右宠物蛋 / 身后商店与售卖');tags.push('</svg>');
writeFileSync('docs/art/quarry-v2/hub-layout.svg',tags.join('\n'));
const report={site:SURFACE_SITE,eggStations:PET_DISPLAYS.length,tiers:PET_TIERS,stand:PET_STAND,minimumEggGap:4-2.7,portals:SURFACE_PORTALS,portalGap:4,portalRadius:1.6,portalHysteresisGap:4-2*(1.6+.3),serviceBuildings:SURFACE_BUILDINGS,serviceZones:{sale:SURFACE_SALE,shop:SURFACE_SHOP}};
mkdirSync('artifacts/approved-layout',{recursive:true});writeFileSync('artifacts/approved-layout/dimensions.json',JSON.stringify(report,null,2));console.log('Wrote current functional layout and road dimensions.');
