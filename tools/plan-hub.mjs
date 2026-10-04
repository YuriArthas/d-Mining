import {writeFileSync,mkdirSync} from 'node:fs';
import {PET_DISPLAYS,SURFACE_PORTALS,PORTAL_MODEL,HUB_FENCES} from '../src/game/world/SurfaceHub.ts';
import {SURFACE_TRAILS,SURFACE_SHOP,SURFACE_SALE,SURFACE_SPAWN,SURFACE_BUILDINGS} from '../src/game/world/surfaceLayout.ts';
import {SURFACE_SITE} from '../src/game/world/SurfaceSite.ts';
import {PET_TIERS,PET_STAND} from '../src/game/world/PetTerraces.ts';
const scale=5,X=x=>(x+92)*scale,Y=z=>(z+76)*scale;
const tags=['<svg xmlns="http://www.w3.org/2000/svg" width="920" height="880" viewBox="0 0 920 880"><rect width="920" height="880" fill="#eef1e4"/>'];
const rect=(x,z,w,d,color,yaw=0)=>tags.push(`<rect x="${X(x-w/2)}" y="${Y(z-d/2)}" width="${w*scale}" height="${d*scale}" transform="rotate(${-yaw*180/Math.PI} ${X(x)} ${Y(z)})" fill="${color}" stroke="#4b5355"/>`);
const text=(x,z,t)=>tags.push(`<text x="${X(x)}" y="${Y(z)}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#1a2935">${t}</text>`);
const b=SURFACE_SITE.boundary;
for(let level=b.levels-1;level>=0;level--){const left=b.left-level*b.pitch,right=b.right+level*b.pitch,back=b.back-level*b.pitch,front=b.front+level*b.pitch;rect((left+right)/2,(back+front)/2,right-left+b.module,front-back+b.module,['#a3ba75','#83a666','#729456','#597b43'][level]);}
const floor=SURFACE_SITE.interior;rect((floor.minX+floor.maxX)/2,(floor.minZ+floor.maxZ)/2,floor.maxX-floor.minX,floor.maxZ-floor.minZ,'#c9dca8');
for(const trail of SURFACE_TRAILS)tags.push(`<polyline points="${trail.points.map(p=>[X(p[0]),Y(p[2])].join(',')).join(' ')}" fill="none" stroke="#f7e5b4" stroke-width="${trail.width*scale}" stroke-linecap="round" stroke-linejoin="round"/>`);
rect(0,0,26,26,'#aac1d5');rect(0,0,16,16,'#777f89');text(0,0,'8×8 矿口');
for(const [key,p] of Object.entries(SURFACE_BUILDINGS)){rect(p.x,p.z,10,8,'#d5b795',p.yaw);text(p.x,p.z,key==='sale'?'售卖':'商店');}
for(const p of [SURFACE_SHOP,SURFACE_SALE])tags.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${p.radius*scale}" fill="#ffcf61"/>`);
for(const p of HUB_FENCES)rect(p.x,p.z,p.width,p.depth,'#946c43',p.yaw);
for(const tier of PET_TIERS){rect(tier.x,30,6,26,['#f9eacb','#e0d0ba','#c5b395'][tier.tier]);text(tier.x,12,`${tier.y}m`);}
rect(-34,15.5,18,3,'#d0b886');rect(-34,44.5,18,3,'#d0b886');
for(const [i,p] of PET_DISPLAYS.entries()){rect(p.x,p.z,2.7,2.7,p.color);text(p.x,p.z+.5,String(i+1));}
text(-33,51,'三层 × 六蛋 · 两侧楼梯');
for(const p of SURFACE_PORTALS){tags.push(`<circle cx="${X(p.x)}" cy="${Y(p.z)}" r="${p.zone.radius*scale}" fill="${p.color}" fill-opacity=".4" stroke="#65868f"/>`);rect(p.x,p.z,PORTAL_MODEL.width,PORTAL_MODEL.depth,'#809d99',p.yaw);text(p.x,p.z+.5,String(p.depth));}
text(28,34.5,'安全浏览区');text(0,57,'外围退让 ≥ 8m · 功能区和植被分开');
tags.push(`<circle cx="${X(SURFACE_SPAWN[0])}" cy="${Y(SURFACE_SPAWN[2])}" r="5" fill="#e68b27"/>`);text(0,34,'出生');tags.push('</svg>');
writeFileSync('docs/art/quarry-v2/hub-layout.svg',tags.join('\n'));
const report={site:SURFACE_SITE,eggStations:PET_DISPLAYS.length,tiers:PET_TIERS,stand:PET_STAND,minimumEggGap:4-2.7,portalCentreSpan:[27,18],portalGap:9,portalRadius:3.3,portalHysteresisGap:9-2*(3.3+.3),capsuleClearance:3.3-Math.hypot(PORTAL_MODEL.width/2,PORTAL_MODEL.depth/2)-.4,serviceBuildings:SURFACE_BUILDINGS,serviceZones:{sale:SURFACE_SALE,shop:SURFACE_SHOP}};
mkdirSync('artifacts/tiered-site',{recursive:true});writeFileSync('artifacts/tiered-site/dimensions.json',JSON.stringify(report,null,2));console.log(report);
