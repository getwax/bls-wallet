import { EventEmitter } from 'events';

import * as io from 'io-ts';

import ExplicitAny from '../types/ExplicitAny';
import ICell, { CellEmitter } from './ICell';
import CellIterator from './CellIterator';
import jsonHasChanged from './jsonHasChanged';
import assert from '../helpers/assert';
import IAsyncStorage from './IAsyncStorage';

export default class CellCollection {
  cells: Record<string, CollectionCell<ExplicitAny> | undefined> = {};

  #asyncStorageChangeHandler = (keys: string[]) => {
    for (const key of keys) {
      const cell = this.cells[key];

      if (cell) {
        cell.versionedRead();
      }
    }
  };

  constructor(public asyncStorage: IAsyncStorage) {
    asyncStorage.events.on('change', this.#asyncStorageChangeHandler);
  }

  /**
   * A `CellCollection` is usually intended to live for the life of your
   * application. In that case, calling .end is not required. However, if you're
   * doing something different and you'd like to clean up the change event
   * handler, this will take care of that.
   */
  end() {
    this.asyncStorage.events.removeListener(
      'change',
      this.#asyncStorageChangeHandler,
    );
  }

  Cell<T>(
    key: string,
    type: io.Type<T>,
    defaultValue: T,
    hasChanged = jsonHasChanged,
  ): CollectionCell<T> {
    let cell = this.cells[key];

    if (cell) {
      cell.applyType(type);
      return cell;
    }

    cell = new CollectionCell(
      this.asyncStorage,
      key,
      type,
      defaultValue,
      hasChanged,
    );

    this.cells[key] = cell;

    return cell;
  }

  async remove(key: string) {
    const cell = this.cells[key];
    cell?.end();
    delete this.cells[key];

    await this.asyncStorage.write(key, io.undefined, undefined);
  }
}

export type Versioned<T> = { version: number; value: T };

export class CollectionCell<T> implements ICell<T> {
  events = new EventEmitter() as CellEmitter<T>;
  ended = false;

  versionedType: io.Type<Versioned<T>>;
  lastSeen?: Versioned<T>;
  initialRead: Promise<void>;

  constructor(
    public asyncStorage: IAsyncStorage,
    public key: string,
    public type: io.Type<T>,
    public defaultValue: T,
    public hasChanged: ICell<T>['hasChanged'] = jsonHasChanged,
  ) {
    this.versionedType = io.type({ version: io.number, value: type });

    this.initialRead = this.versionedRead().then((versionedReadResult) => {
      this.lastSeen = versionedReadResult;
    });
  }

  applyType<X>(type: io.Type<X>) {
    if (type === io.unknown) {
      return;
    }

    if (this.type !== io.unknown && this.type.name !== type.name) {
      throw new Error(
        [
          'Tried to get existing storage cell with a different type',
          `(type: ${type.name}, existing: ${this.type.name})`,
        ].join(' '),
      );
    }

    if (this.lastSeen && !type.is(this.lastSeen.value)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${JSON.stringify(this.lastSeen.value)}`,
          `expected: ${type.name}`,
        ].join(' '),
      );
    }

    if (this.type === io.unknown) {
      this.type = type as unknown as io.Type<T>;
      this.versionedType = io.type({ version: io.number, value: this.type });
    }
  }

  async read(): Promise<T> {
    const latest = await this.versionedRead();
    return latest.value;
  }

  async write(newValue: T): Promise<void> {
    assert(!this.ended);
    assert(this.type.is(newValue));

    await this.initialRead;

    const newVersionedValue = {
      version: (this.lastSeen?.version ?? 0) + 1,
      value: newValue,
    };

    const latest = await this.versionedRead();

    if (!(newVersionedValue.version > latest.version)) {
      throw new Error('Rejecting write which is not newer than remote');
    }

    await this.asyncStorage.write(
      this.key,
      this.versionedType,
      newVersionedValue,
    );

    const { lastSeen: previous } = this;
    this.lastSeen = newVersionedValue;

    if (this.hasChanged(previous?.value, newValue)) {
      this.events.emit('change', {
        previous: previous?.value,
        latest: newVersionedValue.value,
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

  async versionedRead(): Promise<Versioned<T>> {
    const readResult = (await this.asyncStorage.read(
      this.key,
      this.versionedType,
    )) ?? { version: 0, value: this.defaultValue };

    if (!this.versionedType.is(readResult)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${JSON.stringify(readResult)}`,
          `expected: ${this.versionedType.name}`,
        ].join(' '),
      );
    }

    if (this.hasChanged(this.lastSeen?.value, readResult.value)) {
      this.events.emit('change', {
        previous: this.lastSeen?.value,
        latest: readResult.value,
      });
    }

    this.lastSeen = readResult;

    return readResult;
  }
}
