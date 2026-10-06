import {assetProfile} from '../content/assetProfiles.ts';
import {SURFACE_SITE} from './SurfaceSite.ts';
import {STREET_LIGHTS,SUPPORT_LANTERNS} from './StreetLights.ts';
import {PET_TERRACE_PLACEMENTS,PET_TERRACE_SOLIDS} from './PetTerraces.ts';
import {SURFACE_BUILDINGS,SURFACE_SERVICES} from './surfaceLayout.ts';
import {layoutDecorations} from './CampLayout.ts';
import {HUB_ASSETS,HUB_PLACEMENTS,HUB_FENCES} from './SurfaceHub.ts';
import {MINE_PAVILION_SOLIDS, MINE_PAVILION_PLACEMENTS, MINE_BLOCK_ASSETS} from './MinePavilion.ts';
import {BOUNDARY_ASSETS, BOUNDARY_PLACEMENTS, BOUNDARY_SOLIDS} from './TimberBoundary.ts';
import type { Solid } from './sceneryKit.ts';
import {WORKSITE_ASSETS, WORKSITE_PLACEMENTS, WORKSITE_SOLIDS} from './MineWorksite.ts';
import { CAMP_EXPANSION, EXPANSION_ASSETS } from './CampExpansion.ts';
export type QuarryAsset=typeof HUB_ASSETS[number]|typeof BOUNDARY_ASSETS[number]|typeof WORKSITE_ASSETS[number]|typeof EXPANSION_ASSETS[number]|'mine-badge'|'mine-pendant'|'meadow-base'|typeof MINE_BLOCK_ASSETS[number]|'simulator-exchange'|'simulator-upgrade'|'terrain-slab'|'crown-tree'|'soft-shrub'|'ore-cart'|'lantern-post';
export type QuarryPlacement={asset:QuarryAsset;x:number;z:number;width:number;yaw?:number;y?:number;height?:number;depth?:number;portalId?:string;portalAccent?:string;tint?:string;eggColor?:string;boundaryClip?:{minX?:number;maxX?:number;minZ?:number;maxZ?:number;maxY?:number}};
// Tripo environment assembly with authored Blender mine blocks.
// The central 16m square is the gameplay shaft; surrounding ground is a generated mesh.
const originalPlacements:readonly QuarryPlacement[]=[
 ...CAMP_EXPANSION,
 ...BOUNDARY_PLACEMENTS,
 ...HUB_FENCES,
 ...PET_TERRACE_PLACEMENTS,
 ...WORKSITE_PLACEMENTS,
 {asset:'meadow-base',x:0,z:0,...SURFACE_SITE.grounds,height:.004,y:.018},
 ...MINE_PAVILION_PLACEMENTS,
 {asset:'mine-badge',x:0,z:11.55,width:3.8,depth:.7,height:3.8,y:9.45},
 {asset:'mine-pendant',x:0,z:0,width:2.4,depth:2.4,height:3.6,y:11.34},
 SURFACE_SERVICES.sale.placement,
 SURFACE_SERVICES.shop.placement,
 {asset:'crown-tree',x:-31,z:15,width:9,yaw:.4},
 {asset:'crown-tree',x:29,z:19,width:9,yaw:-.5},
 {asset:'crown-tree',x:-25,z:35,width:10,yaw:1.6},
 {asset:'crown-tree',x:20,z:36,width:10,yaw:-.9},
 {asset:'crown-tree',x:-30,z:-9,width:10,yaw:.8},
 {asset:'crown-tree',x:31,z:-12,width:10,yaw:-1.5},
 {asset:'crown-tree',x:-15,z:-25,width:9,yaw:2},
 {asset:'crown-tree',x:19,z:-26,width:10,yaw:-2},
 {asset:'soft-shrub',x:-30,z:10,width:4,yaw:.4},
 {asset:'soft-shrub',x:27,z:14,width:5,yaw:-.9},
 {asset:'soft-shrub',x:-22,z:29,width:5,yaw:1.6},
 {asset:'soft-shrub',x:14,z:32,width:6,yaw:-.4},
 {asset:'soft-shrub',x:-9,z:-21,width:5,yaw:.5},
 {asset:'soft-shrub',x:10,z:-21,width:5,yaw:-.7},
 {asset:'soft-shrub',x:-28,z:-3,width:5,yaw:1.5},
 {asset:'soft-shrub',x:29,z:-6,width:5,yaw:-1.5},
 {asset:'ore-cart',x:-18,z:3.6,width:2.1,yaw:Math.PI/2},
 {asset:'ore-cart',x:24,z:11,width:2.8,yaw:-1},
 {asset:'lantern-post',x:-20,z:8,width:1.1},
 {asset:'lantern-post',x:24,z:22,width:1.1},
 {asset:'lantern-post',x:22,z:-20,width:1.1},
];
const fixed=originalPlacements.filter(p=>assetProfile(p.asset).fixed);
const fixedSet=new Set(fixed);
export const CAMP_DECORATIONS=layoutDecorations(originalPlacements.filter(p=>!fixedSet.has(p)).sort((a,b)=>b.width-a.width),fixed);
export const QUARRY_PLACEMENTS:readonly QuarryPlacement[]=[...fixed,...CAMP_DECORATIONS,...HUB_PLACEMENTS,...STREET_LIGHTS.map(p=>p.fixture),...SUPPORT_LANTERNS.map(p=>p.fixture)];
export function hubSolidsFor(placements:readonly {x:number;y?:number;z:number;height:number;width:number;depth:number;yaw:number}[]):Solid[]{
 return placements.map(p=>({at:[p.x,(p.y??0)+p.height/2,p.z],half:[p.width/2,p.height/2,p.depth/2],yaw:p.yaw}));
}
export const QUARRY_PORTAL_SOLIDS=hubSolidsFor(HUB_PLACEMENTS.filter(p=>'portalId' in p));
const eggSolids=hubSolidsFor(HUB_PLACEMENTS.filter(p=>!('portalId' in p)));
// Gameplay collision is deliberately independent from render topology.
export const QUARRY_SOLIDS:Solid[]=[
 ...[...STREET_LIGHTS,...SUPPORT_LANTERNS].map(({fixture:p})=>({at:[p.x,p.y+p.height/2,p.z] as [number,number,number],half:[.3,p.height/2,.3] as [number,number,number],yaw:0})),
 ...QUARRY_PORTAL_SOLIDS,...eggSolids,
 ...WORKSITE_SOLIDS,
 ...PET_TERRACE_SOLIDS,
 ...HUB_FENCES.map(p=>({at:[p.x,(p.y??0)+p.height/2,p.z] as [number,number,number],half:[p.width/2,p.height/2,p.depth/2] as [number,number,number],yaw:p.yaw})),
 ...BOUNDARY_SOLIDS,

 ...QUARRY_PLACEMENTS.filter(p=>assetProfile(p.asset).collision==='hut').map(p=>({at:[p.x,(p.y??0)+(p.height??4)*.5,p.z] as [number,number,number],half:[p.width*.36,(p.height??4)*.5,p.width*.25] as [number,number,number],yaw:p.yaw??0})),
 ...QUARRY_PLACEMENTS.filter(p=>assetProfile(p.asset).collision==='small').map(p=>({at:[p.x,.5,p.z] as [number,number,number],half:[p.width*.3,.5,p.width*.22] as [number,number,number],yaw:p.yaw??0})),
 ...MINE_PAVILION_SOLIDS,
 {at:[0,11.35,11.55],half:[1.9,1.9,.35],yaw:0},
 {at:[0,13.14,0],half:[1.2,1.8,1.2],yaw:0},
 ...Object.values(SURFACE_SERVICES).map(p=>p.solid),
 ...QUARRY_PLACEMENTS.filter(p=>assetProfile(p.asset).collision==='tree').map(p=>({at:[p.x,(p.y??0)+2,p.z] as [number,number,number],half:[.7,2,.7] as [number,number,number],yaw:0})),
 ...QUARRY_PLACEMENTS.filter(p=>assetProfile(p.asset).collision==='cart').map(p=>({at:[p.x,.7,p.z] as [number,number,number],half:[p.width*.35,.7,p.width*.28] as [number,number,number],yaw:p.yaw??0})),
];
