import assert, { softAssert } from '../helpers/assert';
import { IReadableCell } from './ICell';
import MemoryCell from './MemoryCell';

// FIXME: MEGAFIX: Don't longPoll actively, instead make use of a FormulaCell (or
// otherwise) to only longPoll when needed
export default function LongPollingCell<T>(
  longPoll: (opt?: { differentFrom: T }) => Promise<T>,
): IReadableCell<T> {
  const cell = new MemoryCell(longPoll());

  (async () => {
    try {
      let value = await cell.read();

      while (true) {
        value = await longPoll({ differentFrom: value });
        await cell.write(value);
      }
    } catch (error) {
      cell.end();
      assert(error instanceof Error);
      softAssert(false, error.message);
    }
  })();

  return cell;
}
