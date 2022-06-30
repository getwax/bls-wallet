import { IReadableCell } from './ICell';
import MemoryCell from './MemoryCell';
import { FormulaCell } from './FormulaCell';
import assert from '../helpers/assert';

/**
 * A cell that tracks time. This is a special cell for two reasons:
 * 1. Actual time updates continuously, so we can't possibly expose a time cell
 *    with unlimited resolution.
 * 2. If you want to use a non-functional formula with a FormulaCell (ie, it
 *    doesn't always return the same thing for the same arguments), then you
 *    can capture this idea effectively by saying that time is an input to your
 *    function, even if it doesn't use time explicitly. The accuracy of the time
 *    cell is like a polling delay.
 */
export default function TimeCell(accuracy: number): IReadableCell<number> {
  let timeValue = Date.now();
  const time = new MemoryCell(timeValue);
  const { delay, cancelDelay } = SingularDelay();

  function update() {
    timeValue = Date.now();
    time.write(timeValue);
  }

  const formulaCell = new FormulaCell({ time }, () => Date.now());

  formulaCell.events.on('first-iterator', async () => {
    const now = Date.now();
    const desiredUpdateTime = timeValue + accuracy;
    const amountEarly = desiredUpdateTime - now;

    if (amountEarly > 0) {
      await delay(amountEarly);
    }

    update();

    while (true) {
      await delay(accuracy);
      update();
    }
  });

  formulaCell.events.on('zero-iterators', () => {
    cancelDelay();
  });

  return formulaCell;
}

/**
 * Creates a `delay` function which only allows one timer to be active at a
 * time. Raises an assertion failure if a concurrent `delay` is attempted.
 */
function SingularDelay() {
  let timerId: number | undefined;

  return {
    delay: async (ms: number) => {
      assert(timerId === undefined);

      await new Promise((resolve) => {
        timerId = setTimeout(resolve, ms) as unknown as number;
      });

      timerId = undefined;
    },
    cancelDelay: () => {
      clearTimeout(timerId);
      timerId = undefined;
    },
  };
}
