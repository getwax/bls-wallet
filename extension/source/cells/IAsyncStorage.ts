import * as io from 'io-ts';

type IAsyncStorage = {
  read<T>(key: string, type: io.Type<T>): Promise<T | undefined>;
  write<T>(key: string, type: io.Type<T>, value: T | undefined): Promise<void>;
};

export default IAsyncStorage;
