export default function assertExists<T>(value: T): Exclude<T, undefined> {
  if (value === undefined) {
    throw new Error('Value expected');
  }

  return value as Exclude<T, undefined>;
}
