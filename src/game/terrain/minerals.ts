import { RESOURCES, resourceByKind } from '../content/resources.ts';
import { THEMES } from '../content/themes.ts';
import { LAYERS, layerAtDepth, type Layer } from '../content/layers.ts';
export const MINERALS = RESOURCES.map(r=>({id:r.kind,name:r.name,color:r.color}));
// Explicit atlas slots; stable logical IDs are never derived from array positions.
export const TERRAIN_MATERIALS = [...MINERALS, {id:7,name:'固定地面',color:THEMES[0].floor}].sort((a,b)=>a.id-b.id);
export const TILE_SIZE = 64;
export const ATLAS_TILES = TERRAIN_MATERIALS.length + THEMES.length - 1;
const slots = new Map(TERRAIN_MATERIALS.map((r,i)=>[r.id,i]));
const floorSlots = new Map(THEMES.map((t,i)=>[t.id,i===0?slots.get(7)!:TERRAIN_MATERIALS.length+i-1]));
export function appearanceKey(kind: number, y: number, layers: readonly Layer[] = LAYERS) {
  if (!kind) return 0;
  const tile = kind === 7 ? floorSlots.get(layerAtDepth(-(y+1)*2,layers).theme) : slots.get(kind);
  if(tile===undefined)throw new Error(`未知地形外观 ${kind}`);
  return tile + 1;
}
export function mineralName(id: number) { return id && id!==7 ? resourceByKind(id).name : ''; }
export const ORE_SAMPLES = [
  {name:'整片',x:-16,z:-32,spawn:[-15,0.1,-47] as const},
  {name:'条带',x:0,z:-32,spawn:[17,0.1,-47] as const},
  {name:'交错',x:16,z:-32,spawn:[49,0.1,-47] as const},
];
export function sampleMineral(x:number,y:number,z:number):number|null {
  if(y < -16 || y >= 0 || z < -32 || z >= -16 || x < -16 || x >= 32)return null;
  if(x<0)return 1;
  if(x<16)return 1+Math.floor(x*6/16);
  return 1+((x-16+z+32)%6);
}
function rgb(hex: string) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
// Shared coarse texel atlas: material detail never changes sparse cells or meshing keys.
export function mineralAtlas() { return buildMineralAtlas(false); }
export function mineralResponseAtlas() { return buildMineralAtlas(true); }
function grain(x:number,y:number,seed:number){
 let n=Math.imul(x+seed*71,374761393)^Math.imul(y+seed*19,668265263);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function buildMineralAtlas(response:boolean) {
 const pixels=new Uint8Array(TILE_SIZE*TILE_SIZE*ATLAS_TILES*4);
 for(let tile=0;tile<ATLAS_TILES;tile++){
  const entry=TERRAIN_MATERIALS[tile],floor=!entry||entry.id===7;
  const r=floor?null:resourceByKind(entry.id),color=rgb(entry?.color??THEMES[tile-TERRAIN_MATERIALS.length+1].floor);
  const host=r&&!r.base?rgb(r.kind===6?'#6e8287':'#777d79'):color;
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
    if(r!.base){
     if(r!.pattern==='soil'){
      shade+=(grain(Math.floor(px/3),Math.floor(py/2),83)>.77?11:0);
      if(fine<.11)shade-=13;
     }else if(r!.pattern==='strata')shade+=(py+Math.floor(px/7))%9<2?-14:3;
     else if(r!.pattern==='ice')shade+=Math.abs(px-Math.floor(py*.6)-7)<2?23:0;
     else if(r!.pattern==='metal')shade+=px%9<2?9:0;
     else if(r!.pattern==='fossil')shade+=Math.abs(Math.hypot(px-18,py-17)-8)<1.3?22:0;
     else if(r!.pattern==='core')shade+=fine>.78?14:-3;
    }else{
     for(const d of deposits){
      const dx=px-d.x,dy=py-d.y,ax=Math.abs(dx),ay=Math.abs(dy),pattern=r!.pattern;
      const dist=pattern==='vein'||pattern==='metal'?Math.max(ax*.62+ay*.27,ay*1.22+ax*.16):pattern==='crystal'||pattern==='gem'||pattern==='star'?ax*.73+ay*.9:pattern==='fossil'?Math.max(ax*.5,ay*1.5):Math.max(ax+ay*.24,ay+ax*.29);
      const cut=d.size+(grain(px,py,tile+91)-.5)*1.6;
      if(dist<cut){mark=true;edge=dist>cut-.9;facet=dy<0?12:-10;break;}
     }
     // Fine broken fragments follow the major deposits rather than covering the host.
     if(!mark&&fine>.975&&medium>.56){mark=true;edge=true;}
    }
    // Irregular subtle chips, not an evenly outlined paving tile.
    if((px===0||py===0||px===31||py===31)&&medium<.6)shade-=8;
   }
   if(mark)shade+=(edge?-22:facet)+(fine-.5)*12;
   const i=(y*ATLAS_TILES*TILE_SIZE+tile*TILE_SIZE+x)*4;
   if(response){
    const metal=r&&(r.pattern==='metal'||[4,5,16,17,27,28].includes(r.kind));
    const glass=r&&['ice','crystal','gem','star','amber'].includes(r.pattern);
    const inclusion=!!r&&(r.base||mark);
    const h=mark?1:0;
    pixels[i]=Math.round(h*255);
    pixels[i+1]=Math.round((inclusion&&metal?.38:inclusion&&glass?.32:.96)*255);
    pixels[i+2]=Math.round((inclusion&&metal?.65:0)*255);
   }else{
    const c=mark?color:host;
    for(let k=0;k<3;k++)pixels[i+k]=Math.max(0,Math.min(255,Math.round(c[k]+shade)));
   }
   pixels[i+3]=255;
  }
 }
 return pixels;
}
