// Display only: game values and saved quantities remain exact integers.
// Chinese large-number units, as Chinese players read them: 万 (ten thousand), 亿 (a hundred million), 万亿 (a trillion). Below 10 000 the
// number is shown in full; above, three significant digits at most (1.23万, 12.3万, 123万, 1234万 → 1234万).
const UNITS = [[1e12, '万亿'], [1e8, '亿'], [1e4, '万']] as const;
export function formatNumber(value: number): string {
  const size = Math.abs(value);
  for (const [unit, name] of UNITS) {
    if (size < unit) continue;
    const scaled = value / unit, digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
    return `${Number(scaled.toFixed(digits))}${name}`;
  }
  return String(value);
}
/** Depths always in full metres (2400 米), never abbreviated. */
export function formatDepth(metres: number): string {
  return `${Math.floor(metres)} 米`;
}
