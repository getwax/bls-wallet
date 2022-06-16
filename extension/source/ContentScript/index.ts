import {
  BasePostMessageStream,
  ObjectMultiplex,
  Stream,
} from '@toruslabs/openlogin-jrpc';
import pump from 'pump';
import { runtime } from 'webextension-polyfill';
import assertType from '../cells/assertType';
import isType from '../cells/isType';
import { CONTENT_SCRIPT, INPAGE, PROVIDER } from '../common/constants';
import PortDuplexStream from '../common/PortStream';
import { createRandomId } from '../Controllers/utils';
import {
  EventsPortInfo,
  PublicRpcMessage,
  PublicRpcResponse,
  RpcResult,
  SetEventEnabledMessage,
} from '../types/Rpc';

const providerId = createRandomId();

const eventsPortInfo: EventsPortInfo = {
  type: 'quill-events-port',
  providerId,
  origin: window.location.origin,
};

const eventsPort = runtime.connect(undefined, {
  name: JSON.stringify(eventsPortInfo),
});

eventsPort.onMessage.addListener((message) => {
  window.postMessage(message, '*');
});

window.addEventListener('message', (evt) => {
  if (!isType(evt.data, SetEventEnabledMessage)) {
    return;
  }

  eventsPort.postMessage(evt.data);
});

window.addEventListener('message', async (evt) => {
  const data = {
    ...evt.data,
    providerId,
    origin: window.location.origin,
  };

  if (!isType(data, PublicRpcMessage)) {
    return;
  }

  const result = await runtime.sendMessage(data);
  assertType(result, RpcResult);

  if ('error' in result) {
    const error = new Error(result.error.message);
    error.stack = result.error.stack;
    console.error(error);

    // Being extra careful about security here - error stacks should not contain
    // sensitive information, but they could. For this reason we log the error
    // here in the console but do not expose it to the dApp.
    const message =
      'Quill RPC: (See content script or background script for details)';

    result.error = {
      message,
      stack: new Error(message).stack,
    };
  }

  const response: PublicRpcResponse = {
    type: 'quill-public-rpc-response',
    id: data.id,
    result,
  };

  window.postMessage(response, '*');
});

function canInjectScript() {
  if (window.document.doctype?.name !== 'html') return false;
  if (window.location.pathname.endsWith('.pdf')) return false;
  if (document.documentElement.nodeName.toLowerCase() !== 'html') return false;

  // Can add other checks later
  return true;
}

function injectScript() {
  try {
    const container = document.head || document.documentElement;
    const pageContentScriptTag = document.createElement('script');
    pageContentScriptTag.src = runtime.getURL('js/pageContentScript.bundle.js');
    container.insertBefore(pageContentScriptTag, container.children[0]);
    // Can remove after script injection
    container.removeChild(pageContentScriptTag);
  } catch (error) {
    console.error(error, 'Quill script injection failed');
  }
}

/**
 * Sets up two-way communication streams between the
 * browser extension and local per-page browser context.
 *
 */
async function setupStreams() {
  // the transport-specific streams for communication between inpage and background
  const pageStream = new BasePostMessageStream({
    name: CONTENT_SCRIPT,
    target: INPAGE,
  });
  const extensionPort = runtime.connect(undefined, {
    name: CONTENT_SCRIPT,
  });
  const extensionStream = new PortDuplexStream(extensionPort);

  // create and connect channel muxers
  // so we can handle the channels individually
  const pageMux = new ObjectMultiplex();
  const extensionMux = new ObjectMultiplex();

  pump(
    pageMux as unknown as Stream,
    pageStream as unknown as Stream,
    pageMux as unknown as Stream,
    (err) => logStreamDisconnectWarning('Quill Inpage Multiplex', err),
  );
  pump(
    extensionMux as unknown as Stream,
    extensionStream as unknown as Stream,
    extensionMux as unknown as Stream,
    (err) => {
      logStreamDisconnectWarning('Quill Background Multiplex', err);
      window.postMessage(
        {
          target: INPAGE, // the post-message-stream "target"
          data: {
            // this object gets passed to obj-multiplex
            name: PROVIDER, // the obj-multiplex channel name
            data: {
              jsonrpc: '2.0',
              method: 'QUILL_STREAM_FAILURE',
            },
          },
        },
        window.location.origin,
      );
    },
  );

  // forward communication across inpage-background for these channels only
  forwardTrafficBetweenMuxes(PROVIDER, pageMux, extensionMux);
}

function forwardTrafficBetweenMuxes(
  channelName: string,
  muxA: ObjectMultiplex,
  muxB: ObjectMultiplex,
) {
  const channelA = muxA.createStream(channelName);
  const channelB = muxB.createStream(channelName);
  pump(
    channelA as unknown as Stream,
    channelB as unknown as Stream,
    channelA as unknown as Stream,
    (error) =>
      console.debug(
        `Quill: Muxed traffic for channel "${channelName}" failed.`,
        error,
      ),
  );
}

function logStreamDisconnectWarning(remoteLabel: string, error: unknown) {
  console.debug(
    `Quill: Content script lost connection to "${remoteLabel}".`,
    error,
  );
}

if (canInjectScript()) {
  injectScript();
  setupStreams();
}
