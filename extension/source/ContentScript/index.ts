import {
  BasePostMessageStream,
  ObjectMultiplex,
  Stream,
} from '@toruslabs/openlogin-jrpc';
import pump from 'pump';
import { runtime } from 'webextension-polyfill';
import { CONTENT_SCRIPT, INPAGE, PROVIDER } from '../common/constants';
import PortDuplexStream from '../common/PortStream';
import { PublicRpcMessage, PublicRpcResponse } from '../types/Rpc';

window.addEventListener('message', async (evt) => {
  const data = {
    ...evt.data,
    origin: window.location.origin,
  };

  if (!PublicRpcMessage.is(data)) {
    return;
  }

  const response = await runtime.sendMessage(data);

  const reply: PublicRpcResponse = {
    type: 'quill-public-rpc-response',
    id: data.id,
    response,
  };

  window.postMessage(reply, '*');
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
