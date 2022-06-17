import { runtime } from 'webextension-polyfill';
import assertType from './cells/assertType';
import isType from './cells/isType';
import { createRandomId } from './Controllers/utils';
import {
  EventsPortInfo,
  PublicRpcMessage,
  PublicRpcResponse,
  RpcResult,
  SetEventEnabledMessage,
} from './types/Rpc';

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

eventsPort.onDisconnect.addListener(() => {
  console.error('Events port disconnected', eventsPortInfo);
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

if (canInjectScript()) {
  injectScript();
}
