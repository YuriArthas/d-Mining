import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanAll } from '../i18n-scan.mjs';
import { formatNumber } from '../../src/game/presentation/formatNumber.ts';
import { tr, LANG } from '../../src/game/i18n/i18n.ts';

const table = lang => JSON.parse(readFileSync(new URL(`../../src/game/i18n/${lang}.json`, import.meta.url), 'utf8'));
const TABLES = { en: table('en'), id: table('id'), vi: table('vi') };
const { keys, stray } = scanAll();
const holes = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

test('玩家看得到的中文都包在 tr() 里（开发者报错和调试页除外）', () => {
  assert.deepEqual(stray.map(s => `${s.rel}:${s.line} ${s.text}${s.why ? ` (${s.why})` : ''}`), []);
});

for (const [lang, t] of Object.entries(TABLES)) test(`${lang}: 每条 tr() 文案都有译文，参数一一对应，没有用不到的旧文案`, () => {
  assert.deepEqual(keys.filter(k => !(k in t)), [], '缺译文');
  assert.deepEqual(Object.keys(t).filter(k => !keys.includes(k)), [], '表里有用不到的文案');
  assert.deepEqual(keys.filter(k => holes(k) !== holes(t[k])), [], '参数不一致');
  assert.deepEqual(Object.entries(t).filter(([, v]) => /[\u4e00-\u9fff§]/.test(v) || !v.trim()).map(([k]) => k), [], '译文里混着中文、§ 或是空的');
  assert.deepEqual(Object.entries(t).filter(([, v]) => v !== v.normalize('NFC')).map(([k]) => k), [], '译文要用 NFC');
});

test('Node 下默认中文；tr 填参数；数字按中文单位', () => {
  assert.equal(LANG, 'zh');
  assert.equal(tr('购买 {price}', { price: 480 }), '购买 480');
  assert.equal(formatNumber(4800), '4800');
  assert.equal(formatNumber(12345), '1.23万');
});
