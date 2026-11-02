import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const localeDirectory = fileURLToPath(new URL('../src/game/i18n/locales/', import.meta.url));
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
export function loadLocalePacks(directory = localeDirectory) {
  const packs = readdirSync(directory).filter(n => n.endsWith('.json')).sort().map(name => {
    const pack = JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
    if (pack.id !== basename(name, '.json') || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(pack.id) || typeof pack.label !== 'string' || !pack.label.trim() || !Number.isFinite(pack.order)) throw Error(`Invalid locale metadata: ${name}`);
    if (typeof pack.locale !== 'string' || Intl.getCanonicalLocales(pack.locale).length !== 1) throw Error(`Invalid locale: ${name}`);
    if (!Array.isArray(pack.numberUnits) || !pack.numberUnits.length || pack.numberUnits.some(([size, label], i, all) => !Number.isFinite(size) || size <= 0 || typeof label !== 'string' || !label || i > 0 && size >= all[i - 1][0])) throw Error(`Invalid number units: ${name}`);
    if (!pack.messages || typeof pack.messages !== 'object' || Array.isArray(pack.messages)) throw Error(`Missing messages: ${name}`);
    return pack;
  });
  const source = packs.find(p => p.id === 'zh');
  if (!source || !packs.some(p => p.id === 'en')) throw Error('Required source/default locales: zh, en');
  const keys = Object.keys(source.messages).sort();
  for (const pack of packs) {
    if (JSON.stringify(Object.keys(pack.messages).sort()) !== JSON.stringify(keys)) throw Error(`Message coverage differs: ${pack.id}`);
    for (const key of keys) {
      const text = pack.messages[key];
      if (!/^(msg|boot)\.[a-z0-9_]+$/.test(key) || typeof text !== 'string' || text !== text.normalize('NFC') || text.includes('§')) throw Error(`Invalid message: ${pack.id}.${key}`);
      if (placeholders(text) !== placeholders(source.messages[key])) throw Error(`Placeholder mismatch: ${pack.id}.${key}`);
      if (text === '' && source.messages[key] !== '') throw Error(`Empty translation: ${pack.id}.${key}`);
    }
  }
  return packs.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function prepareLocales() {
  const packs = loadLocalePacks(), out = new URL('../src/game/i18n/generated/locales.json', import.meta.url);
  const text = JSON.stringify(packs) + '\n';
  mkdirSync(dirname(fileURLToPath(out)), { recursive: true });
  let current; try { current = readFileSync(out, 'utf8'); } catch { /* first generation */ }
  if (current !== text) writeFileSync(out, text);
  return packs;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Prepared ${prepareLocales().length} local language packs`);
