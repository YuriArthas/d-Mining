import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const manifest = JSON.parse(readFileSync(join(root, 'SOURCE_MANIFEST.json'), 'utf8'));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
for (const [path, expected] of Object.entries(manifest)) if (hash(join(root, path)) !== expected) throw Error(`Source differs from export snapshot: ${path}`);
function files(dir) { return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
for (const path of [...files('src'), ...files('public')]) if (!(path in manifest)) throw Error(`Unexpected source file: ${path}`);
console.log(`Verified ${Object.keys(manifest).length} unchanged shared source files`);
