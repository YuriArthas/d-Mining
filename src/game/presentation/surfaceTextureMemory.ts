import { CompressedTexture, RGBAFormat, RGBFormat, type Texture } from 'three';

// Encoded mip payload, not a driver/process-memory claim. ORM slots and repeated
// instances share sources; count their storage once.
export function surfaceTextureMemory(textures:Iterable<Texture>){
 const sources=new Set<number>(),maps:{width:number;height:number;format:number;levels:number;bytes:number;compressed:boolean}[]=[];
 for(const texture of textures){
  if(sources.has(texture.source.id))continue;
  sources.add(texture.source.id);
  const compressed=texture instanceof CompressedTexture&&Number(texture.format)!==RGBAFormat&&Number(texture.format)!==RGBFormat;
  const image=texture.image as {width:number;height:number};
  const bytes=compressed?texture.mipmaps.reduce((n,m)=>n+(m as {data:Uint8Array}).data.byteLength,0):Math.ceil(image.width*image.height*4*(texture.generateMipmaps?4/3:1));
  maps.push({width:image.width,height:image.height,format:texture.format,levels:texture.mipmaps.length,bytes,compressed});
 }
 return {uniqueSources:maps.length,allCompressed:maps.every(m=>m.compressed),encodedMipBytes:maps.reduce((n,m)=>n+m.bytes,0),maps};
}
