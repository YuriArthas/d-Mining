import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const out = resolve(process.argv[2]);
const lock = JSON.parse(readFileSync(join(out, 'package-lock.json')));
const inventory = [];
const put = (p, bytes) => { mkdirSync(dirname(join(out, p)), { recursive: true }); writeFileSync(join(out, p), bytes); };
const sha = data => createHash('sha256').update(data).digest('hex');
for (const [path, item] of Object.entries(lock.packages)) {
  if (!path) continue;
  const installed = existsSync(join(out, path, 'package.json'));
  const name = path.split('node_modules/').at(-1);
  const row = { name, version: item.version, license: item.license, development: !!item.dev, installed, licenses: [] };
  if (installed) {
    for (const f of readdirSync(join(out, path)).filter(f => /^(licen[cs]e|copying|notice)([.\-_]|$)/i.test(f))) {
      const bytes = readFileSync(join(out, path, f));
      const dest = `licenses/dependencies/${name.replaceAll('/', '__')}/${f}`;
      put(dest, bytes); row.licenses.push({ file: dest, sha256: sha(bytes) });
    }
  }
  const upstream = {
    '@dimforge/rapier3d-compat': ['rapier', 'https://raw.githubusercontent.com/dimforge/rapier.js/v0.19.3/LICENSE'],
    '@react-three/fiber': ['fiber', 'https://raw.githubusercontent.com/pmndrs/react-three-fiber/v9.8.1/LICENSE'],
    '@rolldown/binding-linux-x64-gnu': ['rolldown', 'https://raw.githubusercontent.com/rolldown/rolldown/v1.2.16/LICENSE'],
  }[name];
  if (upstream && !row.licenses.length) {
    const data = readFileSync(`/tmp/mining-${upstream[0]}-license`);
    const file = `licenses/dependencies/${name.replaceAll('/', '__')}/LICENSE`;
    put(file, data); row.licenses.push({ file, sha256: sha(data), source: upstream[1] });
  }
  if (installed && !row.licenses.length) throw new Error(`Missing installed package license: ${name}`);
  inventory.push(row);
}
const embedded = [
  ['basis-universal', '/tmp/mining-basis-license', 'https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE'],
  ['zstddec', '/tmp/mining-zstddec-license', 'https://github.com/donmccurdy/zstddec/blob/main/LICENSE'],
  ['zstd', '/tmp/mining-zstd-license', 'https://github.com/facebook/zstd/blob/v1.5.7/LICENSE'],
];
const vendored = [];
for (const [name, sourceFile, source] of embedded) {
  const data = readFileSync(sourceFile), file = `licenses/embedded/${name}/LICENSE`;
  put(file, data); vendored.push({ name, source, file, sha256: sha(data), distributedThrough: 'three@0.186.1 KTX2Loader helpers' });
}
for (const file of readdirSync(join(out, 'src/game/assets/fonts/licenses'))) {
  put(`licenses/fonts/${file}`, readFileSync(join(out, 'src/game/assets/fonts/licenses', file)));
}
put('licenses/fonts/sign-font-license.txt', readFileSync(join(out, 'src/game/assets/sign-font-license.txt')));
put('DEPENDENCIES.json', JSON.stringify({ packages: inventory, embedded: vendored }, null, 2) + '\n');
const notice = `# Third-party notices\n\nVersions are pinned by package-lock.json. Full installed dependency notices are in licenses/dependencies; fonts in licenses/fonts; the Basis Universal and Zstandard helper notices in licenses/embedded. These files are also copied into dist for static deployment. Copyright and license texts retain their original names and required attributions.\n\n| Package | Version | License | Use |\n| --- | --- | --- | --- |\n${inventory.map(p => `| ${p.name} | ${p.version} | ${p.license ?? 'See package notice'} | ${p.development ? 'Build/test' : 'Runtime'}${p.installed ? '' : ' (platform-specific, not installed here)'} |`).join('\n')}\n\nSome Three.js loader helpers embed Basis Universal (Apache-2.0), zstddec (MIT), and Zstandard (BSD). Their bundled versions are the files distributed by Three.js 0.186.1; no independently inferred version is asserted.\n\nOnly packages installed for this platform have copied npm license texts; platform-specific alternatives remain inventoried in DEPENDENCIES.json and are downloaded by npm on their target platforms. No node_modules contents or package binaries are included in this source delivery except code incorporated by the normal application build.\n\nProject art and converted animation provenance is described in ASSET_PROVENANCE.md. The dependency licenses do not assert a license for that artwork.\n`;
put('THIRD_PARTY_NOTICES.md', notice);
cpSync(join(out, 'licenses'), join(out, 'public/licenses'), { recursive: true });
put('public/THIRD_PARTY_NOTICES.txt', notice);
console.log(`Collected ${inventory.filter(p => p.installed).length} installed dependency notices; ${inventory.length} locked entries inventoried.`);
