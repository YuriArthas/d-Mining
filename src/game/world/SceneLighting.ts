import {SURFACE_BUILDINGS,SURFACE_SHOP,SURFACE_SALE} from './surfaceLayout.ts';
// Area lighting is authored independently of lamp meshes and their transforms.
// Decorative lamps can be added, removed or moved without changing this rig.
export const SURFACE_NIGHT={
 moonPosition:[-36,48,-46],moonColor:'#adcaff',moonIntensity:1.15,
 skyColor:'#8aabe7',groundColor:'#344966',ambientIntensity:.85,
 environmentIntensity:.65,
} as const;
export const SURFACE_AREA_LIGHT={id:'pit-area-key',position:[0,9.5,1],target:[0,-4,0],color:'#ffe0af',intensity:850,distance:44,angle:.95,penumbra:.7} as const;
// Only localized display lights cast extra shadows. Broad fill lighting must
// not allocate a shadow sampler per lamp: WebGL2 guarantees just 16 fragment units.
export const SURFACE_FILL_LIGHTS=[
 {id:'plaza-area',castShadow:false,position:[0,10,30],target:[0,0,27],color:'#ffdfad',intensity:220,distance:27,angle:1.15,penumbra:.95},
 ...[-37,-25].map(x=>({id:'pet-display-'+x,castShadow:true,position:[x,15,30] as const,target:[x,2,30] as const,color:'#ffe6c6',intensity:1250,distance:32,angle:1,penumbra:.8})),
 ...[[24,26],[39,33],[24,40]].map(([x,z],i)=>({id:'portal-court-'+i,castShadow:true,position:[x,12,z] as const,target:[x,0,z] as const,color:'#ffe8c4',intensity:850,distance:28,angle:1,penumbra:.8})),
 {id:'mine-facade-area',castShadow:false,position:[0,15,22],target:[0,9,10],color:'#ffe4b8',intensity:950,distance:34,angle:.95,penumbra:.8},
 {id:'shop-area',castShadow:false,position:[SURFACE_SHOP.x,7,SURFACE_SHOP.z],target:[SURFACE_BUILDINGS.shop.x,1,SURFACE_BUILDINGS.shop.z],color:'#ffcf8a',intensity:650,distance:24,angle:1.1,penumbra:.85},
 {id:'sell-area',castShadow:false,position:[SURFACE_SALE.x,7,SURFACE_SALE.z],target:[SURFACE_BUILDINGS.sale.x,1,SURFACE_BUILDINGS.sale.z],color:'#ffdb9a',intensity:650,distance:24,angle:1.1,penumbra:.85},
] as const;
