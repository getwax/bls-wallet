import assert from '../helpers/assert';
import { FormulaCell } from './FormulaCell';
import { IReadableCell } from './ICell';
import MemoryCell from './MemoryCell';

export default function LongPollingCell<T>(
  longPoll: (differentMaybe?: { value: T }) => {
    resultPromise: Promise<'please-retry' | 'cancelled' | { value: T }>;
    cancel: () => void;
  },
): IReadableCell<T> {
  let latest: { value: T } | undefined;
  let sharedCancel: (() => void) | undefined;
  let trackerValue = 0;
  const tracker = new MemoryCell<number>(trackerValue);

  const formulaCell = new FormulaCell({ tracker }, async () => {
    if (latest) {
      return latest.value;
    }

    while (true) {
      const result = await longPoll().resultPromise;

      if (result === 'please-retry') {
        continue;
      }

      assert(result !== 'cancelled');

      return result.value;
    }
  });

  formulaCell.events.on('first-iterator', async () => {
    while (true) {
      const { resultPromise, cancel } = longPoll(latest);
      assert(sharedCancel === undefined);
      sharedCancel = cancel;

      const result = await resultPromise;
      sharedCancel = undefined;

      if (result === 'cancelled') {
        break;
      }

      if (result === 'please-retry') {
        continue;
      }

      latest = result;
      trackerValue += 1;
      tracker.write(trackerValue);
    }
  });

  formulaCell.events.on('zero-iterators', () => {
    assert(sharedCancel !== undefined);
    sharedCancel();
    sharedCancel = undefined;
    latest = undefined;
  });

  return formulaCell;
}
