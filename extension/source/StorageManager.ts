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

export class StorageCell<T> {
  events = new EventEmitter() as TypedEmitter<{
    change(changeEvent: ChangeEvent<T>): void;
  }>;

  fullType: io.Type<Versioned<T>>;
  lastSeen?: Versioned<T>;
  initialRead: Promise<void>;

  constructor(
    public localStorageArea: Browser.Storage.LocalStorageArea,
    public key: string,
    public type: io.Type<T>,
    public defaultValue: T,
  ) {
    this.fullType = io.type({ version: io.number, value: type });

    this.initialRead = this.#fullRead().then((fullReadResult) => {
      this.lastSeen = fullReadResult;
    });
  }

  async read(): Promise<T> {
    const latest = await this.#fullRead();
    this.#ensureVersionMatch(latest);
    return latest.value;
  }

  async write(newValue: T): Promise<void> {
    await this.initialRead;
    const latest = await this.#fullRead();
    this.#ensureVersionMatch(latest);

    const newFullValue = {
      version: (this.lastSeen?.version ?? 0) + 1,
      value: newValue,
    };

    await this.localStorageArea.set({
      [this.key]: newFullValue,
    });

    const { lastSeen: previous } = this;
    this.lastSeen = newFullValue;

    this.events.emit('change', { previous, latest: newFullValue });
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

  async #fullRead(): Promise<Versioned<T>> {
    const getResult = (await this.localStorageArea.get(this.key))[this.key];

    if (getResult === undefined) {
      const latest = { version: 0, value: this.defaultValue };
      this.lastSeen = latest;
      await this.localStorageArea.set({ [this.key]: latest });
      return latest;
    }

    if (!this.fullType.is(getResult)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${JSON.stringify(getResult)}`,
          `expected: ${this.fullType.name}`,
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
