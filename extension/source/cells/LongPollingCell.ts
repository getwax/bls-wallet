import assert, { softAssert } from '../helpers/assert';
import { IReadableCell } from './ICell';
import MemoryCell from './MemoryCell';

export default function LongPollingCell<T>(
  longPoll: (differentFrom?: { value: T }) => Promise<T>,
): IReadableCell<T> {
  const cell = new MemoryCell(longPoll());

  (async () => {
    try {
      let value = await cell.read();

      while (true) {
        value = await longPoll({ value });
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
