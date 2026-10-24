import {PINEWIND_SERVICES,PINEWIND_SPAWN,PINEWIND_PLAZA} from '../content/pinewind/hubLayout.ts';
const {sale:SALE,shop:SHOP,bags:BAGS}=PINEWIND_SERVICES;
// Night uses broad neutral fill to retain material hues; local warm spots only add accents.
// Area lighting is authored independently of lamp meshes and their transforms.
// Decorative lamps can be added, removed or moved without changing this rig.
export const SURFACE_NIGHT={
 moonPosition:[-30,38,-56],moonColor:'#c6deff',moonIntensity:2.25,
 skyColor:'#cfdef5',groundColor:'#8b937c',ambientIntensity:1.3,
 environmentIntensity:.65,
} as const;
export type SurfaceTime='day'|'night';
export const SURFACE_DAY={
 moonPosition:[-36,60,-46],moonColor:'#fff0d3',moonIntensity:2.5,
 skyColor:'#c9eaff',groundColor:'#b7c58e',ambientIntensity:.75,
 environmentIntensity:.55,
} as const;
export const SURFACE_LIGHTING={day:SURFACE_DAY,night:SURFACE_NIGHT} as const;
/** One time of day's surface light: sun (or moon), sky/ground fill and image-based light. */
export type SurfaceLookValues={moonPosition:readonly [number,number,number];moonColor:string;moonIntensity:number;skyColor:string;groundColor:string;ambientIntensity:number;environmentIntensity:number};
export type SurfaceLookOverride=Partial<Record<SurfaceTime,Partial<SurfaceLookValues>>>;
/** Renderer exposure under Neutral tone mapping. */
export const SURFACE_EXPOSURE=1.08;
export const SURFACE_AREA_LIGHT={id:'pit-area-key',position:[0,9.5,1],target:[0,-4,0],color:'#ffe0af',intensity:850,distance:44,angle:.95,penumbra:.7} as const;
// All lights only illuminate; selected ground contact occlusion is baked offline.
export const SURFACE_FILL_LIGHTS=[
 // Broad road fill bridges the two distant lamp pools, with a fully feathered edge.
 {id:'plaza-area',castShadow:false,position:[PINEWIND_PLAZA.x,18,PINEWIND_PLAZA.z+6],target:[PINEWIND_PLAZA.x,0,PINEWIND_PLAZA.z+6],color:'#ffeccc',intensity:1400,distance:60,angle:1.05,penumbra:1},
 ...[37,25].map(x=>({id:'pet-display-'+x,castShadow:false,position:[x,17,30] as const,target:[x,2,30] as const,color:'#ffead4',intensity:450,distance:40,angle:1.1,penumbra:1})),
 // The spawn and the teleport station beside it.
 ...[[-9,50],[0,57],[9,50]].map(([x,z],i)=>({id:'spawn-area-'+i,castShadow:false,position:[PINEWIND_SPAWN.x+x,12,z] as const,target:[PINEWIND_SPAWN.x+x,0,z] as const,color:'#fff0d9',intensity:220,distance:35,angle:1.05,penumbra:1})),
 {id:'mine-facade-area',castShadow:false,position:[0,20,22],target:[0,8,10],color:'#ffe8c9',intensity:320,distance:45,angle:1.05,penumbra:1},
 // One light between the two west shops (the pickaxe forge and the pack shop) covers both fronts.
 {id:'shop-area',castShadow:false,position:[(SHOP.trigger.x+BAGS.trigger.x)/2,13,(SHOP.trigger.z+BAGS.trigger.z)/2],target:[(SHOP.center[0]+BAGS.center[0])/2,1,(SHOP.center[2]+BAGS.center[2])/2],color:'#ffe4be',intensity:220,distance:38,angle:1.25,penumbra:1},
 {id:'sell-area',castShadow:false,position:[SALE.trigger.x,13,SALE.trigger.z],target:[SALE.center[0],1,SALE.center[2]],color:'#ffe4be',intensity:170,distance:34,angle:1.15,penumbra:1},
] as const;
