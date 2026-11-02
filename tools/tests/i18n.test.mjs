import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalePacks, localeDirectory } from '../prepare-locales.mjs';
import { scanAll, scanFile } from '../i18n-scan.mjs';
import { createTranslator, message } from '../../src/game/i18n/messages.ts';
import { tr, LANG } from '../../src/game/i18n/i18n.ts';
import { formatNumber } from '../../src/game/presentation/formatNumber.ts';
import { EGG_DEFINITIONS } from '../../src/game/content/pets.ts';
import { LAYER_ITEMS } from '../../src/game/content/journeyResources.ts';

const packs = loadLocalePacks();
test('visible copy and JSON content use known stable IDs', () => {
  assert.deepEqual(scanAll().stray, []);
  assert.equal(LANG, 'zh');
  assert.equal(tr('msg.n_s', { n: 480 }), '480 次/秒');
  assert.equal(formatNumber(12345), '1.23万');
});
test('fifth language is discovered from its resource alone, with all boot and game messages', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mining-locale-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(localeDirectory, dir, { recursive: true });
  const fifth = structuredClone(packs.find(p => p.id === 'en'));
  Object.assign(fifth, { id: 'fr', label: 'Français', locale: 'fr-FR', order: 4 });
  fifth.messages['msg.n_s'] = 'Vitesse {n}';
  writeFileSync(join(dir, 'fr.json'), JSON.stringify(fifth));
  const found = loadLocalePacks(dir).find(p => p.id === 'fr');
  assert.equal(found.label, 'Français');
  assert.ok(found.messages['boot.entering_the_mine']);
  assert.equal(createTranslator(found)(message('msg.n_s', { n: 1.25 })), 'Vitesse 1,25');
  delete fifth.messages['msg.n_s'];
  writeFileSync(join(dir, 'fr.json'), JSON.stringify(fifth));
  assert.throws(() => loadLocalePacks(dir), /coverage/);
  fifth.messages['msg.n_s'] = 'Vitesse {wrong}';
  writeFileSync(join(dir, 'fr.json'), JSON.stringify(fifth));
  assert.throws(() => loadLocalePacks(dir), /Placeholder mismatch/);
  fifth.messages['msg.n_s'] = '';
  writeFileSync(join(dir, 'fr.json'), JSON.stringify(fifth));
  assert.throws(() => loadLocalePacks(dir), /Placeholder mismatch|Empty translation/);
});
test('domain references preserve nested names and numbers until presentation', () => {
  const ref = message('msg.n_s', { n: 1.25 });
  assert.equal(ref.params.n, 1.25);
  assert.equal(typeof EGG_DEFINITIONS[0].name, 'object');
  assert.equal(typeof LAYER_ITEMS[0].deep.name.params.rock, 'object');
  for (const id of ['id', 'vi']) {
    const resolve = createTranslator(packs.find(p => p.id === id));
    assert.match(resolve(ref), /1,25/);
    assert.ok(resolve(LAYER_ITEMS[0].deep.name).length > 3);
  }
  assert.throws(() => createTranslator(packs[0])(message('msg.n_s')), /Missing parameter/);
  assert.throws(() => createTranslator(packs[0])({ id: 'msg.does_not_exist' }), /Missing message/);
});
test('raw JSX Chinese next to an expression is caught', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mining-copy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'sample.tsx');
  writeFileSync(file, 'export const Sample = () => <span>查看{name}</span>;');
  assert.equal(scanFile(file).stray.length, 1);
});
