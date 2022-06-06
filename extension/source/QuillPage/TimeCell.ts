import { IReadableCell } from '../cells/ICell';
import MemoryCell from '../cells/MemoryCell';
import delay from '../helpers/delay';

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
