import * as io from 'io-ts';

import isType from './isType';

export default function assertType<T>(
  value: unknown,
  type: io.Type<T>,
): asserts value is T {
  if (!isType(value, type)) {
    throw new Error(
      `assertType failed, value: ${JSON.stringify(value)}, type: ${type.name}`,
    );
  }
}
