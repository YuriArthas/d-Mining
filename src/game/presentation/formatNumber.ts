// Display only: game values and saved quantities remain exact integers.
export function formatNumber(value: number): string {
  const units = ['', 'K', 'M', 'B', 'T'];
  let scaled = value, index = 0;
  while (Math.abs(scaled) >= 1000 && index < units.length - 1) { scaled /= 1000; index++; }
  return index ? `${Number(scaled.toFixed(scaled < 10 ? 2 : 1))}${units[index]}` : String(value);
}
