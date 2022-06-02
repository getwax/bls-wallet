import TypedEmitter from 'typed-emitter';

type ICell<T> = {
  events: ReadableCellEmitter<T>;
  ended: boolean;
  read(): Promise<T>;
  write(newValue: T): Promise<void>;
  hasChanged(previous: T | undefined, latest: T): boolean;
  [Symbol.asyncIterator](): AsyncIterator<T>;
};

export type IReadableCell<T> = Omit<ICell<T>, 'write'>;

export type ChangeEvent<T> = {
  previous?: T;
  latest: T;
};

export type ReadableCellEmitter<T> = TypedEmitter<{
  change(changeEvent: ChangeEvent<T>): void;
  end(): void;
}>;

export default ICell;
