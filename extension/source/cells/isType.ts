import * as io from 'io-ts';

export default function isType<T>(
  value: unknown,
  type: io.Type<T>,
): value is T {
  return 'right' in type.decode(value);
}
