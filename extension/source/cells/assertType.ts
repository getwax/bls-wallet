import * as io from 'io-ts';
import assert from '../helpers/assert';

import isType from './isType';

/**
 * TODO: MEGAFIX: docstring
 */
export default function assertType<T>(
  value: unknown,
  type: io.Type<T>,
): asserts value is T {
  assert(
    isType(value, type),
    `assertType failed, value: ${JSON.stringify(value)}, type: ${type.name}`,
  );
}

/**
 * TODO: MEGAFIX: docstring
 */
export function assertTypeEcho<T>(value: unknown, type: io.Type<T>): T {
  assertType(value, type);
  return value;
}
