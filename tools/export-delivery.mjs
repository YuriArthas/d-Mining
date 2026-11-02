// Select reviewed files and metadata. Runtime source and build tools are copied byte-for-byte.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareLocales } from './prepare-locales.mjs';
import { checkModulePaths } from './check-module-paths.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(process.argv[2] || join(root, 'exports/mining-delivery-r3-20261102'));
if (!out.startsWith(join(root, 'exports/')) || existsSync(out)) throw Error('Choose a new directory under exports/');
prepareLocales();
checkModulePaths(new URL('../src/', import.meta.url));
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]).sort();
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const copy = (from, to = from) => { mkdirSync(dirname(join(out, to)), { recursive: true }); cpSync(join(root, from), join(out, to), { recursive: true }); };
const put = (p, value) => { mkdirSync(dirname(join(out, p)), { recursive: true }); writeFileSync(join(out, p), value); };
mkdirSync(out, { recursive: true });
// Reviewed authoring files, licenses and handoff docs are maintained separately from runtime sources.
for (const entry of readdirSync(join(root, 'delivery-content'))) copy(`delivery-content/${entry}`, entry);
for (const p of ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', '.nvmrc', 'server/serve.mjs', 'tools/economy/model.mts', 'tools/economy/plan.json', 'tools/economy/k3.json', 'tools/i18n-scan.mjs', 'tools/prepare-locales.mjs', 'tools/check-module-paths.mjs', 'tools/verify-delivery-source.mjs']) copy(p);
const excludedTests = ['local-tools.test.mjs', 'log-receiver.test.mjs'];
for (const p of files(join(root, 'tools/tests'))) if (!excludedTests.includes(relative(join(root, 'tools/tests'), p))) copy(relative(root, p));
put('.gitignore', 'node_modules/\ndist/\n.DS_Store\n');
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
// Only delivery-facing commands differ; dependencies and their lock remain exact.
delete pkg.scripts['publish:preview'];
pkg.scripts['verify:source'] = 'node tools/verify-delivery-source.mjs';
put('package.json', JSON.stringify(pkg, null, 2) + '\n');
put('DELIVERY.json', JSON.stringify({ name: 'Mining', version: pkg.version, revision: 'r3', buildTime: new Date().toISOString(),
  runtime: 'static HTTP(S), WebGL2', debug: '?debug=1', reporting: false, renderFpsCap: 60, buildTool: `vite@${pkg.devDependencies.vite}`, excludedTests,
  sourceContract: 'All src files, index.html, vite.config.ts, tsconfig.json, package-lock.json and shared build/check tools are unchanged copies.',
  validationLimits: ['Linux CPU/static verification only this round', 'No GPU/browser or physical phone testing this round', 'Windows path audit only; Windows build not executed'],
}, null, 2) + '\n');
const shared = [...files(join(root, 'src')).map(p => relative(root, p)), ...files(join(root, 'public')).map(p => relative(root, p)), 'index.html', 'vite.config.ts', 'tsconfig.json', 'package-lock.json',
  'tools/i18n-scan.mjs', 'tools/prepare-locales.mjs', 'tools/check-module-paths.mjs', 'tools/verify-delivery-source.mjs'];
const manifest = Object.fromEntries(shared.sort().map(p => {
  const expected = hash(join(root, p));
  if (hash(join(out, p)) !== expected) throw Error(`Export changed shared source: ${p}`);
  return [p, expected];
}));
put('SOURCE_MANIFEST.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported ${files(out).length} files; ${shared.length} shared source hashes match. ${out}`);
