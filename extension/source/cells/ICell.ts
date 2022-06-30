import TypedEmitter from 'typed-emitter';

type ICell<T> = {
  events: CellEmitter<T>;
  ended: boolean;
  read(): Promise<T>;
  write(newValue: T): Promise<void>;
  update(updates: StrictPartial<T>): Promise<void>;
  hasChanged(previous: T | undefined, latest: T): boolean;
  [Symbol.asyncIterator](): AsyncIterator<T>;
};

/**
 * `Partial<T>` has the following problem:
 * ```ts
 * type X = Partial<number>;
 * // X == number
 * ```
 *
 * That's not what we want when we intend to write something like this:
 * ```ts
 * function update<T>(value: T, updates: Partial<T>): T {
 *   return {
 *     ...value,
 *     ...updates,
 *   };
 * }
 * ```
 *
 * `StrictPartial<T>` fixes this by returning `never` for these kinds of cases.
 */
export type StrictPartial<T> = T extends object
  ? T extends unknown[]
    ? never
    : Partial<T>
  : never;

export type IReadableCell<T> = Omit<ICell<T>, 'write' | 'update'>;

export type ChangeEvent<T> = {
  previous?: T;
  latest: T;
};

export type CellEmitter<T> = TypedEmitter<{
  change(changeEvent: ChangeEvent<T>): void;
  end(): void;
}>;

export default ICell;
