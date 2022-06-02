import { EventEmitter } from 'events';
import assert from '../helpers/assert';
import CellIterator from './CellIterator';

import ICell, { ReadableCellEmitter } from './ICell';
import jsonHasChanged from './jsonHasChanged';

export default class MemoryCell<T> implements ICell<T> {
  events = new EventEmitter() as ReadableCellEmitter<T>;
  ended = false;

  constructor(
    public value: T,
    public hasChanged: ICell<T>['hasChanged'] = jsonHasChanged,
  ) {}

  async read(): Promise<T> {
    return this.value;
  }

  async write(newValue: T): Promise<void> {
    assert(!this.ended);

    const { value: previous } = this;
    this.value = newValue;

    if (this.hasChanged(previous, this.value)) {
      this.events.emit('change', {
        previous,
        latest: this.value,
      });
    }
  }

  end() {
    this.events.emit('end');
    this.ended = true;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return new CellIterator(this);
  }
}
