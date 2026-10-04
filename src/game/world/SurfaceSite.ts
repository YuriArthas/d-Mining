// One site envelope for scenery, planting and functional-area clearances.
// Distances are metres. The mining grid remains independent and unchanged.
export const SURFACE_SITE={
 boundary:{left:-60,right:60,back:-44,front:68,pitch:8,module:8.6,levels:4,rise:3.35,base:-.25},
 interior:{minX:-55.7,maxX:55.7,minZ:-39.7,maxZ:63.7},
 grounds:{width:208,depth:208},
 buffer:8,
 pet:{minX:-47,maxX:-16,minZ:13,maxZ:49},
 portal:{minX:11,maxX:47.5,minZ:19,maxZ:48},
} as const;
