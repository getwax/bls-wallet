import { IReadableCell } from './ICell';
import MemoryCell from './MemoryCell';
import delay from '../helpers/delay';

// TODO: Replace this with similar functionality that doesn't need to actively
// update if it's not being used.

export default function TimeCell(accuracy: number): IReadableCell<number> {
  const cell = new MemoryCell(Math.floor(Date.now() / accuracy));

  (async () => {
    while (true) {
      const now = Date.now();
      await delay(accuracy * Math.ceil(now / accuracy) - now);
      await cell.write(accuracy * Math.round(Date.now() / accuracy));
    }
  })();

  return cell;
}
