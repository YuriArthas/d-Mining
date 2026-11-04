import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { loadLocalePacks } from '../prepare-locales.mjs';

const source = readFileSync(new URL('../../src/boot/loading.js', import.meta.url), 'utf8');
function boot(search = '', saved = null) {
  const nodes = Object.fromEntries(['boot-status', 'boot-detail', 'boot-busy', 'boot-retry'].map(id => [id, {}]));
  const listeners = {}, documentListeners = {}, intervals = new Map(), replacements = [];
  const originalWarn = () => {}, originalError = () => {}, console = { warn: originalWarn, error: originalError };
  const window = { __MINING_BOOT_LOCALES__: loadLocalePacks(), addEventListener: (name, fn) => { listeners[name] = fn; } };
  let now = 0;
  const context = {
    window, document: { documentElement: {}, querySelectorAll: () => [], getElementById: id => nodes[id], addEventListener: (name, fn) => { documentListeners[name] = fn; } },
    location: { search, href: 'https://game.example/index.html' + search, replace: url => replacements.push(url) },
    URL, URLSearchParams, localStorage: { getItem: () => saved }, console, Date: { now: () => now },
    setInterval: fn => { intervals.set(1, fn); return 1; }, clearInterval: id => intervals.delete(id),
    fetch: () => { throw Error('loading UI must not upload'); },
    PerformanceObserver: class { constructor() { throw Error('loading UI must not collect'); } },
  };
  runInNewContext(source, context);
  documentListeners.DOMContentLoaded();
  return { document: context.document, window, nodes, listeners, intervals, replacements, console, originalWarn, originalError, tick: ms => { now += ms; for (const fn of intervals.values()) fn(); } };
}
test('loading UI defaults to Chinese when no language is requested or saved', () => {
  const b = boot();
  assert.equal(b.document.documentElement.lang, 'zh-CN');
  assert.equal(b.nodes['boot-status'].textContent, '正在进入矿场…');
});
test('loading UI uses the selected language, offers retry after delay and stops its timer when ready', () => {
  const b = boot('?lang=id', 'vi');
  assert.equal(b.document.documentElement.lang, 'id');
  assert.equal(b.nodes['boot-status'].textContent, 'Masuk ke tambang…');
  assert.equal(b.nodes['boot-retry'].hidden, true);
  b.tick(31000);
  assert.equal(b.nodes['boot-retry'].hidden, false);
  b.nodes['boot-retry'].onclick();
  assert.equal(new URL(b.replacements[0]).searchParams.get('bootRetry'), '31000');
  b.window.__MINING_BOOT__.ready();
  assert.equal(b.intervals.size, 0);
  assert.equal(b.console.warn, b.originalWarn); assert.equal(b.console.error, b.originalError);
  assert.equal(b.window.__MINING_LOG__, undefined);
});
test('failed game download displays a translated retry state without exposing the private error', () => {
  const b = boot('', 'zh');
  b.listeners.error({ target: { tagName: 'SCRIPT' }, message: '/private/path/internal.js' });
  assert.equal(b.nodes['boot-status'].textContent, '暂时没能进入矿场');
  assert.equal(b.nodes['boot-busy'].hidden, true);
  assert.equal(b.nodes['boot-retry'].hidden, false);
  assert.ok(!b.nodes['boot-detail'].textContent.includes('/private/'));
});
