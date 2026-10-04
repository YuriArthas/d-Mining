// Replace baked AI lighting with a plain base color. Original mesh data untouched.
import {readFileSync,writeFileSync} from 'node:fs';
import {Color} from 'three';
const [input,output,color]=process.argv.slice(2),source=readFileSync(input);
const length=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+length));
const rgb=new Color(color).toArray();
for(const m of doc.materials){
 for(const key of Object.keys(m))delete m[key];
 Object.assign(m,{name:'Roblox painted block',pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:0,roughnessFactor:.82},doubleSided:false});
}
delete doc.images;delete doc.textures;delete doc.samplers;
for(const field of ['extensionsUsed','extensionsRequired'])if(doc[field])doc[field]=doc[field].filter(x=>!['EXT_texture_webp','KHR_texture_transform'].includes(x));
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),bin=source.subarray(20+length);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
writeFileSync(output,Buffer.concat([header,padded,bin]));
