import { EventEmitter } from 'events';

import * as io from 'io-ts';

import assertType from '../cells/assertType';
import isType from '../cells/isType';
import { createRandomId } from '../Controllers/utils';
import ExplicitAny from '../types/ExplicitAny';
import {
  Notification,
  NotificationEventEmitter,
  PublicRpcMessage,
  PublicRpcResponse,
  SetEventEnabledMessage,
} from '../types/Rpc';

const RequestBody = io.type({
  method: io.string,
  params: io.union([io.undefined, io.array(io.unknown)]),
});

export default class QuillProvider extends (EventEmitter as NotificationEventEmitter) {
  // FIXME: We should take care to underscore/make private things since this
  // will be exposed to dApps (and we don't want to create things that need to
  // be deprecated).

  isQuill = true;
  breakOnAssertionFailures = false;

  constructor() {
    super();

    window.addEventListener('message', (evt) => {
      if (!isType(evt.data, Notification)) {
        return;
      }

      this.emit(evt.data.eventName, evt.data.value as ExplicitAny);
    });

    this.on('newListener', (eventName) => {
      if (this.listenerCount(eventName) === 0) {
        const message: SetEventEnabledMessage = {
          type: 'quill-set-event-enabled',
          eventName,
          enabled: true,
        };

        window.postMessage(message, '*');
      }
    });

    this.on('removeListener', (eventName) => {
      if (this.listenerCount(eventName) === 0) {
        const message: SetEventEnabledMessage = {
          type: 'quill-set-event-enabled',
          eventName,
          enabled: false,
        };

        window.postMessage(message, '*');
      }
    });

    this.watchThings();
  }

  async request(body: unknown) {
    assertType(body, RequestBody);

    const id = createRandomId();

    const message: Omit<PublicRpcMessage, 'providerId' | 'origin'> = {
      type: 'quill-public-rpc',
      id,
      // Note: We do not set providerId or origin here because our code is
      // co-mingled with the dApp and is therefore untrusted. Instead, the
      // content script will add these fields before passing them along to the
      // background script.
      // providerId: this.id,
      // origin: window.location.origin,
      method: body.method,
      params: body.params ?? [],
    };

    window.postMessage(message, '*');

    return await new Promise((resolve, reject) => {
      const messageListener = (evt: MessageEvent<unknown>) => {
        if (!isType(evt.data, PublicRpcResponse)) {
          return;
        }

        if (evt.data.id !== id) {
          return;
        }

        window.removeEventListener('message', messageListener);

        if ('ok' in evt.data.result) {
          resolve(evt.data.result.ok);
        } else if ('error' in evt.data.result) {
          const error = new Error(evt.data.result.error.message);
          error.stack = evt.data.result.error.stack;
          reject(error);
        }
      };

      window.addEventListener('message', messageListener);
    });
  }

  watchThings() {
    (async () => {
      while (true) {
        this.breakOnAssertionFailures = (await this.request({
          method: 'quill_breakOnAssertionFailures',
          params: [this.breakOnAssertionFailures],
        })) as boolean;
      }
    })();
  }
}
