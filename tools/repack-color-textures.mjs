import {readFileSync, writeFileSync, readdirSync, mkdirSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {encodeColorTextures, COLOR_ENCODING} from './lib/encodeColorTextures.mjs';
import {geometryHash} from './lib/glbBuffers.mjs';
const directory = 'src/game/assets/camp';
const reportDirectory = 'artifacts/texture-encoding';
mkdirSync(`${reportDirectory}/original`, {recursive:true});
const selectionPath = 'assets-source/quarry-v2/contact-bake/selection.json';
const selection = JSON.parse(readFileSync(selectionPath));
// Anchor geometry identities to the exact transport used for the existing bake.
for (const source of selection.sources) {
  if (source.geometrySha256) continue;
  const manifest = JSON.parse(readFileSync(`${directory}/${source.asset}.manifest.json`));
  if (manifest.sha256 !== source.transportSha256) throw Error('Bake provenance does not match before repacking');
  source.geometrySha256 = geometryHash(gunzipSync(Buffer.concat(manifest.parts.map(part => readFileSync(`${directory}/${part}`)))));
}
const report = [];
for (const name of readdirSync(directory).filter(name => name.endsWith('.manifest.json'))) {
  const path = `${directory}/${name}`, manifest = JSON.parse(readFileSync(path));
  if (manifest.materialProfile === 'authored-color' || manifest.materialProfile === 'solid-color' || name === 'bank-steps.manifest.json') continue;
  if (manifest.colorEncoding?.codec === 'ETC1S') continue;
  const asset = name.replace('.manifest.json','');
  const original = Buffer.concat(manifest.parts.map(part => readFileSync(`${directory}/${part}`)));
  const decoded = gunzipSync(original);
  writeFileSync(`${reportDirectory}/original/${asset}.gz`, original);
  const source = readFileSync(`assets-source/quarry-v2/${asset}/textures.glb`);
  const output = encodeColorTextures(decoded, source, `${reportDirectory}/encoded/${asset}`);
  const transport = gzipSync(output, {level:9});
  if (manifest.parts.length !== 1 || transport.length > 4*1024*1024) throw Error('Repacker requires a single bounded transport part');
  const before = manifest.bytes, originalSha256 = manifest.sha256;
  Object.assign(manifest, {bytes:transport.length,decodedBytes:output.length,sha256:createHash('sha256').update(transport).digest('hex'),geometrySha256:geometryHash(output),colorEncoding:COLOR_ENCODING});
  writeFileSync(`${directory}/${manifest.parts[0]}`, transport);
  writeFileSync(path, JSON.stringify(manifest));
  writeFileSync(`assets-source/quarry-v2/${asset}/runtime.glb`, output);
  writeFileSync(`assets-source/quarry-v2/${asset}/runtime.json`, JSON.stringify(manifest,null,2));
  report.push({asset,before,after:transport.length,originalSha256,sha256:manifest.sha256,geometrySha256:manifest.geometrySha256,geometryUnchanged:true,otherTexturesUnchanged:true});
  console.log(asset, before, '->', transport.length);
}
writeFileSync(selectionPath, JSON.stringify(selection,null,2));
if (report.length) writeFileSync(`${reportDirectory}/repack.json`, JSON.stringify(report,null,2));
