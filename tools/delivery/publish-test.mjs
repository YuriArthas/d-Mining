import localTools from '../local-tools.cjs';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const project = fileURLToPath(new URL('../..', import.meta.url));
const source = resolve(process.argv[2], 'dist');
const host = resolve(localTools.required('MINING_HOST_ROOT'), 'dist');
const target = join(host, 'games/mining-test');
const audit = resolve(process.argv[3] ?? join(project, 'artifacts/delivery-contract-20261102', 'public'));
const publicUrl = new URL('games/mining-test/', localTools.publicRoot()).href;
const files = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]).sort();
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const protectedFiles = () => Object.fromEntries(files(host).filter(p => !p.startsWith(target + '/')).map(p => [relative(host, p), hash(p)]));
if (!existsSync(join(source, 'index.html'))) throw Error('Build the export first');
const launcher = readFileSync(join(host, 'index.html'), 'utf8');
const scripts = [...launcher.matchAll(/src="\.\/(assets\/[^\"]+\.js)"/g)].map(m => readFileSync(join(host, m[1]), 'utf8'));
for (const route of ['games/mining/index.html', 'games/mining-test/index.html']) if (!scripts.some(s => s.includes(route))) throw Error(`Launcher entry missing: ${route}`);
const before = protectedFiles();
mkdirSync(audit, { recursive: true });
writeFileSync(join(audit, 'host-protected-before.json'), JSON.stringify(before, null, 2));
for (const p of files(source)) {
  const name = relative(source, p); if (name === 'index.html') continue;
  const dest = join(target, name); mkdirSync(dirname(dest), { recursive: true }); cpSync(p, dest);
}
cpSync(join(source, 'index.html'), join(target, 'index.html.next'));
renameSync(join(target, 'index.html.next'), join(target, 'index.html'));
const currentFiles = new Set(files(source).map(p => relative(source, p)));
for (const p of files(target)) if (!currentFiles.has(relative(target, p))) rmSync(p);

if (JSON.stringify(protectedFiles()) !== JSON.stringify(before)) throw Error('A protected host file changed');
const exec = promisify(execFile), queue = files(source), verified = [];
await Promise.all(Array.from({ length: 2 }, async (_, i) => {
  const download = join(audit, `public-download-${i}`);
  for (;;) {
    const p = queue.shift(); if (!p) return;
    const name = relative(source, p), expected = hash(p);
    await exec('curl', ['--fail', '--silent', '--show-error', '--retry', '2', '--max-time', '120', '--output', download, publicUrl + name + '?verify=' + expected.slice(0, 12)]);
    if (hash(download) !== expected) throw Error(`Public content differs: ${name}`);
    verified.push({ file: name, sha256: expected });
  }
}));
const report = { url: publicUrl + 'index.html', protectedHostFiles: Object.keys(before).length, otherGamesAndLauncherUnchanged: true, verified: verified.sort((a, b) => a.file.localeCompare(b.file)) };
writeFileSync(join(audit, 'public-release.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, verified: report.verified.length }));
