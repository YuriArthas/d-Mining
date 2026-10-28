import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Mirrors tools/build-ui-fonts.py: every non-ASCII character in src/ must be in
// the subset charset, otherwise new text falls back to a system face.
const root = new URL('../../', import.meta.url).pathname;
const fontsDir = join(root, 'src/game/assets/fonts');
const fontsCss = join(root, 'src/game/ui/kit/fonts.css');
const files = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

test('UI display font subsets cover every character the game renders', () => {
  const manifest = JSON.parse(readFileSync(join(fontsDir, 'manifest.json'), 'utf8'));
  const charset = new Set(manifest.charset);
  const missing = new Map();
  for (const path of files(join(root, 'src'))) {
    if (!/\.(ts|tsx|json|css)$/.test(path) || /(^|\/)(sign-font|authored)\.json$/.test(path)) continue;
    if (path.startsWith(fontsDir) || path === fontsCss) continue;
    for (const char of readFileSync(path, 'utf8')) {
      if (char.codePointAt(0) > 0x7e && !/\s/u.test(char) && !charset.has(char)) missing.set(char, relative(root, path));
    }
  }
  assert.deepEqual([...missing].map(([char, file]) => `${char} (${file})`), [], 'Run python3 tools/build-ui-fonts.py after adding text');
});

test('generated faces exist, are small subsets and reuse the shared digits face', () => {
  const manifest = JSON.parse(readFileSync(join(fontsDir, 'manifest.json'), 'utf8'));
  const css = readFileSync(fontsCss, 'utf8');
  for (const face of manifest.faces) {
    const file = face.file ?? (face.id === 'digits' ? 'mining-digits.woff2' : `mining-cjk-${face.id}.woff2`);
    assert.ok(existsSync(join(fontsDir, file)), file);
    assert.ok(face.bytes < 200_000, `${file} stays a subset (${face.bytes} bytes)`);
    assert.equal(face.license, 'SIL OFL 1.1');
    assert.ok(existsSync(join(fontsDir, 'licenses', `${face.id === 'digits' ? 'fredoka' : face.id}-OFL.txt`)));
  }
  for (const id of ['Noto']) {
    assert.match(css, new RegExp(`font-family: "Mining Display ${id}"; src: url\\("../../assets/fonts/mining-digits.woff2"\\)`));
  }
});
