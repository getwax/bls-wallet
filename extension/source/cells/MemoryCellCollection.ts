import { EventEmitter } from 'events';

import * as io from 'io-ts';

import assertType from './assertType';
import CellCollection from './CellCollection';
import IAsyncStorage from './IAsyncStorage';

export default function MemoryCellCollection(
  memory: Record<string, unknown> = {},
) {
  const events = new EventEmitter() as IAsyncStorage['events'];

  return new CellCollection({
    async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
      const readResult = memory[key];

      if (readResult !== undefined) {
        assertType(readResult, type);
      }

      return readResult;
    },

    async write<T>(
      key: string,
      type: io.Type<T>,
      value: T | undefined,
    ): Promise<void> {
      if (value !== undefined) {
        assertType(value, type);
      }

      memory[key] = value;

      events.emit('change', [key]);
    },

    events,
  });
}
