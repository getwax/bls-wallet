import * as io from 'io-ts';

export default function optional<T>(type: io.Type<T>) {
  return io.union([io.undefined, type]);
}
