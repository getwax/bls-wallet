/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @file The entry point for the web extension singleton process.
 */

import endOfStream from 'end-of-stream';
import pump from 'pump';

import { storage, runtime, Runtime, Tabs, tabs } from 'webextension-polyfill';
import { cloneDeep } from 'lodash-es';
// import NotificationManager, {
//   NOTIFICATION_MANAGER_EVENTS,
// } from './lib/notification-manager';
import QuillController, {
  DEFAULT_CONFIG,
  QuillControllerState,
} from './QuillController';
import { DEFAULT_STATE, ENVIRONMENT_TYPE } from './constants';
import { getDefaultProviderConfig } from './utils';
import ControllerStoreStream from './streamHelpers/ControllerStoreStream';
import ControllerStreamSink from './streamHelpers/ControllerStreamSink';
import PortDuplexStream from '../common/PortStream';

window.QuillController = () => {
  throw new Error('window.QuillController not initialized');
};
window.KeyringController = () => {
  throw new Error('window.KeyringController not initialized');
};

// const notificationManager = new NotificationManager();

let popupIsOpen = false;
let notificationIsOpen = false;
let uiIsTriggering = false;
const openQuillTabsIDs: Record<number, boolean> = {};
const requestAccountTabIds: Record<string, number> = {};

// state persistence
const localStore = storage.local;
let versionedData: any;

// initialization flow
initialize().catch(console.error);

/**
 * Initializes the Quill controller, and sets up all platform configuration.
 */
async function initialize(): Promise<void> {
  const initState = await loadStateFromPersistence();
  setupController(initState);
  console.log('Quill initialization complete.');
}

//
// State and Persistence
//

/**
 * Loads any stored data or the default state
 */
async function loadStateFromPersistence(): Promise<QuillControllerState> {
  // read from disk
  // first from preferred, async API:
  const storedData = await localStore.get();
  console.log('storedData', storedData);

  if (Object.keys(storedData).length > 0) {
    versionedData = storedData;
  } else {
    const providerConfig = getDefaultProviderConfig();
    versionedData = cloneDeep({
      ...DEFAULT_STATE,
      // Override with default config from env chainid
      NetworkControllerState: {
        ...DEFAULT_STATE.NetworkControllerState,
        chainId: providerConfig.chainId,
        providerConfig,
      },
    });
  }

  localStore.set(versionedData);
  // return just the data
  return versionedData;
}

/**
 * Initializes the MetaMask Controller with any initial state and default language.
 * Configures platform-specific error reporting strategy.
 * Streams emitted state updates to platform-specific storage strategy.
 * Creates platform listeners for new Dapps/Contexts, and sets up their data connections to the controller.
 */
