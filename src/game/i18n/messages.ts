import type zh from './locales/zh.json';

export type MessageId = keyof typeof zh.messages;
export type TextValue = string | number | TextRef;
export type TextParams = Readonly<Record<string, TextValue>>;
/** Locale independent, including nested content names and unformatted numeric values. */
export type TextRef = Readonly<{ id: MessageId; params?: TextParams }>;
export function message(id: MessageId, params?: TextParams): TextRef {
  return Object.freeze({ id, ...(params ? { params: Object.freeze({ ...params }) } : {}) });
}
export function assertTextRef(value: unknown): asserts value is TextRef {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !/^(msg|boot)\.[a-z0-9_]+$/.test(value.id)) throw Error('Invalid text reference');
}
/** Copy caller-owned catalog data so later edits cannot change a live definition. */
export function copyTextRef(value: unknown): TextRef {
  assertTextRef(value);
  const params = value.params && Object.fromEntries(Object.entries(value.params).map(([key, item]) => {
    if (typeof item === 'string' || typeof item === 'number' && Number.isFinite(item)) return [key, item];
    return [key, copyTextRef(item)];
  }));
  return message(value.id, params);
}
export function createTranslator(pack: { locale: string; messages: Readonly<Record<string, string>> }) {
  const numbers = new Intl.NumberFormat(pack.locale, { useGrouping: false, maximumFractionDigits: 12 });
  function resolve(ref: TextRef): string {
    const template = pack.messages[ref.id];
    if (template === undefined) throw Error(`Missing message: ${ref.id}`);
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      if (!ref.params || !(key in ref.params)) throw Error(`Missing parameter: ${ref.id}.${key}`);
      const value = ref.params[key];
      return typeof value === 'number' ? numbers.format(value) : typeof value === 'string' ? value : resolve(value);
    });
  }
  return resolve;
}
