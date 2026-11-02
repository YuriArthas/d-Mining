import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]).sort();
const path = join(root, 'public/provenance/asset-inventory.json');
const inventory = JSON.parse(readFileSync(path));
const describe = (entry, base) => {
  const bytes = readFileSync(join(base, entry.file));
  return { ...entry, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
inventory.revision = 'r3';
inventory.status = 'Current runtime snapshot; authorization document collection excluded by user request';
inventory.runtimeAssetFiles = inventory.runtimeAssetFiles.map(entry => describe(entry, root));
inventory.authoringFiles = inventory.authoringFiles.map(entry => describe(entry, join(root, 'delivery-content')));
for (const group of inventory.assetGroups) group.production = JSON.parse(readFileSync(join(root, group.manifest)));
inventory.notes = [
  'Runtime assets are copied byte-for-byte from the current project snapshot.',
  'Selected authoring records retain their original and sanitized-copy hashes; no new provenance or license grant is asserted.',
  'Production records do not establish third-party licensing.',
];
const data = JSON.stringify(inventory, null, 2) + '\n';
writeFileSync(path, data);
writeFileSync(join(root, 'delivery-content/public/provenance/asset-inventory.json'), data);
console.log(`Refreshed ${inventory.runtimeAssetFiles.length + inventory.authoringFiles.length} asset file hashes; ${files(join(root, 'src/game/assets')).length} runtime files present`);
