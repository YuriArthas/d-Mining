import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readGlb, viewBytes, geometryHash, replaceImages} from '../lib/glbBuffers.mjs';
const directory = 'src/game/assets/camp';
function model(name) {
  const manifest = JSON.parse(readFileSync(`${directory}/${name}.manifest.json`));
  const bytes = gunzipSync(Buffer.concat(manifest.parts.map(part => readFileSync(`${directory}/${part}`))));
  return {manifest, bytes, ...readGlb(bytes)};
}
test('generated color textures use ETC1S; data maps retain UASTC and authored atlases stay intact', () => {
  let converted = 0;
  for (const filename of readdirSync(directory).filter(name => name.endsWith('.manifest.json'))) {
    const {manifest, document, binary, bytes} = model(filename.replace('.manifest.json',''));
    if (manifest.colorEncoding?.codec !== 'ETC1S') continue;
    converted++;
    assert.equal(geometryHash(bytes), manifest.geometrySha256);
    for (const material of document.materials) {
      for (const [role, slot] of Object.entries({color:material.pbrMetallicRoughness?.baseColorTexture,normal:material.normalTexture,roughness:material.pbrMetallicRoughness?.metallicRoughnessTexture})) {
        if (!slot) continue;
        const image = document.images[document.textures[slot.index].extensions.KHR_texture_basisu.source];
        const ktx = viewBytes(binary, document.bufferViews[image.bufferView]);
        const dfdOffset = ktx.readUInt32LE(48);
        assert.equal(ktx[dfdOffset + 12], role === 'color' ? 163 : 166, `${filename} ${role}`);
      }
    }
  }
  assert.equal(converted, 66);
  for (const name of ['grid-mine-timber-blender','egg-meadow-blender']) assert.equal(model(name).manifest.colorEncoding, undefined);
});
test('geometry identity survives image repacking but detects changed geometry bytes', () => {
  const {bytes, document, binary} = model('workshop-hut');
  const replacement = Buffer.from(viewBytes(binary, document.bufferViews[document.images[0].bufferView]));
  replacement[replacement.length - 1] ^= 1;
  const repacked = replaceImages(bytes, new Map([[0, replacement]]));
  assert.equal(geometryHash(repacked), geometryHash(bytes));
  const changed = Buffer.from(bytes);
  const meshView = document.bufferViews.find(view => view.extensions?.EXT_meshopt_compression);
  const packed = meshView.extensions.EXT_meshopt_compression;
  changed[28 + changed.readUInt32LE(12) + (packed.byteOffset ?? 0)] ^= 1;
  assert.notEqual(geometryHash(changed), geometryHash(bytes));
});