function setupController(initState: unknown): void {
  //
  // MetaMask Controller
  //
  console.log(initState, 'initstate');

  const controller = new QuillController({
    // initial state
    state: initState as QuillControllerState,
    config: DEFAULT_CONFIG,
  });

  controller.init({
    state: initState as QuillControllerState,
    config: DEFAULT_CONFIG,
    opts: {
      getRequestAccountTabIds: () => requestAccountTabIds,
      getOpenQuillTabsIds: () => openQuillTabsIDs,
    },
  });

  window.QuillController = () => controller;
  window.KeyringController = () => controller.keyringController;

  // setup state persistence
  pump(
    new ControllerStoreStream(controller),
    // debounce(1000),
    new ControllerStreamSink(persistData),
    (error) => {
      console.error('MetaMask - Persistence pipeline failed', error);
    },
  );

  let dataPersistenceFailing = false;

  async function persistData(state: unknown) {
    if (!state) {
      throw new Error('Quill - updated state is missing');
    }
    if (localStore?.set) {
      try {
        await localStore.set(state as Record<string, unknown>);
        if (dataPersistenceFailing) {
          dataPersistenceFailing = false;
        }
      } catch (err) {
        // log error so we dont break the pipeline
        if (!dataPersistenceFailing) {
          dataPersistenceFailing = true;
        }
        console.error('error setting state in local store:', err);
      }
    }
  }

  //
  // connect to other contexts
  //
  runtime.onConnect.addListener(connectRemote);
  runtime.onConnectExternal.addListener(connectExternal);

  const quillInternalProcessHash: Record<string, boolean> = {
    [ENVIRONMENT_TYPE.POPUP]: true,
    [ENVIRONMENT_TYPE.NOTIFICATION]: true,
    [ENVIRONMENT_TYPE.FULLSCREEN]: true,
  };

  const isClientOpenStatus = () => {
    return (
      popupIsOpen ||
      Boolean(Object.keys(openQuillTabsIDs).length) ||
      notificationIsOpen
    );
  };

  const onCloseEnvironmentInstances = (
    isClientOpen: boolean,
    environmentType: string,
  ) => {
    // if all instances of quill are closed we call a method on the controller to stop gasFeeController polling
    if (isClientOpen === false) {
      // TODO: handle this on controller after adding tx controller
      // controller.onClientClosed();
      // otherwise we want to only remove the polling tokens for the environment type that has closed
    } else {
      // in the case of fullscreen environment a user might have multiple tabs open so we don't want to disconnect all of
      // its corresponding polling tokens unless all tabs are closed.
      if (
        environmentType === ENVIRONMENT_TYPE.FULLSCREEN &&
        Boolean(Object.keys(openQuillTabsIDs).length)
      ) {
        return;
      }
      // TODO: handle this on controller after adding tx controller
      console.log('do something');
      // controller.onEnvironmentTypeClosed(environmentType);
    }
  };

  /**
   * Connects a Port to the MetaMask controller via a multiplexed duplex stream.
   * This method identifies trusted (MetaMask) interfaces, and connects them differently from untrusted (web pages).
   *
   * @param {Port} remotePort - The port provided by a new context.
   */
  function connectRemote(remotePort: Runtime.Port) {
    const processName = remotePort.name;
    const isMetaMaskInternalProcess = quillInternalProcessHash[processName];

    if (isMetaMaskInternalProcess) {
      const portStream = new PortDuplexStream(remotePort);
      // communication with popup
      controller.isClientOpen = true;
      controller.setupTrustedCommunication(portStream, remotePort.sender);

      if (processName === ENVIRONMENT_TYPE.POPUP) {
        popupIsOpen = true;
        endOfStream(portStream, () => {
          popupIsOpen = false;
          const isClientOpen = isClientOpenStatus();
          controller.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(isClientOpen, ENVIRONMENT_TYPE.POPUP);
        });
      }

      if (processName === ENVIRONMENT_TYPE.NOTIFICATION) {
        notificationIsOpen = true;

        endOfStream(portStream, () => {
          notificationIsOpen = false;
          const isClientOpen = isClientOpenStatus();
          controller.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(
            isClientOpen,
            ENVIRONMENT_TYPE.NOTIFICATION,
          );
        });
      }

      if (processName === ENVIRONMENT_TYPE.FULLSCREEN) {
        const tabId = remotePort.sender?.tab?.id;
        if (!tabId) return;
        openQuillTabsIDs[tabId] = true;

        endOfStream(portStream, () => {
          delete openQuillTabsIDs[tabId];
          const isClientOpen = isClientOpenStatus();
          controller.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(
            isClientOpen,
            ENVIRONMENT_TYPE.FULLSCREEN,
          );
        });
      }
    } else {
      if (remotePort.sender && remotePort.sender.tab && remotePort.sender.url) {
        const tabId = remotePort.sender.tab.id;
        const url = new URL(remotePort.sender.url);
        const { origin } = url;
        console.log('logging request 1', requestAccountTabIds);

        if (!tabId) return;
        remotePort.onMessage.addListener((msg) => {
          console.log('logging request 2', requestAccountTabIds);

          if (msg.data && msg.data.method === 'eth_requestAccounts') {
            requestAccountTabIds[origin] = tabId;
            console.log('logging request 3', requestAccountTabIds);
          }
        });
      }
      connectExternal(remotePort);
    }
  }

  // communication with page or other extension
  function connectExternal(remotePort: Runtime.Port) {
    const portStream = new PortDuplexStream(remotePort);
    controller.setupUnTrustedCommunication(portStream, remotePort.sender);
  }

  //
  // User Interface setup
  //

  // notificationManager.on(
  //   NOTIFICATION_MANAGER_EVENTS.POPUP_CLOSED,
  //   ({ automaticallyClosed }: { automaticallyClosed: boolean }) => {
  //     if (!automaticallyClosed) {
  //       rejectUnapprovedNotifications();
  //     } else if (getUnapprovedTransactionCount() > 0) {
  //       triggerUi();
  //     }
  //   },
  // );

  function rejectUnapprovedNotifications() {
    // Object.keys(
    //   controller.txController.txStateManager.getUnapprovedTxList(),
    // ).forEach((txId) =>
    //   controller.txController.txStateManager.setTxStatusRejected(txId),
    // );
    // controller.messageManager.messages
    //   .filter((msg) => msg.status === 'unapproved')
    //   .forEach((tx) =>
    //     controller.messageManager.rejectMsg(
    //       tx.id,
    //       REJECT_NOTFICIATION_CLOSE_SIG,
    //     ),
    //   );
    // controller.personalMessageManager.messages
    //   .filter((msg) => msg.status === 'unapproved')
    //   .forEach((tx) =>
    //     controller.personalMessageManager.rejectMsg(
    //       tx.id,
    //       REJECT_NOTFICIATION_CLOSE_SIG,
    //     ),
    //   );
    // controller.typedMessageManager.messages
    //   .filter((msg) => msg.status === 'unapproved')
    //   .forEach((tx) =>
    //     controller.typedMessageManager.rejectMsg(
    //       tx.id,
    //       REJECT_NOTFICIATION_CLOSE_SIG,
    //     ),
    //   );
    // controller.decryptMessageManager.messages
    //   .filter((msg) => msg.status === 'unapproved')
    //   .forEach((tx) =>
    //     controller.decryptMessageManager.rejectMsg(
    //       tx.id,
    //       REJECT_NOTFICIATION_CLOSE,
    //     ),
    //   );
    // controller.encryptionPublicKeyManager.messages
    //   .filter((msg) => msg.status === 'unapproved')
    //   .forEach((tx) =>
    //     controller.encryptionPublicKeyManager.rejectMsg(
    //       tx.id,
    //       REJECT_NOTFICIATION_CLOSE,
    //     ),
    //   );
    // Finally, reject all approvals managed by the ApprovalController
    // controller.approvalController.clear(
    //   ethErrors.provider.userRejectedRequest(),
    // );
    // updateBadge();
  }

  rejectUnapprovedNotifications();

  // return Promise.resolve();
}

