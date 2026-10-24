import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync,
  readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'dist');
const host = '/root/threejs_space/d-game1';
const served = join(host, 'dist');
const slug = 'mining-surface-play';
const destination = join(served, 'games', slug);
const publicRoot = 'https://w-sunjun-public.dev.clock-p.com/';
const publicGame = `${publicRoot}games/${slug}/`;
const withLauncher = process.argv.includes('--launcher');
const unknownArgs = process.argv.slice(2).filter(arg => arg !== '--launcher');
if (unknownArgs.length) throw new Error(`Unknown publisher arguments: ${unknownArgs.join(', ')}`);

const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`Publication inputs must not contain symlinks: ${path}`);
  return entry.isDirectory() ? files(path) : [path];
}).sort();
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const urlPath = path => path.split('/').map(encodeURIComponent).join('/');
const launcherAssets = html => [...new Set(
  [...html.matchAll(/(?:src|href)="(?:\.\/|\/)?(assets\/[^"?#]+)(?:[?#][^"]*)?"/g)].map(match => match[1]),
)];

function protectedGames() {
  return Object.fromEntries(files(join(served, 'games'))
    .filter(path => !path.startsWith(destination + '/'))
    .map(path => [relative(served, path), hash(path)]));
}

function assertLauncherEntry(directory) {
  const html = readFileSync(join(directory, 'index.html'), 'utf8');
  const scripts = launcherAssets(html).filter(name => name.endsWith('.js'));
  if (!scripts.some(name => readFileSync(join(directory, name), 'utf8').includes(`games/${slug}/index.html`))) {
    throw new Error('Launcher is missing the independent scene. First publication requires --launcher.');
  }
}

function publishFile(path, target) {
  mkdirSync(dirname(target), { recursive: true });
  // Replace individual resources atomically; old hashed resources stay available to open tabs.
  cpSync(path, target + '.next');
  renameSync(target + '.next', target);
}

if (!existsSync(join(source, 'index.html'))) throw new Error('Build the game first: npx vite build');
if (!existsSync(join(served, 'index.html'))) throw new Error(`Published launcher is missing: ${served}`);
if (!existsSync(join(served, 'games'))) throw new Error(`Published games are missing: ${served}/games`);

const before = protectedGames();
const temporary = mkdtempSync(join(tmpdir(), 'mining-surface-publish-'));
const verified = [];
try {
  let launcher;
  if (withLauncher) {
    launcher = join(temporary, 'launcher');
    // Intentionally bypass host npm run build: that builds/replaces unrelated games.
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: host, stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', launcher, '--emptyOutDir'], { cwd: host, stdio: 'inherit' });
    assertLauncherEntry(launcher);
    // Only root assets and, last, root index are eligible for launcher publication.
    // Never copy the staged public games directory or any other launcher-root files.
    for (const path of files(join(launcher, 'assets'))) {
      publishFile(path, join(served, relative(launcher, path)));
    }
  } else {
    assertLauncherEntry(served);
  }

  for (const path of files(source)) {
    const name = relative(source, path);
    if (name !== 'index.html') publishFile(path, join(destination, name));
  }
  publishFile(join(source, 'index.html'), join(destination, 'index.html'));
  if (launcher) publishFile(join(launcher, 'index.html'), join(served, 'index.html'));

  const after = protectedGames();
  const protectedNames = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changed = protectedNames.filter(name => before[name] !== after[name]);
  if (changed.length) throw new Error(`Another published game changed unexpectedly: ${changed.join(', ')}`);

  function verify(path, remoteUrl, name) {
    const expected = hash(path);
    const download = join(temporary, 'download');
    execFileSync('curl', [
      '--fail', '--silent', '--show-error', '--retry', '2', '--max-time', '120',
      '--output', download, `${remoteUrl}?verify=${expected.slice(0, 12)}`,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
    const actual = hash(download);
    if (actual !== expected) throw new Error(`Public file hash mismatch: ${name} (${actual} != ${expected})`);
    verified.push({ file: name, sha256: expected });
  }

  for (const path of files(source)) {
    const name = relative(source, path);
    verify(path, publicGame + urlPath(name), `games/${slug}/${name}`);
  }
  // Verify the public list even when its existing version did not need rebuilding.
  verify(join(served, 'index.html'), publicRoot, 'index.html');
  for (const name of launcherAssets(readFileSync(join(served, 'index.html'), 'utf8'))) {
    verify(join(served, name), publicRoot + urlPath(name), name);
  }
  const finalProtected = protectedGames();
  if (digest(finalProtected) !== digest(before)) {
    throw new Error('Another published game changed during public hash verification.');
  }

  mkdirSync(join(root, 'artifacts'), { recursive: true });
  const releaseRecord = resolve(root, process.env.PINEWIND_RELEASE_RECORD || 'artifacts/pinewind-public-release.json');
  mkdirSync(dirname(releaseRecord), { recursive: true });
  writeFileSync(releaseRecord, JSON.stringify({
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    masterBaseline: JSON.parse(readFileSync(join(root, 'artifacts/master-baseline/manifest.json'), 'utf8')).capturedAt,
    masterBaselineSha256: hash(join(root, 'artifacts/master-baseline/manifest.json')),
    sourceFilesSha256: digest(Object.fromEntries(files(source).map(path => [relative(source, path), hash(path)]))),
    publishedAt: new Date().toISOString(),
    url: publicGame + 'index.html',
    launcherUrl: publicRoot,
    launcherUpdated: withLauncher,
    otherGamesUnchanged: true,
    protectedFiles: Object.keys(before).length,
    protectedManifestSha256: digest(before),
    protectedGameFiles: Object.entries(before).map(([file, sha256]) => ({ file, sha256 })),
    verified,
  }, null, 2) + '\n');
  console.log('松风矿谷 · 场景设计 published and publicly hash-verified:', publicGame + 'index.html');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
