/**
 * Wrapper around Object.keys which uses keyof to get the accurate key type.
 * (The builtin typing for Object.keys unnecessarily widens the type to
 * string[].)
 */
export default function recordKeys<R extends Record<string, unknown>>(
  record: R,
): (keyof R)[] {
  return Object.keys(record) as (keyof R)[];
}
