import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';

import { ChangeEvent, IReadableCell } from './ICell';

export default class CellIterator<T> implements AsyncIterator<T> {
  lastProvided?: { value: T };
  cleanup = () => {};
  endHandler = () => {};

  events = new EventEmitter() as TypedEmitter<{
    finished(): void;
  }>;

  constructor(public cell: IReadableCell<T>) {
    this.cell.events.once('end', this.endHandler);

    this.cleanup = () => {
      this.cell.events.off('end', this.endHandler);
    };
  }

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

      this.endHandler = () => {
        this.cleanup();
        resolve({ value: undefined, done: true });
      };

      this.cleanup = () => {
        this.cell.events.off('change', changeHandler);
        this.cell.events.off('end', this.endHandler);
        this.cleanup = () => {};
      };
    });
  }

  async return() {
    this.cleanup();
    this.events.emit('finished');
    return { value: undefined, done: true as const };
  }
}
