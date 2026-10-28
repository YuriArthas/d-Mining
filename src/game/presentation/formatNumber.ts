import { LANG, tr } from '../i18n/i18n.ts';
// Display only: game values and saved quantities remain exact integers.
// Large numbers in the units each language reads: Chinese 万 (ten thousand), 亿 (a hundred million), 万亿 (a
// trillion); English K, M, B, T. Below 10 000 the number is shown in full; above, three significant digits at most
// (1.23万, 12.3万, 123万; 12.3K, 1.23M).
const UNITS: readonly (readonly [number, string])[] = LANG === 'zh'
  ? [[1e12, tr('万亿')], [1e8, tr('亿')], [1e4, tr('万')]]
  : [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
export function formatNumber(value: number): string {
  const size = Math.abs(value);
  if (size < 1e4) return String(value);
  for (const [unit, name] of UNITS) {
    if (size < unit) continue;
    const scaled = value / unit, digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
    return `${Number(scaled.toFixed(digits))}${name}`;
  }
  return String(value);
}
/** Depths always in full metres (2400 米 / 2400 m), never abbreviated. */
export function formatDepth(metres: number): string {
  return tr('{n} 米', { n: Math.floor(metres) });
}
