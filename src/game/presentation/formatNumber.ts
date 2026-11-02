import { LOCALE, tr } from '../i18n/i18n.ts';
// Display only: game values and saved quantities remain exact integers.
// Large numbers in the units each language reads: Chinese 万 (ten thousand), 亿 (a hundred million), 万亿 (a
// trillion); English K, M, B, T. Below 10 000 the number is shown in full; above, three significant digits at most
// (1.23万, 12.3万, 123万; 12.3K, 1.23M).
const UNITS = LOCALE.numberUnits.map(([size, unit]) => {
  if (typeof size !== 'number' || typeof unit !== 'string') throw Error('Invalid locale number units');
  return [size, unit] as const;
});
const decimal = new Intl.NumberFormat(LOCALE.locale, { useGrouping: false, maximumFractionDigits: 12 });
export function formatNumber(value: number): string {
  const size = Math.abs(value);
  if (size < 1e4) return decimal.format(value);
  for (const [unit, name] of UNITS) {
    if (size < unit) continue;
    const scaled = value / unit, digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
    return `${decimal.format(Number(scaled.toFixed(digits)))}${name}`;
  }
  return decimal.format(value);
}
/** Depths always in full metres (2400 米 / 2400 m), never abbreviated. */
export function formatDepth(metres: number): string {
  return tr("msg.n_m", { n: Math.floor(metres) });
}
