import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { join, relative, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(process.argv[2]);
const reportPath = resolve(process.argv[3] ?? 'artifacts/delivery-contract-20261102/content-audit.json');
const project = resolve(root, '../..');
const files = d => readdirSync(d, { withFileTypes: true }).filter(e => e.name !== 'node_modules').flatMap(e => e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]).sort();
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const forbidden = /sunjun|clock-p|yuriarthas|threejs_space|roblox_space|\/root\/|\/Users\//i;
const audit = { files: 0, privateHits: [], sharedSources: 0, glbMetadata: 0, sceneBundles: 0, inventoryEntries: 0 };
function glb(data, label) {
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) throw Error(`Invalid GLB ${label}`);
  const text = data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'), parsed = JSON.parse(text);
  if (forbidden.test(text)) throw Error(`Private GLB metadata: ${label}`);
  for (const entry of [...parsed.buffers ?? [], ...parsed.images ?? []]) if (entry.uri && !entry.uri.startsWith('data:')) throw Error(`External GLB URI: ${label}`);
  audit.glbMetadata++;
}
for (const path of files(root)) {
  const rel = relative(root, path), bytes = readFileSync(path), ext = extname(path);
  audit.files++;
  if (forbidden.test(rel) || forbidden.test(bytes.toString('utf8'))) audit.privateHits.push(rel);
  if (ext === '.glb') glb(bytes, rel);
}
const scene = join(root, 'src/game/assets/scene');
for (const path of files(scene).filter(p => p.endsWith('.manifest.json'))) {
  const m = JSON.parse(readFileSync(path)), packed = Buffer.concat(m.parts.map(part => readFileSync(join(scene, part))));
  if (packed.length !== m.bytes || createHash('sha256').update(packed).digest('hex') !== m.sha256) throw Error(`Scene hash differs: ${path}`);
  const data = gunzipSync(packed);
  if (data.length !== m.decodedBytes) throw Error(`Decoded size differs: ${path}`);
  glb(data, relative(root, path)); audit.sceneBundles++;
}
const source = JSON.parse(readFileSync(join(root, 'SOURCE_MANIFEST.json')));
for (const [path, expected] of Object.entries(source)) {
  if (hash(join(root, path)) !== expected || hash(join(project, path)) !== expected) throw Error(`Shared source differs: ${path}`);
  audit.sharedSources++;
}
const inventory = JSON.parse(readFileSync(join(root, 'public/provenance/asset-inventory.json')));
for (const row of [...inventory.runtimeAssetFiles, ...inventory.authoringFiles]) {
  if (hash(join(root, row.file)) !== row.sha256) throw Error(`Inventory hash differs: ${row.file}`);
  audit.inventoryEntries++;
}
if (audit.privateHits.length) throw Error(`Private identifiers in ${audit.privateHits.join(', ')}`);
audit.noSharedSourcePatches = true;
writeFileSync(reportPath, JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit));
