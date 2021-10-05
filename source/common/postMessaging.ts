import generateRandomHex from '../helpers/generateRandomHex';
import TransportClient from './TransportClient';

const ackDelayMax = 100; // milliseconds

export function PostMessageTransportClient(target: string): TransportClient {
  return (...args: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      const messageId = generateRandomHex(256);

      const ackTimer = setTimeout(() => {
        reject(new Error('Message not acknowledged'));
      }, ackDelayMax);

      function messageListener(evt: MessageEvent) {
        if (evt.data.messageId !== messageId) {
          return;
        }

        clearTimeout(ackTimer);

        if (evt.data.type === 'ack') {
          // Do nothing (timer cleared on any messageId match above)
        } else if (evt.data.type === 'response') {
          window.removeEventListener('message', messageListener);
          resolve(evt.data.response);
        } else if (evt.data.type === 'error') {
          window.removeEventListener('message', messageListener);
          reject(new Error(evt.data.errorMessage));
        } else {
          console.warn('Unexpected message', evt);
        }
      }

      window.addEventListener('message', messageListener);

      window.postMessage(
        {
          target,
          messageId,
          args,
        },
        '*',
      );
    });
}

export function PostMessageTransportServer(
  target: string,
  handler: (...args: unknown[]) => Promise<unknown>,
): { close(): void } {
  async function messageListener(evt: MessageEvent) {
    if (evt.data.target !== target) {
      return;
    }

    const { messageId } = evt.data.messageId;

    let replied = false;

    // Send an ack if we don't send a reply asap
    setTimeout(() => {
      if (replied === false) {
        window.postMessage({ messageId, type: 'ack' }, '*');
      }
    });

    try {
      const response = await handler(...evt.data.args);
      window.postMessage({ messageId, type: 'response', response }, '*');
    } catch (error) {
      window.postMessage(
        { messageId, type: 'error', errorMessage: (error as Error).message },
        '*',
      );
    }

    replied = true;
  }

  window.addEventListener('message', messageListener);

  return {
    close() {
      window.removeEventListener('message', messageListener);
    },
  };
}
