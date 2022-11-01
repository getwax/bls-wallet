import { EventEmitter } from 'events';

import * as io from 'io-ts';
import Browser from 'webextension-polyfill';
import encryptor from 'browser-passworder';

import assertType from './assertType';
import CellCollection from './CellCollection';
import IAsyncStorage from './IAsyncStorage';

const events = new EventEmitter() as IAsyncStorage['events'];

Browser.storage.onChanged.addListener((changes) => {
  events.emit('change', Object.keys(changes));
});

// TODO: Store users key that is generated from the password in memory so we
// don't keep a copy of the password
const PASSWORD = 'TEMP_PASSWORD';

// TODO: Salt should be generated randomly on startup and stored unencrypted
const SALT = 'TEMP_SALT';

const passwordKeyPromise = encryptor.keyFromPassword(PASSWORD, SALT);

export default new CellCollection({
  async read<T>(key: string, type: io.Type<T>): Promise<T | undefined> {
    const readResult = (await Browser.storage.local.get(key))[key];

    if (readResult === undefined) {
      return undefined;
    }

    const payload = JSON.parse(readResult);
    const passwordKey = await passwordKeyPromise;
    const decryptedValue = await encryptor.decryptWithKey(passwordKey, payload);

    assertType(decryptedValue, type);

    return decryptedValue;
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

    assertType(value, type);

    const passwordKey = await passwordKeyPromise;
    const encryptedPayload = await encryptor.encryptWithKey(passwordKey, value);

    Browser.storage.local.set({
      [key]: JSON.stringify(encryptedPayload),
    });
  },

  events,
});
