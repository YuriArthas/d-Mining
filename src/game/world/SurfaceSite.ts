// Approved V3 plan: from spawn facing the mine, portals LEFT, eggs RIGHT.
// Flat construction envelope is 81 x 90 m. Terrain modules sit outside it.
export const SURFACE_SITE={
 boundary:{left:-39,right:57,back:-31,front:73,pitch:8,setback:4,module:8.6,levels:4,rise:3.35,base:-.25},
 interior:{minX:-34.7,maxX:52.7,minZ:-26.7,maxZ:68.7},
 construction:{minX:-34,maxX:47,minZ:-24,maxZ:66},
 grounds:{width:208,depth:208},
 buffer:4,
 redLine:13,
 pet:{minX:19,maxX:43,minZ:14,maxZ:46},
 portal:{minX:-30,maxX:-20,minZ:14,maxZ:50},
 plaza:{minX:-19,maxX:19,minZ:14,maxZ:46},
 sale:{minX:-19,maxX:-5,minZ:46,maxZ:62},
 shop:{minX:5,maxX:19,minZ:46,maxZ:62},
} as const;
