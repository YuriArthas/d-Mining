// Fixture transforms and illumination remain separate descriptors at shared anchors.
export const STREET_LIGHTS=[
 ...[-11,11].map(x=>({
  id:x<0?'west-road-lamp':'east-road-lamp',
  fixture:{asset:'lantern-post' as const,x,z:40,y:.02,width:1.4,depth:1.31,height:6,yaw:0},
  light:{position:[x,4.75,40] as const,color:'#ffda9b',intensity:150,distance:20,decay:2},
 })),
 // Border the two activity courts, clear of the pond banks, aisles and stairs.
 ...[-18,18].flatMap(x=>[13,44].map(z=>({
  id:`court-lamp-${x<0?'portal':'egg'}-${z}`,
  fixture:{asset:'lantern-post' as const,x,z,y:.02,width:1,depth:.94,height:4.4,yaw:0},
  light:{position:[x,3.5,z] as const,color:'#ffe0a5',intensity:55,distance:12,decay:2},
 }))),
];
// These glowing work lamps sit inside existing shop/mine area illumination.
// Adding a visible fixture does not implicitly allocate another real light.
export const SUPPORT_LANTERNS=[
 {id:'sale-door-lantern',x:-18,z:51},
 {id:'shop-door-lantern',x:18,z:51},
 {id:'mine-rear-lantern',x:13.8,z:-13.8},
 {id:'west-workyard-lantern',x:-24,z:5},
].map(({id,...p})=>({id,fixture:{asset:'pit-box-lantern' as const,...p,y:.02,width:.7,depth:.7,height:2.7,yaw:0}}));
