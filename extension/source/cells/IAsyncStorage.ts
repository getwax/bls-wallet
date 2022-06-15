import * as io from 'io-ts';
import TypedEmitter from 'typed-emitter';

type IAsyncStorage = {
  read<T>(key: string, type: io.Type<T>): Promise<T | undefined>;
  write<T>(key: string, type: io.Type<T>, value: T | undefined): Promise<void>;
  events: TypedEmitter<{
    change(keys: string[]): void;
  }>;
};

export default IAsyncStorage;
