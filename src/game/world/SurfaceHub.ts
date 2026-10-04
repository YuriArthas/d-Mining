import {SURFACE_SITE} from './SurfaceSite.ts';
import {PET_TIERS,PET_COLUMNS} from './PetTerraces.ts';
import {LAYERS,type Layer} from '../content/layers.ts';
import {themeById} from '../content/themes.ts';
export const EGG_ASSETS=['egg-meadow-blender','egg-crystal-blender','egg-ember-blender','egg-tide-blender','egg-moon-blender','egg-core-blender'] as const;
export const HUB_ASSETS=['portal-timber','portal-fungal','portal-crystal','portal-frozen','portal-volcanic','portal-fossil','portal-core',...EGG_ASSETS] as const;
export const PET_AREA=SURFACE_SITE.pet;
export const PORTAL_AREA=SURFACE_SITE.portal;
export const PORTAL_MODEL={width:4.5,depth:2.8,height:3.8} as const;
const models=['portal-timber','portal-fungal','portal-crystal','portal-timber','portal-frozen','portal-volcanic','portal-fossil','portal-timber','portal-core'] as const;
// Clockwise around a U, open west toward spawn. Every model faces the safe court.
const portalSlots=[
 ...[15,24,33].map(x=>({x,z:24,yaw:0})),
 ...[24,33,42].map(z=>({x:42,z,yaw:-Math.PI/2})),
 ...[33,24,15].map(x=>({x,z:42,yaw:Math.PI})),
];
export function portalsFor(layers:readonly Layer[]){return layers.slice(1).map((layer,i)=>{
 const slot=portalSlots[i];if(!slot)throw Error('传送庭院展位不足，请扩展布局');
 return {id:layer.id,name:layer.name,depth:layer.from,color:themeById(layer.theme).accent,
 model:models[i%models.length],...slot,
 tint:layer.id==='ruins'?'#ffe4ad':layer.id==='machinery'?'#8db5bd':undefined,
 zone:{x:slot.x,y:0,z:slot.z,radius:3.3,heightTolerance:.25,hysteresis:.3}};
});}
export const SURFACE_PORTALS=portalsFor(LAYERS);
// Every tier contains six eggs, progressively higher and further west.
export const PET_DISPLAYS=PET_TIERS.flatMap(t=>PET_COLUMNS.map((z,i)=>({...t,z,yaw:Math.PI/2,asset:EGG_ASSETS[(i+t.tier*2)%6],color:['#9ce866','#a597ff','#ffa456','#66d8de','#f5dc96','#ffcc61'][(i+t.tier*2)%6]})));
export const HUB_PLACEMENTS=[
 ...SURFACE_PORTALS.map(p=>({asset:p.model,x:p.x,z:p.z,...PORTAL_MODEL,y:0,yaw:p.yaw,portalId:p.id,tint:p.tint})),
 ...PET_DISPLAYS.map(p=>({asset:p.asset,x:p.x,z:p.z,width:2.7,depth:2.7,height:3.02,y:p.y,yaw:p.yaw})),
];
// Reassemble the existing low mining fence kit; courtyard entrances stay open.
export const HUB_FENCES=[
 // Short edge rails define the display, with 3m side stairs entirely open.
 ...[19,25,31,37,43].map(z=>({x:-45.5,z,width:5.8,yaw:Math.PI/2})),
 ...[19,47].flatMap(z=>[17,23,29,35,41].map(x=>({x,z,width:5.8,yaw:0}))),
 ...[23,29,35,41].map(z=>({x:47,z,width:5.8,yaw:Math.PI/2})),
].map(p=>({asset:'mine-fence' as const,...p,depth:.28,height:.85,y:0}));
