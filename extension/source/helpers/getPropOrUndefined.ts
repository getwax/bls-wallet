export default function getPropOrUndefined(
  value: unknown,
  prop: string,
): unknown {
  try {
    return (value as Record<string, unknown>)[prop];
  } catch {
    return undefined;
  }
}
