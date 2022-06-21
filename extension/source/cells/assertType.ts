import * as io from 'io-ts';
import assert from '../helpers/assert';

import isType from './isType';

/**
 * Asserts the type provided. This is super useful because the compiler can tell
 * that subsequent uses of value conform to the provided type. (See `assert` for
 * more detail.)
 */
export default function assertType<T>(
  value: unknown,
  type: io.Type<T>,
): asserts value is T {
  assert(
    isType(value, type),
    () =>
      new Error(
        `assertType failed, value: ${JSON.stringify(value)}, type: ${
          type.name
        }`,
      ),
  );
}

/**
 * Similar to `assertType`, but also echos the value. This is useful when you
 * want to apply runtime type checking in the middle of an expression instead of
 * in control flow.
 *
 * For example:
 * ```ts
 *     const shout = (msg: unknown) => console.log(
 *       msg.toUpperCase(),
 * //    ^^^ ❌ Object is of type 'unknown'. ts(2571)
 *     );
 *
 *     const shout = (msg: unknown) => console.log(
 *       assertTypeEcho(msg, io.string).toUpperCase(),
 * //    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ✅ string
 *     );
 * ```
 *
 * However, please use `assertTypeEcho` sparingly. Using statements instead of
 * expressions usually produces code that is much easier to read and debug:
 * ```ts
 *     function shout(msg: unknown) {
 *       assertType(msg, io.string);
 *       console.log(msg.toUpperCase());
 * //                ^^^ ✅ string
 *     }
 * ```
 */
export function assertTypeEcho<T>(value: unknown, type: io.Type<T>): T {
  assertType(value, type);
  return value;
}
