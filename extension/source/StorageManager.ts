import { EventEmitter } from 'events';

import * as io from 'io-ts';
import Browser from 'webextension-polyfill';
import TypedEmitter from 'typed-emitter';

import ExplicitAny from './types/ExplicitAny';

export default class StorageManager {
  cells: Record<
    string,
    { cell: StorageCell<ExplicitAny>; type: io.Type<ExplicitAny> } | undefined
  > = {};

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea = Browser.storage
      .local,
  ) {}

  Cell<T>(key: string, type: io.Type<T>, defaultValue: T): StorageCell<T> {
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

    const cell = new StorageCell(
      this.localStorageArea,
      key,
      type,
      defaultValue,
    );

    this.cells[key] = { cell, type };

    return cell;
  }
}

type Versioned<T> = { version: number; value: T };

type ChangeEvent<T> = {
  previous?: Versioned<T>;
  latest: Versioned<T>;
};

type ChangeEmitter<T> = TypedEmitter<{
  change(changeEvent: ChangeEvent<T>): void;
}>;

type IReadableCell<T> = {
  events: ChangeEmitter<T>;
  read(): Promise<T>;
  versionedRead(): Promise<Versioned<T>>;
  [Symbol.asyncIterator](): AsyncIterator<T>;
};

export class StorageCell<T> implements IReadableCell<T> {
  events = new EventEmitter() as ChangeEmitter<T>;

  versionedType: io.Type<Versioned<T>>;
  lastSeen?: Versioned<T>;
  initialRead: Promise<void>;

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea,
    public key: string,
    public type: io.Type<T>,
    public defaultValue: T,
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

    this.events.emit('change', { previous, latest: newVersionedValue });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    let lastProvidedVersion = -1;
    let cleanup = () => {};

    return {
      next: () =>
        new Promise((resolve) => {
          if (this.lastSeen && this.lastSeen.version > lastProvidedVersion) {
            lastProvidedVersion = this.lastSeen.version;
            resolve({ value: this.lastSeen.value, done: false });
            return;
          }

          const changeHandler = ({ latest }: ChangeEvent<T>) => {
            lastProvidedVersion = latest.version;
            resolve({ value: latest.value });
          };

          this.events.once('change', changeHandler);
          cleanup = () => this.events.off('change', changeHandler);
        }),
      return: () => {
        cleanup();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
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

class ReadableCellIterator<T> implements AsyncIterator<T> {
  lastProvidedVersion = -1;
  cleanup = () => {};

  constructor(public cell: IReadableCell<T>) {}

  async next() {
    const versionedReadResult = await this.cell.versionedRead();

    if (versionedReadResult.version > this.lastProvidedVersion) {
      this.lastProvidedVersion = versionedReadResult.version;
      return { value: versionedReadResult.value, done: false };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      const changeHandler = ({ latest }: ChangeEvent<T>) => {
        this.lastProvidedVersion = latest.version;
        resolve({ value: latest.value });
      };

      this.cell.events.once('change', changeHandler);
      this.cleanup = () => this.cell.events.off('change', changeHandler);
    });
  }

  async return() {
    this.cleanup();
    return { value: undefined, done: true as const };
  }
}
