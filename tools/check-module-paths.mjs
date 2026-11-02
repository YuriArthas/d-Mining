import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function checkModulePaths(directory) {
  const root = directory instanceof URL ? fileURLToPath(directory) : resolve(directory);
  const names = new Map(), modules = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name), rel = relative(root, path).replaceAll('\\', '/');
      if (/[. ]$|[<>:"|?*]/.test(entry.name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(entry.name)) throw Error(`Windows-incompatible path: ${rel}`);
      // TS/TSX/JS module stems must also differ, even with explicit import extensions.
      const key = rel.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/i, '').toLowerCase();
      if (names.has(key)) throw Error(`Case-insensitive module collision: ${names.get(key)} / ${rel}`);
      names.set(key, rel);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:tsx?|jsx?|mjs|cjs)$/.test(path)) modules.push(path);
    }
  }
  visit(root);
  for (const path of modules) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"\n]+)\1/g)) {
      const target = resolve(dirname(path), match[2].split('?')[0]);
      if (!extname(target)) throw Error(`Relative import needs an extension: ${relative(root, path)}: ${match[2]}`);
      let actual = root;
      const rel = relative(root, target);
      if (rel.startsWith('..')) continue;
      for (const segment of rel.split(/[/\\]/)) {
        if (!readdirSync(actual).includes(segment)) throw Error(`Import case/path mismatch: ${relative(root, path)}: ${match[2]}`);
        actual = join(actual, segment);
      }
    }
  }
  return { paths: names.size, modules: modules.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(checkModulePaths(new URL('../src/', import.meta.url)));
