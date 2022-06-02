import { EventEmitter } from 'events';

import TypedEmitter from 'typed-emitter';

import AsyncReturnType from '../types/AsyncReturnType';
import ExplicitAny from '../types/ExplicitAny';
import CellIterator from './CellIterator';
import { IReadableCell, CellEmitter } from './ICell';
import jsonHasChanged from './jsonHasChanged';
import recordKeys from './recordKeys';

type InputValues<InputCells extends Record<string, IReadableCell<unknown>>> = {
  [K in keyof InputCells]: AsyncReturnType<InputCells[K]['read']>;
};

export class FormulaCell<
  InputCells extends Record<string, IReadableCell<unknown>>,
  T,
> implements IReadableCell<Awaited<T>>
{
  events = new EventEmitter() as CellEmitter<Awaited<T>>;

  valuePromise: Promise<Awaited<T>>;
  lastProvidedValue?: Awaited<T>;
  ended = false;

  constructor(
    public inputCells: InputCells,
    public formula: (inputValues: InputValues<InputCells>) => T,
    public hasChanged = jsonHasChanged,
  ) {
    this.valuePromise = new Promise((resolve) => {
      this.events.once('change', ({ latest }) => resolve(latest));
    });

    (async () => {
      for await (const inputValues of toIterableOfRecords(inputCells)) {
        if (this.ended) {
          break;
        }

        const latest = await formula(inputValues as InputValues<InputCells>);
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
    this.events.emit('end');
    this.ended = true;
  }

  async read(): Promise<Awaited<T>> {
    return await this.valuePromise;
  }

  [Symbol.asyncIterator](): AsyncIterator<Awaited<T>> {
    return new CellIterator<Awaited<T>>(this);
  }
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
      let latestVersion = 0;
      let providedVersion = 0;
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
              latestVersion += 1;
              events.emit('updated');
            }
          }
        })();
      }

      return {
        async next() {
          if (latestVersion > providedVersion) {
            providedVersion = latestVersion;
            return { value: latest };
          }

          return new Promise<IteratorResult<typeof latest>>((resolve) => {
            const updatedHandler = () => {
              cleanup();
              providedVersion = latestVersion;
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