//
// Etc...
//

/**
 * Opens the browser popup for user confirmation
 */
async function triggerUi() {
  const activeTabs = await tabs.query({ active: true });
  const currentlyActiveQuillTab = Boolean(
    activeTabs.find((tab: Tabs.Tab) => tab.id && openQuillTabsIDs[tab.id]),
  );
  // Vivaldi is not closing port connection on popup close, so popupIsOpen does not work correctly
  // To be reviewed in the future if this behaviour is fixed - also the way we determine isVivaldi variable might change at some point
  const isVivaldi =
    activeTabs.length > 0 &&
    (activeTabs[0] as any).extData?.indexOf('vivaldi_tab') > -1;
  if (
    !uiIsTriggering &&
    (isVivaldi || !popupIsOpen) &&
    !currentlyActiveQuillTab
  ) {
    uiIsTriggering = true;
    try {
      // await notificationManager.showPopup();
    } finally {
      uiIsTriggering = false;
    }
  }
}

/**
 * Opens the browser popup for user confirmation of watchAsset
 * then it waits until user interact with the UI
 */
async function openPopup() {
  await triggerUi();
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (!notificationIsOpen) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

// TODO: remove this later
if (process.env.NODE_ENV === 'random') openPopup();

// On first install, open a new tab with MetaMask
runtime.onInstalled.addListener(({ reason }) => {
  if (
    reason === 'install' &&
    !(process.env.METAMASK_DEBUG || process.env.IN_TEST)
  ) {
    openExtensionInBrowser();
  }
});

function openExtensionInBrowser(route = null, queryString = null) {
  let extensionURL = runtime.getURL('home.html');

  if (route) {
    extensionURL += `#${route}`;
  }

  if (queryString) {
    extensionURL += `?${queryString}`;
  }

  tabs.create({ url: extensionURL });
}
