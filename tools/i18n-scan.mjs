// Finds the player-facing text in src (tools/tests/i18n.test.mjs): every tr('…') source text, and any Chinese left
// outside tr(). Chinese inside developer-facing calls (validation errors, save checks) stays as it is.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SRC = new URL('../src/', import.meta.url).pathname;
const CJK = /[　-〿一-鿿＀-￯]/;
/** Calls whose text only developers see. */
export const DEV_CALLS = new Set(['Error', 'check', 'assert', 'integer', 'record', 'seconds', 'round', 'rising', 'warn', 'log', 'error', 'phase', 'onStatus', 'setStatus']);
/** Files no player sees: debug pages, probes, the terrain worker, data validation. */
export const DEV_FILES = [/^game\/logic\//, /^game\/persistence\/saveTypes\.ts$/, /^game\/terrain\//, /^game\/ui\/DevUnlock\.tsx$/, /^game\/ui\/PerformanceProbeUi\.tsx$/,
  /^game\/presentation\/PerformanceProbe\.ts$/, /^game\/ui\/kit\/KitSample\.tsx$/, /^game\/presentation\/FeedbackFixtures\.ts$/, /^game\/i18n\//, /^game\/audio\/music\//,
  /^game\/validation\//,
  // Internal labels that pick a pet's face, never shown; the debug tools panel.
  /^game\/content\/petAppearance\.ts$/, /^game\/content\/petLooks\.ts$/, /^game\/ui\/DebugTools\.tsx$/];

export function sourceFiles(dir = SRC) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

/** The source with comments blanked out (string contents kept), so positions stay the same. */
export function stripComments(s) {
  let out = '', i = 0, quote = null;
  while (i < s.length) {
    const c = s[i];
    if (!quote) {
      if (s.startsWith('//', i)) { const j = s.indexOf('\n', i); const end = j < 0 ? s.length : j; out += ' '.repeat(end - i); i = end; continue; }
      if (s.startsWith('/*', i)) { const j = s.indexOf('*/', i + 2); const end = j < 0 ? s.length : j + 2; out += s.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue; }
      if (c === "'" || c === '"' || c === '`') quote = c;
      out += c; i++;
    } else {
      out += c;
      if (c === '\\') { out += s[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
    }
  }
  return out;
}

/** Every string literal: [start, end, raw text]. Template literals keep their ${} parts. */
export function literals(s, from = 0, to = s.length) {
  const out = [];
  for (let i = from; i < to; i++) {
    const q = s[i];
    if (q !== "'" && q !== '"' && q !== '`') continue;
    let j = i + 1;
    const holes = [];
    while (j < to) {
      if (s[j] === '\\') { j += 2; continue; }
      if (q === '`' && s.startsWith('${', j)) {
        // A ${} hole: skip to its closing brace, past any strings inside, and scan it for its own literals.
        let k = j + 2, depth = 1;
        while (k < to && depth) {
          if (s[k] === "'" || s[k] === '"' || s[k] === '`') { const inner = literals(s, k, to)[0]; k = inner ? inner[1] : k + 1; continue; }
          if (s[k] === '{') depth++; else if (s[k] === '}') depth--;
          k++;
        }
        holes.push([j, k]); j = k; continue;
      }
      if (s[j] === q) break;
      j++;
    }
    // The template's own text, without its holes (where nested strings are reported on their own).
    let own = s.slice(i, j + 1);
    for (const [a, b] of [...holes].reverse()) own = own.slice(0, a - i) + '${}' + own.slice(b - i);
    out.push([i, j + 1, s.slice(i, j + 1), own]);
    for (const [a, b] of holes) out.push(...literals(s, a + 2, b - 1));
    i = j;
  }
  return out;
}

/** The name of the call whose argument list contains `pos` (tr, Error, …), or null. */
export function enclosingCall(s, pos) {
  let depth = 0;
  for (let i = pos - 1; i >= 0; i--) {
    const c = s[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth) { depth--; continue; }
      // A template's ${ hole: the call (if any) holds the whole template.
      if (c === '{' && s[i - 1] === '$') continue;
      if (c !== '(') return null;
      const m = /([A-Za-z_$][\w$]*)\s*$/.exec(s.slice(Math.max(0, i - 40), i));
      // A grouping paren (or `if (`): the call, if any, is further out.
      if (!m || /^(if|while|for|switch|return|typeof|await)$/.test(m[1])) continue;
      return m[1];
    } else if (c === ';' && !depth) return null;
  }
  return null;
}

/** tr() texts and stray Chinese in one file. */
export function scanFile(path) {
  const rel = relative(SRC, path), raw = readFileSync(path, 'utf8'), s = stripComments(raw);
  const keys = [], stray = [];
  const dev = DEV_FILES.some(re => re.test(rel));
  for (const [start, , text, own] of literals(s)) {
    if (!CJK.test(own)) continue;
    const call = enclosingCall(s, start);
    if (call === 'tr') {
      if (text[0] === '`' && text.includes('${')) stray.push({ rel, line: s.slice(0, start).split('\n').length, text, why: 'tr() 里不能用 ${}，改用 {参数}' });
      else keys.push(text.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n'));
      continue;
    }
    if (dev || DEV_CALLS.has(call)) continue;
    stray.push({ rel, line: s.slice(0, start).split('\n').length, text });
  }
  if (!dev) for (const m of s.matchAll(/>([^<>{}\n]*[一-鿿][^<>{}\n]*)</g))
    stray.push({ rel, line: s.slice(0, m.index).split('\n').length, text: m[1].trim(), why: 'JSX 文本' });
  return { keys, stray };
}

/** Text that data files hand to tr(): currency names (economy.json) and the rest halls' sign text (scene files). */
function dataKeys() {
  const keys = [];
  const economy = JSON.parse(readFileSync(join(SRC, 'game/content/economy.json'), 'utf8'));
  for (const c of economy.currencies) keys.push(c.name);
  const rooms = join(SRC, 'game/content/rooms');
  for (const name of readdirSync(rooms).filter(n => n.endsWith('.scene.json')))
    for (const sign of JSON.parse(readFileSync(join(rooms, name), 'utf8')).signs ?? [])
      for (const text of [sign.title, sign.subtitle]) if (text && CJK.test(text)) keys.push(text);
  return keys;
}

export function scanAll() {
  const keys = new Set(dataKeys()), stray = [];
  for (const file of sourceFiles()) { const r = scanFile(file); r.keys.forEach(k => keys.add(k)); stray.push(...r.stray); }
  return { keys: [...keys].sort(), stray };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { keys, stray } = scanAll();
  const byFile = new Map();
  for (const s of stray) byFile.set(s.rel, (byFile.get(s.rel) ?? 0) + 1);
  console.log(JSON.stringify({ keys: keys.length, stray: stray.length, byFile: Object.fromEntries([...byFile].sort((a, b) => b[1] - a[1])) }, null, 1));
  if (process.argv[2] === 'keys') console.log(JSON.stringify(keys, null, 1));
  if (process.argv[2] === 'stray') for (const s of stray) console.log(`${s.rel}:${s.line}  ${s.text}${s.why ? '  (' + s.why + ')' : ''}`);
}
