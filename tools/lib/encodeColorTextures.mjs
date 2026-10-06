import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {readGlb, viewBytes, replaceImages} from './glbBuffers.mjs';

export const COLOR_ENCODING = {codec:'ETC1S',quality:200,compressionLevel:2,resize:false};
export function encodeColorTextures(runtime, source, directory) {
  mkdirSync(directory, {recursive:true});
  const packed = readGlb(runtime), original = readGlb(source);
  const colorImages = new Set();
  const imageIndex = (document, index) => {
    const texture = document.textures[index];
    return texture.extensions?.KHR_texture_basisu?.source ?? texture.source;
  };
  for (const material of packed.document.materials) {
    const color = material.pbrMetallicRoughness?.baseColorTexture;
    if (color) colorImages.add(imageIndex(packed.document, color.index));
  }
  const replacements = new Map();
  for (const index of colorImages) {
    const image = packed.document.images[index];
    const matches = original.document.images.filter(candidate => candidate.name === image.name);
    if (matches.length !== 1 || matches[0].mimeType !== 'image/png') throw Error(`Missing unique source PNG: ${image.name}`);
    const png = viewBytes(original.binary, original.document.bufferViews[matches[0].bufferView]);
    const previous = viewBytes(packed.binary, packed.document.bufferViews[image.bufferView]);
    if (png.readUInt32BE(16) !== previous.readUInt32LE(20) || png.readUInt32BE(20) !== previous.readUInt32LE(24)) throw Error('Source and shipped texture dimensions differ');
    const input = join(directory, `${index}.png`), output = join(directory, `${index}.ktx2`);
    writeFileSync(input, png);
    const result = spawnSync(`${process.env.KTX_BIN ?? '/opt/ktx/bin'}/ktx`, ['create','--format','R8G8B8A8_SRGB','--assign-tf','srgb','--generate-mipmap','--encode','basis-lz','--qlevel',String(COLOR_ENCODING.quality),'--clevel','2','--threads','2',input,output], {encoding:'utf8'});
    if (result.status !== 0) throw Error(result.stderr || 'KTX color encoding failed');
    const encoded = readFileSync(output);
    if (encoded.readUInt32LE(40) !== previous.readUInt32LE(40)) throw Error('Mip count changed');
    replacements.set(index, encoded);
  }
  const output = replaceImages(runtime, replacements), after = readGlb(output);
  for (const [index, image] of packed.document.images.entries()) {
    if (colorImages.has(index)) continue;
    const beforeBytes = viewBytes(packed.binary, packed.document.bufferViews[image.bufferView]);
    const afterBytes = viewBytes(after.binary, after.document.bufferViews[image.bufferView]);
    if (!beforeBytes.equals(afterBytes)) throw Error('Non-color texture changed');
  }
  return output;
}
