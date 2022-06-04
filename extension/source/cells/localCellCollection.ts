import { EventEmitter } from 'events';

import * as io from 'io-ts';

import assert from '../helpers/assert';
import CellCollection from './CellCollection';
import IAsyncStorage from './IAsyncStorage';

const events = new EventEmitter() as IAsyncStorage['events'];

window.addEventListener('storage', evt => {
  if (evt.key !== null) {
    events.emit('change', [evt.key]);
  }
});

export default new CellCollection({
  async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
    const readResultStr = localStorage.getItem(key) ?? undefined;
    const readResult = readResultStr && JSON.parse(readResultStr);

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
    if (value === undefined) {
      localStorage.removeItem(key);
      return;
    }

    assert(type.is(value));

    localStorage.setItem(key, JSON.stringify(value));
  },

  events,
});
