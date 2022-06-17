/**
 * The only thing this does is inject the in-page script and relay communication
 * between that in-page script and the background script.
 *
 * Why do we need to do it that way? That's a good question.
 *
 * The in-page script cannot talk directly to the background script. This is
 * not our design, it's a limitation of how WebExtensions work which is
 * motivated by security. The content script is trustable because it's an
 * independent JavaScript context. This means the dApp cannot interfere with
 * what the content script does. E.g. If the dApp does any monkeypatching or
 * prototype pollution, the content script will not be affected.
 *
 * We do make use of this trusted context feature by setting the origin and
 * providerId here, so that the background script can safely decide which
 * information is appropriate for its responses using these fields.
 *
 * However, the browser could easily provide this kind of information securely
 * as part of an api that allows direct communication between the in-page script
 * and the background script. If that ever happens, we should most likely use
 * that and delete the content script entirely.
 *
 *      +----------------------------------------------------------+
 *      |                     Background Script                    |
 *      +----------------------------------------------------------+
 *              |                    |                    |
 *      +----------------+   +----------------+   +----------------+
 *      | Content Script |   | Content Script |   | Content Script |
 *      +----------------+   +----------------+   +----------------+
 *              |                    |                    |
 *      +----------------+   +----------------+   +----------------+
 *      |      dApp      |   |      dApp      |   |      dApp      |
 *      | In-Page Script |   | In-Page Script |   | In-Page Script |
 *      +----------------+   +----------------+   +----------------+
 */

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

(() => {
  if (
    window.document.doctype?.name !== 'html' ||
    window.location.pathname.endsWith('.pdf') ||
    document.documentElement.nodeName.toLowerCase() !== 'html'
  ) {
    return;
  }

  const providerId = createRandomId();

  addInPageScript();

  // TODO: Just use the port for both events and requests.
  relayRpcEvents(providerId);
  relayRpcRequests(providerId);
})();

function addInPageScript() {
  const container = document.head || document.documentElement;
  const pageContentScriptTag = document.createElement('script');
  pageContentScriptTag.src = runtime.getURL('js/pageContentScript.bundle.js');
  container.insertBefore(pageContentScriptTag, container.children[0]);
  // Can remove after script injection
  // TODO: But why? The script is there, so removing the tag is confusing. Is
  // there some advantage to doing this that makes up for that confusion?
  container.removeChild(pageContentScriptTag);
}

function relayRpcRequests(providerId: string) {
  window.addEventListener('message', async (evt) => {
    const data = {
      ...evt.data,
      providerId,
      origin: window.location.origin,
    };

    if (!isType(data, PublicRpcMessage)) {
      return;
    }

    // TODO: Respond from here with an error if our events port is disconnected.
    const result = await runtime.sendMessage(data);
    assertType(result, RpcResult);

    if ('error' in result) {
      const error = new Error(result.error.message);
      error.stack = result.error.stack;
      console.error(error);

      // Being extra careful about security here - error stacks should not
      // contain sensitive information, but they could. For this reason we log
      // the error here in the console but do not expose it to the dApp.
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
}

function relayRpcEvents(providerId: string) {
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
}
