import { RESOURCES, resourceByKind } from '../content/resources.ts';
import { THEMES } from '../content/themes.ts';
import { layerAtDepth, type Layer } from '../content/layers.ts';
export const MINERALS = RESOURCES.map(r=>({id:r.kind,name:r.name,color:r.color}));
// Explicit atlas slots; stable logical IDs are never derived from array positions.
export const TERRAIN_MATERIALS = [...MINERALS, {id:7,name:'固定地面',color:THEMES[0].floor}].sort((a,b)=>a.id-b.id);
export const TILE_SIZE = 64;
const ATLAS_TILES = TERRAIN_MATERIALS.length + THEMES.length - 1;
export const ATLAS_COLUMNS = 16;
export const ATLAS_ROWS = Math.ceil(ATLAS_TILES / ATLAS_COLUMNS);
export const ATLAS_WIDTH = ATLAS_COLUMNS * TILE_SIZE;
export const ATLAS_HEIGHT = ATLAS_ROWS * TILE_SIZE;
const slots = new Map(TERRAIN_MATERIALS.map((r,i)=>[r.id,i]));
const floorSlots = new Map(THEMES.map((t,i)=>[t.id,i===0?slots.get(7)!:TERRAIN_MATERIALS.length+i-1]));
export function appearanceKey(kind: number, y: number, layers: readonly Layer[]) {
  if (!kind) return 0;
  const tile = kind === 7 ? floorSlots.get(layerAtDepth(-(y+1)*2,layers).theme) : slots.get(kind);
  if(tile===undefined)throw new Error(`未知地形外观 ${kind}`);
  return tile + 1;
}
export function mineralName(id: number) { return id && id!==7 ? resourceByKind(id).name : ''; }
function rgb(hex: string) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
// Shared coarse texel atlas: material detail never changes sparse cells or meshing keys.
export function mineralAtlas() { return buildMineralAtlas(false); }
export function mineralResponseAtlas() { return buildMineralAtlas(true); }
function grain(x:number,y:number,seed:number){
 let n=Math.imul(x+seed*71,374761393)^Math.imul(y+seed*19,668265263);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function buildMineralAtlas(response:boolean) {
 const pixels=new Uint8Array(ATLAS_WIDTH*ATLAS_HEIGHT*4);
 for(let tile=0;tile<ATLAS_TILES;tile++){
  const entry=TERRAIN_MATERIALS[tile],floor=!entry||entry.id===7;
  const r=floor?null:resourceByKind(entry.id),color=rgb(entry?.color??THEMES[tile-TERRAIN_MATERIALS.length+1].floor);
  const host=r&&!r.base?rgb('#777d79'):color;
  // Independent irregular deposits per material, no four identical polished lozenges.
  const deposits=Array.from({length:8},(_,i)=>({x:3+grain(i,7,tile)*26,y:3+grain(i,13,tile)*26,size:2.1+grain(i,29,tile)*3.2}));
  for(let y=0;y<TILE_SIZE;y++)for(let x=0;x<TILE_SIZE;x++){
   const px=Math.floor(x/2),py=Math.floor(y/2);
   const broad=grain(Math.floor(px/5),Math.floor(py/5),tile),medium=grain(Math.floor(px/2),Math.floor(py/2),tile+23),fine=grain(px,py,tile+43);
   let shade=(floor||r?.base)?0:(broad-.5)*24+(medium-.5)*17+(fine-.5)*14;
   let mark=false,edge=false,facet=0,fracture=false;
   if(!floor&&!r!.base){
    // Short jagged fractures and layered grain remain distinct from damage cracks.
    const seam=Math.floor(9+py*.27)+Math.floor(py/6)%2;
    fracture=(px===seam&&py>6&&py<25)||(py===Math.floor(23-px*.18)&&px>17&&px<28);
    if(fracture)shade-=13;
    // Veins and metals run in streaks; gems sit as glassy facets.
    for(const d of deposits){
     const dx=px-d.x,dy=py-d.y,ax=Math.abs(dx),ay=Math.abs(dy);
     const dist=r!.pattern==='gem'?ax*.73+ay*.9:Math.max(ax*.62+ay*.27,ay*1.22+ax*.16);
     const cut=d.size+(grain(px,py,tile+91)-.5)*1.6;
     if(dist<cut){mark=true;edge=dist>cut-.9;facet=dy<0?12:-10;break;}
    }
    // Fine broken fragments follow the major deposits rather than covering the host.
    if(!mark&&fine>.975&&medium>.56){mark=true;edge=true;}
    // Irregular subtle chips, not an evenly outlined paving tile.
    if((px===0||py===0||px===31||py===31)&&medium<.6)shade-=8;
   }
   if(mark)shade+=(edge?-22:facet)+(fine-.5)*12;
   const i=((Math.floor(tile/ATLAS_COLUMNS)*TILE_SIZE+y)*ATLAS_WIDTH+(tile%ATLAS_COLUMNS)*TILE_SIZE+x)*4;
   if(response){
    const metal=r?.pattern==='metal',glass=r?.pattern==='gem';
    const inclusion=!!r&&(r.base||mark);
    const h=mark?1:0;
    pixels[i]=Math.round(h*255);
    pixels[i+1]=Math.round((inclusion&&metal?.38:inclusion&&glass?.32:.96)*255);
    pixels[i+2]=Math.round((inclusion&&metal?.65:0)*255);
   }else{
    // Ore tiles store colour premultiplied by the inclusion mask: host pixels are black and the
    // shader adds the layer's host rock by (1 - mask), so mip levels blend coverage correctly.
    const c=mark?color:host,premultipliedHost=!mark&&!!r&&!r.base;
    for(let k=0;k<3;k++)pixels[i+k]=premultipliedHost?0:Math.max(0,Math.min(255,Math.round(c[k]+shade)));
   }
   pixels[i+3]=255;
  }
 }
 return pixels;
}
