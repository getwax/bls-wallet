import * as io from 'io-ts';

// TODO: Use this
export default function optional<T>(type: io.Type<T>) {
  return io.union([io.undefined, type]);
}
