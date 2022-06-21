import { IReadableCell } from './ICell';
import Stoppable from './Stoppable';

/**
 * Similar to `.on('change', handler)` but differs in four very important ways:
 * 1. `forEach` will call `handler` with the current value first.
 * 2. Some cells (in particular `FormulaCell`s) only update when something is
 *    iterating them.
 * 3. You can provide an async handler. The meaning is that new values won't be
 *    handled until the previous call is complete. If multiple new values come
 *    in during the call, `handler` will only get the latest one (the others
 *    will be skipped).
 * 4. The return value of `forEach` provides `.stop()`. This usually leads to
 *    much better code than EventEmitter's `.off` approach.
 */
export default function forEach<T>(
  cell: IReadableCell<T>,
  handler: (value: T) => unknown,
) {
  const stoppable = new Stoppable(cell);

  const completionPromise = (async () => {
    for await (const maybe of stoppable) {
      if (maybe === 'stopped') {
        break;
      }

      await handler(maybe.value);
    }
  })();

  return {
    stop: () => stoppable.stop(),
    iterationCompletionPromise: completionPromise,
  };
}
