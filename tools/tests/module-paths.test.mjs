import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkModulePaths } from '../check-module-paths.mjs';

test('current source has distinct module stems and exact-cased imports', () => {
  assert.ok(checkModulePaths(new URL('../../src/', import.meta.url)).modules > 200);
});
test('cross-platform check rejects TS/TSX stem collisions and wrong-cased imports', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mining-paths-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'Thing.ts'), 'export const value = 1;');
  writeFileSync(join(dir, 'thing.tsx'), 'export const View = () => null;');
  assert.throws(() => checkModulePaths(dir), /collision/);
  rmSync(join(dir, 'thing.tsx'));
  writeFileSync(join(dir, 'view.ts'), "import { value } from './thing.ts';");
  assert.throws(() => checkModulePaths(dir), /case\/path mismatch/);
  writeFileSync(join(dir, 'view.ts'), "import { value } from './Thing.ts';");
  assert.equal(checkModulePaths(dir).modules, 2);
});
