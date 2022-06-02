import { EventEmitter } from 'events';

import * as io from 'io-ts';
import Browser from 'webextension-polyfill';
import TypedEmitter from 'typed-emitter';

import ExplicitAny from '../types/ExplicitAny';
import AsyncReturnType from '../types/AsyncReturnType';

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
    hasChanged = defaultHasChanged,
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

type ChangeEvent<T> = {
  previous?: T;
  latest: T;
};

type ReadableCellEmitter<T> = TypedEmitter<{
  change(changeEvent: ChangeEvent<T>): void;
  end(): void;
}>;

type IReadableCell<T> = {
  events: ReadableCellEmitter<T>;
  ended: boolean;
  read(): Promise<T>;
  hasChanged(previous: T | undefined, latest: T): boolean;
  [Symbol.asyncIterator](): AsyncIterator<T>;
};

function defaultHasChanged<T>(previous: T | undefined, latest: T) {
  return JSON.stringify(previous) !== JSON.stringify(latest);
}

export class ExtensionLocalCell<T> implements IReadableCell<T> {
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
    public hasChanged: IReadableCell<T>['hasChanged'] = defaultHasChanged,
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

    if (this.hasChanged(previous?.value, newValue)) {
      this.events.emit('change', {
        previous: previous?.value,
        latest: newVersionedValue.value,
      });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return new ReadableCellIterator(this);
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
  lastProvided?: T;
  cleanup = () => {};

  constructor(public cell: IReadableCell<T>) {}

  async next() {
    const latestRead = await this.cell.read();

    if (
      this.lastProvided === undefined ||
      this.cell.hasChanged(this.lastProvided, latestRead)
    ) {
      this.lastProvided = latestRead;
      return { value: latestRead, done: false };
    }

    if (this.cell.ended) {
      return { value: undefined, done: true as const };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      const changeHandler = ({ latest }: ChangeEvent<T>) => {
        this.cleanup();
        this.lastProvided = latest;
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

type InputValues<InputCells extends Record<string, IReadableCell<unknown>>> = {
  [K in keyof InputCells]: AsyncReturnType<InputCells[K]['read']>;
};

export class FormulaCell<
  InputCells extends Record<string, IReadableCell<unknown>>,
  T,
> implements IReadableCell<T>
{
  events = new EventEmitter() as ReadableCellEmitter<T>;

  valuePromise: Promise<T>;
  lastProvidedValue?: T;
  ended = false;

  constructor(
    public inputCells: InputCells,
    public formula: (inputValues: InputValues<InputCells>) => T,
    public hasChanged = defaultHasChanged,
  ) {
    this.valuePromise = new Promise((resolve) => {
      this.events.once('change', ({ latest }) => resolve(latest));
    });

    (async () => {
      for await (const inputValues of toIterableOfRecords(inputCells)) {
        if (this.ended) {
          break;
        }

        const latest = formula(inputValues as InputValues<InputCells>);
        this.valuePromise = Promise.resolve(latest);

        if (hasChanged(this.lastProvidedValue, latest)) {
          this.events.emit('change', {
            previous: this.lastProvidedValue,
            latest,
          });
        }
      }

      this.end();
    })();
  }

  end() {
    this.ended = true;
    this.events.emit('end');
  }

  async read(): Promise<T> {
    return await this.valuePromise;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return new ReadableCellIterator<T>(this);
  }
}

/**
 * Wrapper around Object.keys which uses keyof to get the accurate key type.
 * (The builtin typing for Object.keys unnecessarily widens the type to
 * string[].)
 */
function recordKeys<R extends Record<string, unknown>>(record: R): (keyof R)[] {
  return Object.keys(record) as (keyof R)[];
}

type AsyncIteratee<I extends AsyncIterable<unknown>> = I extends AsyncIterable<
  infer T
>
  ? T
  : never;

function toIterableOfRecords<R extends Record<string, AsyncIterable<unknown>>>(
  recordOfIterables: R,
): AsyncIterable<{ [K in keyof R]: AsyncIteratee<R[K]> }> {
  return {
    [Symbol.asyncIterator]() {
      const latest = {} as { [K in keyof R]: AsyncIteratee<R[K]> };
      let providedFirstValue = false;
      let keysFilled = 0;
      const keysNeeded = recordKeys(recordOfIterables).length;
      let ended = false;
      let cleanup = () => {};

      const events = new EventEmitter() as TypedEmitter<{
        updated(): void;
        end(): void;
      }>;

      function end() {
        events.emit('end');
        cleanup();
        ended = true;
      }

      for (const key of recordKeys(recordOfIterables)) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          for await (const value of recordOfIterables[key]) {
            if (ended) {
              break;
            }

            if (!(key in latest)) {
              keysFilled += 1;
            }

            latest[key] = value as ExplicitAny;

            if (keysFilled === keysNeeded) {
              events.emit('updated');
            }
          }
        })();
      }

      return {
        async next() {
          if (!providedFirstValue && keysFilled === keysNeeded) {
            providedFirstValue = true;
            return { value: latest };
          }

          return new Promise<IteratorResult<typeof latest>>((resolve) => {
            const updatedHandler = () => {
              cleanup();
              resolve({ value: latest });
            };

            events.on('updated', updatedHandler);

            const endHandler = () => {
              cleanup();
              resolve({ value: undefined, done: true });
            };

            events.on('end', endHandler);

            cleanup = () => {
              events.off('updated', updatedHandler);
              events.off('end', endHandler);
            };
          });
        },
        async return(): Promise<IteratorResult<typeof latest>> {
          end();
          return { value: undefined, done: true };
        },
      };
    },
  };
}
