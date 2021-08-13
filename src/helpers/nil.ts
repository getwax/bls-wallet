type nil = undefined;
const nil = undefined;

export function isNil(value: unknown): value is nil {
  return value === nil;
}

export function isNotNil<T>(value: T): value is Exclude<T, nil> {
  return value !== nil;
}

export default nil;
