import packs from './generated/locales.json' with { type: 'json' };
import { createTranslator, message, type MessageId, type TextRef, type TextParams } from './messages.ts';

export type Lang = string;
export const LANGUAGES = packs.map(({ id, label }) => ({ id, label }));
const STORAGE_KEY = 'mining.language';
const known = (value: unknown): string | null => packs.some(p => p.id === value) ? value as string : null;
function detect(): Lang {
  if (typeof window === 'undefined') return 'zh';
  const asked = known(new URLSearchParams(window.location.search).get('lang'));
  let saved: string | null = null;
  try { saved = known(window.localStorage.getItem(STORAGE_KEY)); } catch { /* browser storage unavailable */ }
  return asked ?? saved ?? 'en';
}
export const LANG = detect();
export const LOCALE = packs.find(p => p.id === LANG)!;
export const resolveText = createTranslator(LOCALE);
/** Presentation boundary: domain data carries message() references, never translated strings. */
export function tr(id: MessageId, params?: TextParams): string { return resolveText(message(id, params)); }
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.lang = LOCALE.locale;
  document.title = tr('boot.game_name');
}
export function saveLanguage(lang: Lang) {
  if (!known(lang)) throw Error(`Unknown language: ${lang}`);
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* caller also updates the URL */ }
}
export type { TextRef };
