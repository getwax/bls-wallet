import * as io from 'io-ts';
import Browser from 'webextension-polyfill';

import ExplicitAny from './types/ExplicitAny';

export default class StorageManager {
  cells: Record<
    string,
    { cell: StorageCell<ExplicitAny>; type: io.Type<ExplicitAny> } | undefined
  > = {};

  constructor(public localStorageArea: Browser.Storage.LocalStorageArea) {}

  Cell<T>(key: string, type: io.Type<T>): StorageCell<T> {
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

    const cell = new StorageCell(this.localStorageArea, key, type);
    this.cells[key] = { cell, type };

    return cell;
  }
}

type Versioned<T> = { version: number; value: T };

class StorageCell<T> {
  fullType: io.Type<Versioned<T>>;
  last?: Versioned<T>;
  initialRead: Promise<void>;

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea,
    public key: string,
    public type: io.Type<T>,
  ) {
    this.fullType = io.type({ version: io.number, value: type });

    this.initialRead = this.fullRead().then((getResult) => {
      this.last = getResult;
    });
  }

  async fullRead(): Promise<Versioned<T> | undefined> {
    const getResult = (await this.localStorageArea.get(this.key))[this.key];

    if (getResult === undefined) {
      return undefined;
    }

    if (!this.fullType.is(getResult)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${getResult}`,
          `expected: ${this.fullType.name}`,
        ].join(' '),
      );
    }

    return getResult;
  }

  async read(): Promise<T | undefined> {
    const latest = await this.fullRead();
    this.#ensureVersionMatch(latest);
    return latest?.value;
  }

  async write(newValue: T): Promise<void> {
    await this.initialRead;
    const latest = await this.fullRead();
    this.#ensureVersionMatch(latest);

    const newFullValue = {
      version: (this.last?.version ?? 0) + 1,
      value: newValue,
    };

    await this.localStorageArea.set({
      [this.key]: newFullValue,
    });

    this.last = newFullValue;
  }

  #ensureVersionMatch(latest: Versioned<T> | undefined) {
    if (latest?.version !== this.last?.version) {
      throw new Error(
        [
          "Latest version doesn't match last read. This is a problem because",
          'we assume that we have exclusive access to storage - we only want',
          'to overwrite our own changes, not changes made elsewhere.',
          `${JSON.stringify({ last: this.last, latest })}`,
        ].join(' '),
      );
    }
  }
}
