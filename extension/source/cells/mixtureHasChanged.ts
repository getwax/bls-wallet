export default function mixtureHasChanged<T>(
  previous: T | undefined,
  latest: T,
): boolean {
  return hasChanged(previous, latest);
}

function hasChanged(a: unknown, b: unknown) {
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return a !== b;
  }

  const proto = Object.getPrototypeOf(a);

  if (Object.getPrototypeOf(b) !== proto) {
    return true;
  }

  if (proto === Object.prototype) {
    return hasObjectChanged(
      a as Record<string, unknown>,
      b as Record<string, unknown>,
    );
  }

  if (proto === Array.prototype) {
    return hasArrayChanged(a as unknown[], b as unknown[]);
  }

  if (proto !== null && 'hasChanged' in proto) {
    return proto.hasChanged.call(a, b);
  }

  if (proto === Date.prototype) {
    return Number(a as Date) !== Number(b as Date);
  }

  // Fallback to referential equality for class instances which don't define
  // hasChanged
  return a !== b;
}

function hasObjectChanged(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return true;
  }

  for (const k of aKeys) {
    if (hasChanged(a[k], b[k])) {
      return true;
    }
  }

  return false;
}

function hasArrayChanged(a: unknown[], b: unknown[]) {
  const len = a.length;

  if (b.length !== len) {
    return true;
  }

  for (let i = 0; i < len; i += 1) {
    if (hasChanged(a[i], b[i])) {
      return true;
    }
  }

  return false;
}
