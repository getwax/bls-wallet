import { runtime, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';

// initialization flow
initialize().catch(console.error);

/**
 * Initializes the Quill controller, and sets up all platform configuration.
 */
async function initialize(): Promise<void> {
  setupController();
  console.log('Quill initialization complete.');
}

/**
 * Initializes the Quill Controller with any initial state and default language.
 * Configures platform-specific error reporting strategy.
 * Streams emitted state updates to platform-specific storage strategy.
 * Creates platform listeners for new Dapps/Contexts, and sets up their data connections to the controller.
 */
function setupController(): void {
  const quillController = new QuillController(extensionLocalCellCollection, {
    api: 'https://min-api.cryptocompare.com/data/price',
    pollInterval: 600_000,
  });

  runtime.onMessage.addListener((message, _sender) => {
    const response = quillController.handleMessage(message);

    if (response !== undefined) {
      // TODO: Better logging (configuration etc)
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
}

// On first install, open a new tab with Quill
runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    tabs.create({ url: runtime.getURL('quillPage.html#/wallet') });
  }
});
