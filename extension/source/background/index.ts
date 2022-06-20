import { runtime, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';

// On first install, open a new tab with Quill
runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    tabs.create({ url: runtime.getURL('quillPage.html#/wallet') });
  }
});

const quillController = new QuillController(
  extensionLocalCellCollection,
  // FIXME: MEGAFIX: Hard coding is not configuration.
  {
    api: 'https://min-api.cryptocompare.com/data/price',
    pollInterval: 600_000,
  },
);

runtime.onMessage.addListener((message, _sender) => {
  const response = quillController.handleMessage(message);

  if (response !== undefined) {
    // TODO: MEGAFIX: Better logging (configuration etc)
    console.log({ message, response });
  }

  return response;
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
