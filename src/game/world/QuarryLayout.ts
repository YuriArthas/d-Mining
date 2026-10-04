import {MINE_PAVILION_SOLIDS} from './MinePavilion.ts';
import {BOUNDARY_ASSETS, BOUNDARY_PLACEMENTS, BOUNDARY_SOLIDS} from './TimberBoundary.ts';
import type { Solid } from './sceneryKit.ts';
import {WORKSITE_ASSETS, WORKSITE_PLACEMENTS, WORKSITE_SOLIDS} from './MineWorksite.ts';
import { CAMP_EXPANSION, EXPANSION_ASSETS } from './CampExpansion.ts';
export type QuarryAsset=typeof BOUNDARY_ASSETS[number]|typeof WORKSITE_ASSETS[number]|typeof EXPANSION_ASSETS[number]|'meadow-base'|'simulator-mine'|'simulator-exchange'|'simulator-upgrade'|'terrain-slab'|'crown-tree'|'soft-shrub'|'ore-cart'|'lantern-post';
export type QuarryPlacement={asset:QuarryAsset;x:number;z:number;width:number;yaw?:number;y?:number;height?:number;depth?:number};
// Fresh Tripo-only assembly. Coordinates are authored independently of the old courtyard.
// The central 16m square is the gameplay shaft; surrounding ground is a generated mesh.
export const QUARRY_PLACEMENTS:readonly QuarryPlacement[]=[
 ...CAMP_EXPANSION,
 ...BOUNDARY_PLACEMENTS,
 ...WORKSITE_PLACEMENTS,
 {asset:'meadow-base',x:0,z:0,width:160,depth:160,height:.004,y:.018},
 {asset:'terrain-slab',x:0,z:19,width:5,depth:18,height:.004,y:.026,yaw:0},
 {asset:'terrain-slab',x:13,z:12,width:12,depth:5,height:.004,y:.026,yaw:.08},
 {asset:'simulator-mine',x:0,z:0,width:26,depth:26,height:14,y:0},
 {asset:'simulator-exchange',x:20,z:4,width:10,depth:8,height:9,yaw:-.55},
 {asset:'simulator-upgrade',x:-21,z:6,width:10,depth:8,height:9,yaw:.3},
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
// Gameplay collision is deliberately independent from render topology.
export const QUARRY_SOLIDS:Solid[]=[
 ...WORKSITE_SOLIDS,
 ...BOUNDARY_SOLIDS,
 {at:[-25,2.8,26],half:[1.65,.2,1.1],yaw:.3},
 ...QUARRY_PLACEMENTS.filter(p=>['workshop-hut','warehouse-shed','assayer-stall','supply-awning'].includes(p.asset)).map(p=>({at:[p.x,(p.height??4)*.5,p.z] as [number,number,number],half:[p.width*.36,(p.height??4)*.5,p.width*.25] as [number,number,number],yaw:p.yaw??0})),
 ...QUARRY_PLACEMENTS.filter(p=>['well-stone','tool-rack','workbench','anvil-stump','crate-stack','barrel-pair','ore-bin-copper','ore-bin-jade','sack-stack','cart-empty','wheelbarrow','bench-timber','notice-board','waystone-crystal','boulder-moss','boulder-ore'].includes(p.asset)).map(p=>({at:[p.x,.5,p.z] as [number,number,number],half:[p.width*.3,.5,p.width*.22] as [number,number,number],yaw:p.yaw??0})),
 ...MINE_PAVILION_SOLIDS,
 {at:[20,3,4],half:[4.3,3,3.4],yaw:-.55},
 {at:[-21,3,6],half:[4.3,3,3.4],yaw:.3},
 ...QUARRY_PLACEMENTS.filter(p=>['crown-tree','oak-wide','oak-tall','maple-gold','maple-coral','birch-round','cedar-pillow','willow-dome'].includes(p.asset)).map(p=>({at:[p.x,2,p.z] as [number,number,number],half:[.7,2,.7] as [number,number,number],yaw:0})),
 ...QUARRY_PLACEMENTS.filter(p=>p.asset==='ore-cart').map(p=>({at:[p.x,.7,p.z] as [number,number,number],half:[p.width*.35,.7,p.width*.28] as [number,number,number],yaw:p.yaw??0})),
];
