import {PORTAL_SLOTS,type PortalSlot} from '../content/portalSlots.ts';
import {SURFACE_SITE} from './SurfaceSite.ts';
import { EGG_DISPLAY_ROWS } from '../content/petAppearance.ts';
import {PET_TIERS,PET_COLUMNS} from './PetTerraces.ts';
import {LAYERS,type Layer} from '../content/layers.ts';
import {themeById} from '../content/themes.ts';
export const EGG_ASSETS=['egg-meadow-blender','egg-crystal-blender','egg-ember-blender','egg-tide-blender','egg-moon-blender','egg-core-blender'] as const;
export const HUB_ASSETS=['portal-plinth-blender','portal-timber','portal-fungal','portal-crystal','portal-frozen','portal-volcanic','portal-fossil','portal-core',...EGG_ASSETS] as const;
export const PET_AREA=SURFACE_SITE.pet;
export const PORTAL_AREA=SURFACE_SITE.portal;
export const PORTAL_BASE_HEIGHT=.16;
export const PORTAL_MODEL={width:2.25,depth:1.4,height:1.9} as const;
export const PORTAL_PLINTH={width:2.55,depth:1.95,height:PORTAL_BASE_HEIGHT} as const;
export function portalsFor(layers:readonly Layer[],slots:Readonly<Record<string,PortalSlot>>=PORTAL_SLOTS){
 const occupied:{id:string;x:number;z:number}[]=[];
 return layers.slice(1).map(layer=>{
  const slot=slots[layer.id];if(!slot)throw Error(`传送庭院展位不足: ${layer.id}`);
  if(![slot.x,slot.z,slot.yaw].every(Number.isFinite))throw Error(`无效传送展位: ${layer.id}`);
  if(slot.x-1.6<PORTAL_AREA.minX||slot.x+1.6>PORTAL_AREA.maxX||slot.z-1.6<Math.max(PORTAL_AREA.minZ,SURFACE_SITE.redLine)||slot.z+1.6>PORTAL_AREA.maxZ)throw Error(`传送展位超出庭院边界: ${layer.id}`);
  // Include exit hysteresis; the resulting clearance also separates model footprints.
  for(const other of occupied)if(Math.hypot(slot.x-other.x,slot.z-other.z)<3.8)
   throw Error(`传送展位重叠: ${other.id} / ${layer.id}`);
  occupied.push({id:layer.id,x:slot.x,z:slot.z});
  return {id:layer.id,name:layer.name,depth:layer.from,color:themeById(layer.theme).accent,...slot,
   zone:{x:slot.x,y:0,z:slot.z,radius:1.6,heightTolerance:.25,hysteresis:.3}};
 });
}
export const SURFACE_PORTALS=portalsFor(LAYERS);
// Every tier contains six eggs, progressively higher and further east.
export const PET_DISPLAYS=PET_TIERS.flatMap(t=>PET_COLUMNS.map((z,i)=>({...t,z,id:`egg-stand-${t.tier}-${i}`,...EGG_DISPLAY_ROWS[t.tier][i],yaw:-Math.PI/2})));
export function portalPlacementsFor(portals:ReturnType<typeof portalsFor>){return [
 ...portals.map(p=>({asset:'portal-plinth-blender' as const,x:p.x,z:p.z,...PORTAL_PLINTH,y:0,yaw:p.yaw,portalId:p.id,portalAccent:p.color})),
 ...portals.map(p=>({asset:p.model,x:p.x,z:p.z,...PORTAL_MODEL,y:PORTAL_BASE_HEIGHT,yaw:p.yaw,portalId:p.id,tint:p.tint})),
];}
export const HUB_PLACEMENTS=[
 ...portalPlacementsFor(SURFACE_PORTALS),
 ...PET_DISPLAYS.map(p=>({asset:p.asset,x:p.x,z:p.z,width:2.7,depth:2.7,height:3.02,y:p.y,yaw:p.yaw})),
];
// Reassemble the existing low mining fence kit; courtyard entrances stay open.
export const HUB_FENCES=[
 // Back edges only: no rail across the plaza approach or either pet staircase.
 ...[20,26,32,38].map(z=>({x:44.5,z,width:5.8,yaw:Math.PI/2})),
 ...[18,24,30,36,42,48].map(z=>({x:-30.4,z,width:5.8,yaw:Math.PI/2})),
].map(p=>({asset:'mine-fence' as const,...p,depth:.28,height:.85,y:0}));
