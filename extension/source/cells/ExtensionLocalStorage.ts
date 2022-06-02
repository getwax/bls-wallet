import { EventEmitter } from 'events';

import * as io from 'io-ts';
import Browser from 'webextension-polyfill';

import ExplicitAny from '../types/ExplicitAny';
import ICell, { ReadableCellEmitter } from './ICell';
import CellIterator from './CellIterator';
import jsonHasChanged from './jsonHasChanged';
import assert from '../helpers/assert';

export default class ExtensionLocalStorage {
  cells: Record<
    string,
    | {
        cell: ExtensionLocalCell<ExplicitAny>;
        type: io.Type<ExplicitAny>;
      }
    | undefined
  > = {};

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea = Browser.storage
      .local,
  ) {}

  Cell<T>(
    key: string,
    type: io.Type<T>,
    defaultValue: T,
    hasChanged = jsonHasChanged,
  ): ExtensionLocalCell<T> {
    const entry = this.cells[key];

    if (entry) {
      if (entry.type.name !== type.name) {
        throw new Error(
          [
            'Tried to get existing storage cell with a different type',
            `(type: ${type.name}, existing: ${entry.type.name})`,
          ].join(' '),
        );
      }

      return entry.cell;
    }

    const cell = new ExtensionLocalCell(
      this.localStorageArea,
      key,
      type,
      defaultValue,
      hasChanged,
    );

    this.cells[key] = { cell, type };

    return cell;
  }
}

type Versioned<T> = { version: number; value: T };

export class ExtensionLocalCell<T> implements ICell<T> {
  events = new EventEmitter() as ReadableCellEmitter<T>;
  ended = false;

  versionedType: io.Type<Versioned<T>>;
  lastSeen?: Versioned<T>;
  initialRead: Promise<void>;

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea,
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

  async read(): Promise<T> {
    const latest = await this.versionedRead();
    this.#ensureVersionMatch(latest);
    return latest.value;
  }

  async write(newValue: T): Promise<void> {
    assert(!this.ended);

    await this.initialRead;
    const latest = await this.versionedRead();
    this.#ensureVersionMatch(latest);

    const newVersionedValue = {
      version: (this.lastSeen?.version ?? 0) + 1,
      value: newValue,
    };

    await this.localStorageArea.set({
      [this.key]: newVersionedValue,
    });

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
    const getResult = (await this.localStorageArea.get(this.key))[this.key];

    if (getResult === undefined) {
      const latest = { version: 0, value: this.defaultValue };
      this.lastSeen = latest;
      await this.localStorageArea.set({ [this.key]: latest });
      return latest;
    }

    if (!this.versionedType.is(getResult)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${JSON.stringify(getResult)}`,
          `expected: ${this.versionedType.name}`,
        ].join(' '),
      );
    }

    return getResult;
  }

  #ensureVersionMatch(latest: Versioned<T> | undefined) {
    if (latest?.version !== this.lastSeen?.version) {
      throw new Error(
        [
          "Latest version doesn't match last seen. This is a problem because",
          'we assume that we have exclusive access to storage - we only want',
          'to overwrite our own changes, not changes made elsewhere.',
          `${JSON.stringify({ lastSeen: this.lastSeen, latest })}`,
        ].join(' '),
      );
    }
  }
}
