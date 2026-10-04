// Area lighting is authored independently of lamp meshes and their transforms.
// Decorative lamps can be added, removed or moved without changing this rig.
export const SURFACE_NIGHT={
 moonPosition:[-36,48,-46],moonColor:'#adcaff',moonIntensity:1.15,
 skyColor:'#8aabe7',groundColor:'#344966',ambientIntensity:.85,
 environmentIntensity:.65,
} as const;
export const SURFACE_AREA_LIGHT={id:'pit-area-key',position:[0,9.5,1],target:[0,-4,0],color:'#ffe0af',intensity:850,distance:44,angle:.95,penumbra:.7} as const;
export const SURFACE_FILL_LIGHTS=[
 {id:'plaza-area',position:[0,10,30],target:[0,0,27],color:'#ffdfad',intensity:220,distance:27,angle:1.15,penumbra:.95},
 {id:'pet-display-area',position:[-22,12,31],target:[-22,0,25],color:'#ffe6c6',intensity:1200,distance:32,angle:1,penumbra:.8},
 ...[-13,8,29].map(z=>({id:'portal-walk-'+z,position:[28,12,z] as const,target:[32,0,z] as const,color:'#ffe8c4',intensity:850,distance:28,angle:1,penumbra:.8})),
 {id:'mine-facade-area',position:[0,15,22],target:[0,9,10],color:'#ffe4b8',intensity:950,distance:34,angle:.95,penumbra:.8},
 {id:'shop-area',position:[-19,7,11],target:[-17,0,13],color:'#ffcf8a',intensity:650,distance:24,angle:1.1,penumbra:.85},
 {id:'sell-area',position:[19,7,10],target:[16,0,12],color:'#ffdb9a',intensity:650,distance:24,angle:1.1,penumbra:.85},
] as const;
