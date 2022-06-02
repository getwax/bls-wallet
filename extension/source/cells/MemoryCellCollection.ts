import * as io from 'io-ts';
import assert from '../helpers/assert';

import CellCollection from './CellCollection';

export default function MemoryCellCollection(
  memory: Record<string, unknown> = {},
) {
  return new CellCollection({
    async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
      const readResult = memory[key];

      if (readResult !== undefined) {
        assert(type.is(readResult));
      }

      return readResult;
    },

    async write<T>(
      key: string,
      type: io.Type<T>,
      value: T | undefined,
    ): Promise<void> {
      if (value !== undefined) {
        assert(type.is(value));
      }

      memory[key] = value;
    },
  });
}
