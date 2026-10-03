export function integer(value: number, label = '数量') {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}必须是非负安全整数`);
  return value;
}
