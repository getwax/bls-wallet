import * as io from 'io-ts';
import Browser from 'webextension-polyfill';

import assert from '../helpers/assert';
import CellCollection from './CellCollection';

export default function ExtensionLocalStorage(
  localStorageArea = Browser.storage.local,
) {
  return new CellCollection({
    async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
      const readResult = (await localStorageArea.get(key))[key];

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
        localStorageArea.remove(key);
        return;
      }

      assert(type.is(value));

      localStorageArea.set({
        [key]: value,
      });
    },
  });
}
