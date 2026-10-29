import en from './en.json' with { type: 'json' };
import id from './id.json' with { type: 'json' };
import vi from './vi.json' with { type: 'json' };

/** Player-facing text, gettext style: every string the player can see is written in Chinese (the source language)
 *  and wrapped in tr('…'); other languages look it up in their table by that Chinese text. Parameters are named
 *  in braces: tr('购买 {price}', { price }). Tables: en.json, id.json (Indonesian), vi.json (Vietnamese). Where one Chinese word means two things in English, a context after
 *  '§' tells them apart and is never shown: tr('装备§gear') is 装备 in Chinese, Gear in English (装备 alone: Equip).
 *  The language is fixed for the page: switching saves the choice and
 *  reloads, so content names, notices and 3D labels are all built once in the chosen language.
 *  tools/tests/i18n.test.mjs checks that every tr() text has its English and that no player-facing Chinese is
 *  left outside tr(). */
export type Lang = 'en' | 'zh' | 'id' | 'vi';
/** The language picker, each in its own language. */
export const LANGUAGES: readonly Readonly<{ id: Lang; label: string }>[] = [
  { id: 'en', label: 'English' }, { id: 'zh', label: '简体中文' }, { id: 'id', label: 'Bahasa Indonesia' }, { id: 'vi', label: 'Tiếng Việt' }];
const STORAGE_KEY = 'mining.language';
const TABLES: Readonly<Record<Exclude<Lang, 'zh'>, Readonly<Record<string, string>>>> = { en, id, vi };
const known = (value: unknown): Lang | null => LANGUAGES.some(l => l.id === value) ? value as Lang : null;

function detect(): Lang {
  // Node (tests, tools) reads the Chinese source text.
  if (typeof window === 'undefined') return 'zh';
  const fromUrl = known(new URLSearchParams(window.location.search).get('lang'));
  let saved: Lang | null = null;
  try { saved = known(window.localStorage.getItem(STORAGE_KEY)); } catch { /* storage blocked: follow the browser */ }
  // English unless the player chose another language (2026-10-28: the default is English).
  return fromUrl ?? saved ?? 'en';
}
/** The page's language. */
export const LANG: Lang = detect();
// The offline art builds stub `document` for canvas only (no documentElement).
if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;

const missing = new Set<string>();
/** The text in the page's language, with {name} parameters filled in. */
export function tr(source: string, params?: Readonly<Record<string, unknown>>): string {
  let text = source.split('§')[0];
  // Text with no Chinese in it (SELL, {name}) is the same in every language.
  if (LANG !== 'zh' && /[\u4e00-\u9fff]/.test(text)) {
    const found = TABLES[LANG][source];
    if (found !== undefined) text = found;
    else if (!missing.has(source)) { missing.add(source); console.warn(`[i18n] ${LANG} 缺少：${source}`); }
  }
  return params ? text.replace(/\{(\w+)\}/g, (match, key: string) => key in params ? String(params[key] ?? '') : match) : text;
}

/** Saves the choice; the caller reloads the page (after saving the game) to apply it. */
export function saveLanguage(lang: Lang) {
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage blocked: the URL still works */ }
}
