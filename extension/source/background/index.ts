import { runtime, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';
import { RpcMessage, toRpcResult } from '../types/Rpc';
import toOkError from '../helpers/toOkError';
import assertType from '../cells/assertType';
import forEach from '../cells/forEach';

const quillController = new QuillController(
  extensionLocalCellCollection,
  // FIXME: MEGAFIX (deferred): Hard coding is not configuration.
  {
    api: 'https://min-api.cryptocompare.com/data/price',

    // Note: We can afford to poll relatively frequently because we only fetch
    // currency information when we actually need it, via the magic of cells.
    // (TODO: MEGAFIX: test)
    pollInterval: 30_000,
  },
);

// On install, open a new tab with Quill
quillController.cells.onboarding.read().then(async (onboarding) => {
  if (!onboarding.autoOpened) {
    await quillController.cells.onboarding.update({ autoOpened: true });
    tabs.create({ url: runtime.getURL('home.html') });
  }
});

let shouldLog = true;

forEach(quillController.cells.developerSettings, (developerSettings) => {
  shouldLog = developerSettings.rpcLogging.background;
});

runtime.onMessage.addListener((message, _sender) => {
  const response = quillController.handleMessage(message);

  if (response === undefined) {
    return undefined;
  }

  // FIXME: MEGAFIX: Duplication with rtti checking inside QuillController
  assertType(message, RpcMessage);

  if (shouldLog) {
    const host =
      message.origin === window.location.origin
        ? '<quill>'
        : new URL(message.origin).host;

    console.log(
      `${host}:${message.providerId.slice(0, 5)}:`,
      `${message.method}(${message.params
        .map((p) => JSON.stringify(p))
        .join(', ')}) ->`,
      response,
    );
  }

  return toOkError(() => response).then(toRpcResult);
});

runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('quill-provider-')) {
    return;
  }

  console.log('Connected:', port.name);

  port.onDisconnect.addListener(() => {
    console.log('Disconnected:', port.name, port.error);
  });
});

// TODO: The old system that has been deleted had signs of useful ideas that
// are not implemented in the new system.
//
// They mostly weren't implemented in the old system either, more like stubs
// that were suggestive of what we should finish implementing. However, those
// stubs assumed the old system, so it's not appropriate to keep them.
//
// Instead, here's a curated list of those ideas and references to the history
// so anyone can easily still find them in the future.
//
// Close associated popups when page is closed
// https://github.com/web3well/bls-wallet/blob/e671e73/extension/source/Controllers/background.ts#L210
//
// onConnectExternal / support for comms with other extensions
// https://github.com/web3well/bls-wallet/blob/main/extension/source/Controllers/background.ts#L270
//
// Getting metadata about networks:
// https://github.com/web3well/bls-wallet/blob/d2b18f3/extension/source/Controllers/Network/NetworkController.ts#L110-L171
