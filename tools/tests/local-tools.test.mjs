import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
function fixture(t, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mining-config-test-'));
  const file = join(dir, 'local.json');
  writeFileSync(file, JSON.stringify(config));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('MINING_')));
  return { file, run: (args, overrides = {}) => spawnSync(process.execPath, args, {
    cwd: root, encoding: 'utf8', env: { ...env, MINING_LOCAL_TOOLS_FILE: file, ...overrides },
  }) };
}
const probe = code => ['-e', `const tools = require('./tools/local-tools.cjs');${code}`];
test('empty standalone configuration disables telemetry; enabling without endpoint fails', t => {
  const f = fixture(t);
  const off = f.run(probe('console.log(JSON.stringify(tools.telemetryConfig()))'));
  assert.equal(off.status, 0); assert.deepEqual(JSON.parse(off.stdout), { enabled: false });
  const on = f.run(probe('tools.telemetryConfig()'), { MINING_LOG_ENABLED: 'true' });
  assert.notEqual(on.status, 0); assert.match(on.stderr, /Missing MINING_LOG_ENDPOINT/);
});
test('environment overrides local settings and telemetry exports only its own fields', t => {
  const f = fixture(t, { MINING_LOG_ENDPOINT: 'https://logs.example/ingest', MINING_LOG_PATH_PREFIX: '/games/mining-test/', MINING_HOST_ROOT: '/private/host' });
  const result = f.run(probe('console.log(JSON.stringify(tools.telemetryConfig()))'));
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { enabled: true, endpoint: 'https://logs.example/ingest', pathPrefix: '/games/mining-test/' });
  const off = f.run(probe('console.log(JSON.stringify(tools.telemetryConfig()))'), { MINING_LOG_ENABLED: 'false' });
  assert.deepEqual(JSON.parse(off.stdout), { enabled: false });
  const changed = f.run(probe('console.log(tools.gameUrl())'), { MINING_GAME_URL: 'https://mining.example/custom/index.html' });
  assert.equal(changed.stdout.trim(), 'https://mining.example/custom/index.html');
});
test('unconfigured publishers and receiver stop before publishing or opening a server', t => {
  const f = fixture(t);
  for (const script of ['tools/publish-preview.mjs', 'tools/publish-pinewind.mjs', 'server/logs/receiver.mjs']) {
    const result = f.run([script]);
    assert.notEqual(result.status, 0, script); assert.match(result.stderr, /Missing MINING_(HOST_ROOT|LOG_DIR)/);
  }
});
test('explicit bad config, bad URL and unavailable browser dependency report errors', t => {
  const f = fixture(t);
  let result = f.run(probe('tools.gameUrl()'), { MINING_GAME_URL: 'file:///private/index.html' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /must be an HTTP/);
  result = f.run(probe('tools.playwright()'), { MINING_PLAYWRIGHT_MODULE: join(f.file, 'missing-playwright') });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Cannot load Playwright/);
  writeFileSync(f.file, '{invalid');
  result = f.run(probe('tools.setting("MINING_HOST_ROOT")'));
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Cannot read local tools configuration/);
});
