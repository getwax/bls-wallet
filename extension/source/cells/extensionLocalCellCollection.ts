import { EventEmitter } from 'events';

import * as io from 'io-ts';
import Browser from 'webextension-polyfill';

import assert from '../helpers/assert';
import CellCollection from './CellCollection';
import IAsyncStorage from './IAsyncStorage';

const events = new EventEmitter() as IAsyncStorage['events'];

Browser.storage.onChanged.addListener((changes) => {
  events.emit('change', Object.keys(changes));
});

export default new CellCollection({
  async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
    const readResult = (await Browser.storage.local.get(key))[key];

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
      Browser.storage.local.remove(key);
      return;
    }

    assert(type.is(value));

    Browser.storage.local.set({
      [key]: value,
    });
  },

  events,
});
