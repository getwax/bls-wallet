export default function assertExists<T>(
  value: T,
): Exclude<T, null | undefined> {
  if (value === null || value === undefined) {
    throw new Error("Expected value");
  }

  return value as Exclude<T, null | undefined>;
}
