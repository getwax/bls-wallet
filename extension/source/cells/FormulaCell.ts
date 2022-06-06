import { EventEmitter } from 'events';

import TypedEmitter from 'typed-emitter';

import AsyncReturnType from '../types/AsyncReturnType';
import ExplicitAny from '../types/ExplicitAny';
import CellIterator from './CellIterator';
import { IReadableCell, CellEmitter } from './ICell';
import jsonHasChanged from './jsonHasChanged';
import recordKeys from '../helpers/recordKeys';
import MemoryCell from './MemoryCell';

type InputValues<InputCells extends Record<string, IReadableCell<unknown>>> = {
  [K in keyof InputCells]: AsyncReturnType<InputCells[K]['read']>;
};

export class FormulaCell<
  InputCells extends Record<string, IReadableCell<unknown>>,
  T,
> implements IReadableCell<Awaited<T>>
{
  events = new EventEmitter() as CellEmitter<Awaited<T>>;

  lastProvidedValue?: Awaited<T>;
  iterationCell?: MemoryCell<'pending' | { value: Awaited<T> }>;
  ended = false;
  iteratorCount = 0;

  constructor(
    public inputCells: InputCells,
    public formula: (inputValues: InputValues<InputCells>) => T,
    public hasChanged = jsonHasChanged,
  ) {}

  end() {
    this.events.emit('end');
    this.ended = true;
  }

  async read(): Promise<Awaited<T>> {
    const iterationCell = this.iterateInputs();

    try {
      for await (const iterationState of iterationCell) {
        if (iterationState === 'pending') {
          continue;
        }

        return iterationState.value;
      }
    } finally {
      this.iteratorCount -= 1;
    }

    throw new Error('Inputs ended');
  }

  [Symbol.asyncIterator](): AsyncIterator<Awaited<T>> {
    this.iterateInputs();

    const iterator = new CellIterator<Awaited<T>>(this);

    iterator.events.on('finished', () => {
      this.iteratorCount -= 1;
    });

    return iterator;
  }

  iterateInputs() {
    this.iteratorCount += 1;

    if (this.iterationCell) {
      return this.iterationCell;
    }

    this.iterationCell = new MemoryCell<'pending' | { value: Awaited<T> }>(
      'pending',
      (previous, latest) => {
        if (previous === undefined) {
          return true;
        }

        if (previous === 'pending' || latest === 'pending') {
          return previous !== latest;
        }

        return this.hasChanged(previous.value, latest.value);
      },
    );

    const { iterationCell } = this;

    (async () => {
      for await (const inputValues of toIterableOfRecords(this.inputCells)) {
        if (this.ended || this.iteratorCount === 0) {
          break;
        }

        const latest = await this.formula(
          inputValues as InputValues<InputCells>,
        );

        iterationCell.write({ value: latest });

        if (this.hasChanged(this.lastProvidedValue, latest)) {
          this.events.emit('change', {
            previous: this.lastProvidedValue,
            latest,
          });
        }
      }

      iterationCell.end();
      this.iterationCell = undefined;

      if (this.iteratorCount > 0) {
        this.end();
      }
    })();

    return iterationCell;
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
