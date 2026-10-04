// Small reusable components; the building silhouette is authored on the voxel grid.
const shape='Exactly ONE solid cubic building block, equal width height depth, SIX FLAT SQUARE FACES, straight parallel edges, perfectly regular box silhouette. Minecraft building block meets modern Roblox Mining Simulator. Extremely tiny edge bevel only. No bulges, no taper, no warping, no protrusions, no pedestal, no other objects. Centered isolated complete cube. Details painted into the texture, NOT modeled. Simple clean saturated matte colors, no weathering, no realistic scratches.';
export const gridMine={
 'grid-mine-timber':{faceLimit:200,prompt:`${shape} Warm honey brown timber log cube. Subtle broad straight vertical wood grain on the four side faces, simple square concentric end grain on top and bottom. No bands, no nails, no metal. A single modular timber voxel.`},
 'grid-mine-trim':{faceLimit:200,prompt:`${shape} Smooth warm ivory painted wooden cube, nearly uniform cream color, only very faint wide wood grain. No ornaments, no patterns, no dark outline. A single modular white trim voxel.`},
 'grid-mine-roof':{faceLimit:200,prompt:`${shape} Rich saturated cobalt blue painted wooden cube. Nearly uniform blue faces with faint broad straight painted wood grain. No individual shingles, no metal, no studs, no raised details. A single modular blue roof voxel.`},
};
for(const material of ['timber','trim','roof']){
 const name=`grid-mine-${material}-v2`;
 gridMine[name]={faceLimit:200,prompt:`Image-guided regular Roblox/Minecraft ${material} cube, unchanged planar geometry.`,image:`output/imagegen/grid-mine/${name}.png`};
}
