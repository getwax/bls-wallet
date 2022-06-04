import { ChangeEvent, IReadableCell } from './ICell';

export default class CellIterator<T> implements AsyncIterator<T> {
  lastProvided?: { value: T };
  cleanup = () => {};

  constructor(public cell: IReadableCell<T>) {}

  async next() {
    const latestRead = await this.cell.read();

    if (
      this.lastProvided === undefined ||
      this.cell.hasChanged(this.lastProvided.value, latestRead)
    ) {
      this.lastProvided = { value: latestRead };
      return { value: latestRead, done: false };
    }

    if (this.cell.ended) {
      return { value: undefined, done: true as const };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      const changeHandler = ({ latest }: ChangeEvent<T>) => {
        this.cleanup();
        this.lastProvided = { value: latest };
        resolve({ value: latest });
      };

      this.cell.events.once('change', changeHandler);

      const endHandler = () => {
        this.cleanup();
        resolve({ value: undefined, done: true });
      };

      this.cell.events.on('end', endHandler);

      this.cleanup = () => {
        this.cell.events.off('change', changeHandler);
        this.cell.events.off('end', endHandler);
        this.cleanup = () => {};
      };
    });
  }

  async return() {
    this.cleanup();
    return { value: undefined, done: true as const };
  }
}
