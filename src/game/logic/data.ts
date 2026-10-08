// Plain data validation shared by module DTOs; no storage or UI dependencies.
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("数据格式错误");
  return value as Record<string, unknown>;
}
export function versionOne(value: unknown) {
  const data = record(value);
  if (data.version !== 1) throw Error("不支持的数据版本");
  return data;
}
