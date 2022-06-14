import * as io from 'io-ts';
import {
  createEngineStream,
  createLoggerMiddleware,
  JRPCEngine,
  JRPCRequest,
  setupMultiplex,
  Substream,
} from '@toruslabs/openlogin-jrpc';
import pump from 'pump';
import type { Duplex } from 'readable-stream';

import { Runtime } from 'webextension-polyfill';
import { BigNumber } from 'ethers';
import { Aggregator } from 'bls-wallet-clients';
import {
  createRandomId,
  getAllReqParam,
  getDefaultProviderConfig,
  getUserLanguage,
} from './utils';
import { ProviderConfig } from './constants';
import NetworkController from './Network/NetworkController';
import CurrencyController from './Currency/CurrencyController';
import AccountTrackerController from './Account/AccountTrackerController';
import KeyringController from './Keyring/KeyringController';
import PreferencesController from './Preferences/PreferencesController';
import {
  defaultNetworkState,
  NetworkState,
  providerAsMiddleware,
  SafeEventEmitterProvider,
} from './Network/INetworkController';
import { SendTransactionParams } from './Network/createEthMiddleware';
import {
  AddressPreferences,
  defaultPreferencesState,
  PreferencesState,
} from './Preferences/IPreferencesController';
import { CurrencyControllerConfig } from './Currency/ICurrencyController';
import {
  AccountTrackerState,
  defaultAccountTrackerState,
} from './Account/IAccountTrackerController';
import {
  defaultKeyringControllerState,
  KeyringControllerState,
} from './Keyring/IKeyringController';
import PollingBlockTracker from './Block/PollingBlockTracker';
import { createOriginMiddleware } from './Network/createOriginMiddleware';
import createTabIdMiddleware from './rpcHelpers/TabIdMiddleware';
import { PROVIDER_NOTIFICATIONS } from '../common/constants';
import { AGGREGATOR_URL } from '../env';
import knownTransactions from './knownTransactions';
import CellCollection from '../cells/CellCollection';
import mapValues from '../helpers/mapValues';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, { rpcMap } from '../types/Rpc';
import assertType from '../cells/assertType';
import delay from '../helpers/delay';
import assert from '../helpers/assert';

export const DEFAULT_CONFIG = {
  CurrencyControllerConfig: {
    api: 'https://min-api.cryptocompare.com/data/price',
    pollInterval: 600_000,
  },
  NetworkControllerConfig: {
    providerConfig: getDefaultProviderConfig(),
  },
  PreferencesControllerConfig: {},
};

const PROVIDER = 'quill-provider';

export default class QuillController {
  public connections: Record<string, Record<string, { engine: JRPCEngine }>> =
    {};

  private _isClientOpen = false;

  private networkController!: NetworkController;

  private currencyController!: CurrencyController;

  private accountTracker!: AccountTrackerController;

  // TODO (merge-ok) Revert to private with better access pattern.
  public keyringController!: KeyringController;

  private preferencesController!: PreferencesController;

  // This is just kept in memory because it supports setting the preferred
  // aggregator for the particular tab only.
  private tabPreferredAggregators: Record<number, string> = {};

  getRequestAccountTabIds: () => Record<string, number>;
  getOpenQuillTabsIds: () => Record<number, boolean>;

  //   private txController!: TransactionController;

  constructor(
    public storage: CellCollection,
    public currencyControllerConfig: CurrencyControllerConfig,
  ) {}

  async getSelectedAddress(): Promise<string | undefined> {
    return (await this.preferencesController?.state.read()).selectedAddress;
  }

  async getSelectedPrivateKey(): Promise<string | undefined> {
    const address = await this.getSelectedAddress();
    if (!address) return undefined;
    const wallet = (await this.keyringController.state.read()).wallets.find(
      (x) => x.address === address,
    );
    return wallet?.privateKey;
  }

  async getUserBalance(): Promise<BigNumber | undefined> {
    const selectedAddress = await this.getSelectedAddress();

    if (selectedAddress === undefined) {
      return undefined;
    }

    // Balance is a hex string in wei
    const balance =
      (await this.accountTracker.state.read()).accounts[selectedAddress]
        ?.balance || '0x0';

    // FIXME: This doesn't make sense since it rounds to the nearest whole ETH.
    const value = BigNumber.from(balance).div(BigNumber.from(10 ** 18));

    return value;
  }

  async getLocale(): Promise<string | undefined> {
    const selectedAddress = await this.getSelectedAddress();

    if (selectedAddress === undefined) {
      return undefined;
    }

    const accountPreferences = await this.getAccountPreferences(
      selectedAddress,
    );

    return accountPreferences?.locale?.split('-')[0] || getUserLanguage();
  }

  get provider(): SafeEventEmitterProvider {
    return this.networkController._providerProxy;
  }

  get blockTracker(): PollingBlockTracker {
    return this.networkController._blockTrackerProxy;
  }

  async getAccounts(): Promise<string[]> {
    return (await this.keyringController.state.read()).wallets.map(
      (x) => x.address,
    );
  }

  /**
   * A method for recording whether the Quill user interface is open or not.
   */
  set isClientOpen(open: boolean) {
    this._isClientOpen = open;
    console.log(this._isClientOpen, 'set client open status');
  }

  /**
   * Always call init function before using this controller
   */
  public init({
    opts,
    storage,
  }: {
    opts: {
      getRequestAccountTabIds: () => Record<string, number>;
      getOpenQuillTabsIds: () => Record<number, boolean>;
    };
    storage: CellCollection;
  }): void {
    this.getRequestAccountTabIds = opts.getRequestAccountTabIds;
    this.getOpenQuillTabsIds = opts.getOpenQuillTabsIds;
    this.networkController = new NetworkController(
      storage.Cell(
        'network-controller-state',
        NetworkState,
        () => defaultNetworkState,
      ),
      storage.Cell('block-number', io.number, async () => {
        // FIXME: This is hacky. It should go away when we're finished cleaning
        // up.
        while (!this.networkController._blockTrackerProxy) {
          await delay(500);
        }

        const blockNumber = Number(
          await this.networkController._blockTrackerProxy.getLatestBlock(),
        );

        assert(Number.isFinite(blockNumber));
        return blockNumber;
      }),
    );
    this.initializeProvider();
    this.currencyController = new CurrencyController(
      this.currencyControllerConfig,
      this.storage,
    );
    this.currencyController.updateConversionRate();
    this.currencyController.scheduleConversionInterval();

    // key management
    this.keyringController = new KeyringController(
      storage.Cell(
        'keyring-controller-state',
        KeyringControllerState,
        () => defaultKeyringControllerState,
      ),
    );

    const preferences = storage.Cell(
      'preferences-controller-state',
      PreferencesState,
      () => defaultPreferencesState,
    );

    this.preferencesController = new PreferencesController(preferences);

    this.accountTracker = new AccountTrackerController({
      provider: this.networkController._providerProxy,
      state: storage.Cell(
        'account-tracker-state',
        AccountTrackerState,
        () => defaultAccountTrackerState,
      ),
      blockNumber: this.networkController.blockNumber,
      getIdentities: async () =>
        (await this.preferencesController.state.read()).identities,
      getCurrentChainId: () => this.networkController.chainId.read(),
      preferences,
    });
    // ensure accountTracker updates balances after network change

    (async () => {
      for await (const chainId of this.networkController.chainId) {
        this.accountTracker.refresh();
        this.notifyAllConnections({
          method: PROVIDER_NOTIFICATIONS.CHAIN_CHANGED,
          params: { chainId },
        });
      }
    })();

    // this.txController = new TransactionController({
    //   config: this.config.TransactionControllerConfig,
    //   state: this.state.TransactionControllerState,
    //   blockTracker: this.networkController._blockTrackerProxy,
    //   provider: this.networkController._providerProxy,
    //   getCurrentChainId: this.networkController.getNetworkIdentifier.bind(
    //     this.networkController,
    //   ),
    //   signTransaction: this.keyringController.signTransaction.bind(
    //     this.keyringController,
    //   ),
    // });

    // this.txController.on(TX_EVENTS.TX_UNAPPROVED, (txMeta) => {
    //   this.emit(TX_EVENTS.TX_UNAPPROVED, txMeta);
    // });

    this.networkController.lookupNetwork();

    // ensure isClientOpenAndUnlocked is updated when memState updates
    // this.subscribeEvent("update", (QuillControllerState: unknown) => this._onStateUpdate(QuillControllerState));

    // this.subscribe(this.sendUpdate.bind(this));

    // if (typeof options.rehydrate === "function") {
    //   setTimeout(() => {
    //     options.rehydrate();
    //   }, 50);
    // }
    // this.sendUpdate = debounce(this.privateSendUpdate.bind(this), 200);
  }

  getApi(): Record<string, (...args: any[]) => Promise<unknown> | unknown> {
    const {
      currencyController,
      // keyringController,
      networkController,
      preferencesController,
      // accountTracker,
    } = this;

    return {
      // etc
      setCurrentCurrency: (currentCurrency) =>
        currencyController.update({ currentCurrency }),
      setCurrentLocale: preferencesController.setUserLocale.bind(
        preferencesController,
      ),

      getRequestAccountTabIds: this.getRequestAccountTabIds,
      getOpenQuillTabsIds: this.getOpenQuillTabsIds,

      // network management
      setProviderConfig: (providerConfig) =>
        networkController.update({ providerConfig }),

      // PreferencesController
      setSelectedAddress: preferencesController.setSelectedAddress.bind(
        preferencesController,
      ),
    };
  }

  async changeProvider<T>(req: JRPCRequest<T>): Promise<boolean> {
    // TODO: show popup to user and ask for confirmation
    // const { approve = false } = result;
    // if (approve) {
    this.networkController.update({
      providerConfig: req.params as unknown as ProviderConfig,
    });
    return true;
    // }
    // throw new Error('user denied provider change request');
  }

  getAccountPreferences(
    address: string,
  ): Promise<AddressPreferences | undefined> {
    return this.preferencesController?.getAddressState(address);
  }

  async getProviderConfig(): Promise<ProviderConfig> {
    return (await this.networkController.state.read()).providerConfig;
  }

  async addAccount(privKey: string): Promise<string> {
    const address = await this.keyringController.importAccount(privKey);
    const locale = getUserLanguage();
    this.preferencesController.createUser({
      address,
      locale,
      selectedCurrency: 'USD',
      theme: 'light',
    });
    return address;
  }

  setSelectedAccount(address: string): void {
    this.preferencesController.setSelectedAddress(address);
    this.notifyAllConnections({
      method: PROVIDER_NOTIFICATIONS.ACCOUNTS_CHANGED,
      params: [address],
    });
  }

  async setDefaultCurrency(currency: string): Promise<void> {
    const { ticker } = (await this.networkController.state.read())
      .providerConfig;
    // This is ETH
    this.currencyController.update({ nativeCurrency: ticker });
    // This is USD
    this.currencyController.update({ currentCurrency: currency });
    await this.currencyController.updateConversionRate();
    this.preferencesController.setSelectedCurrency(currency);
  }

  setNetwork(providerConfig: ProviderConfig): void {
    this.networkController.update({ providerConfig });
  }

  /**
   * Used to create a multiplexed stream for connecting to an untrusted context
   * like a Dapp or other extension.
   */
  setupUnTrustedCommunication(
    connectionStream: Duplex,
    sender: Runtime.MessageSender | undefined,
  ): void {
    // connect features && for test cases
    const quillMux = setupMultiplex(connectionStream);
    // We create the mux so that we can handle phishing stream here
    const providerStream = quillMux.getStream(PROVIDER);
    this.setupProviderConnection(providerStream as Substream, sender, false);
  }

  /**
   * A method for serving our ethereum provider over a given stream.
   */
  setupProviderConnection(
    outStream: Substream,
    sender?: Runtime.MessageSender,
    isInternal = true,
  ) {
    let origin = '';
    if (isInternal) {
      origin = 'quill';
    } else {
      const senderUrl = sender?.url;
      if (!senderUrl) throw new Error('Need a valid origin to connect to');
      origin = new URL(senderUrl).origin;
    }

    let tabId;
    if (sender?.tab?.id) {
      tabId = sender.tab.id;
    }

    const engine = this.setupProviderEngine({
      origin,
      tabId,
    });

    // setup connection
    const providerStream = createEngineStream({ engine });

    const connectionId = this.addConnection(origin, { engine });

    pump(outStream, providerStream, outStream, (err) => {
      // handle any middleware cleanup
      if (connectionId) this.removeConnection(origin, connectionId);
      if (err) {
        console.error(err);
      }
    });
  }

  setupProviderEngine({
    origin,
    tabId,
  }: {
    origin: string;
    tabId?: number;
  }): JRPCEngine {
    // setup json rpc engine stack
    const engine = new JRPCEngine();
    const { provider } = this;
    console.log('setting up provider engine', origin, provider);

    // create filter polyfill middleware
    // const filterMiddleware = createFilterMiddleware({ provider, blockTracker });

    // create subscription polyfill middleware
    // const subscriptionManager = createSubscriptionManager({
    //   provider,
    //   blockTracker,
    // });
    // subscriptionManager.events.on('notification', (message) =>
    //   engine.emit('notification', message),
    // );

    // append origin to each request
    engine.push(createOriginMiddleware({ origin }));
    // append tabId to each request if it exists
    if (tabId) {
      engine.push(createTabIdMiddleware({ tabId }));
    }
    // logging
    engine.push(createLoggerMiddleware(console));

    // forward to Quill primary provider
    engine.push(providerAsMiddleware(provider));
    return engine;
  }

  private initializeProvider() {
    this.networkController.initializeProvider({
      // account management
      eth_requestAccounts: async (req) => {
        const accounts = await this.requestAccounts();
        this.notifyConnections((req as any).origin, {
          method: PROVIDER_NOTIFICATIONS.UNLOCK_STATE_CHANGED,
          params: {
            accounts,
            isUnlocked: accounts.length > 0,
          },
        });
        return accounts;
      },

      eth_coinbase: async () => (await this.getSelectedAddress()) || null,

      wallet_get_provider_state: async () => {
        const selectedAddress = await this.getSelectedAddress();

        return {
          accounts: selectedAddress ? [selectedAddress] : [],
          chainId: (await this.networkController.state.read()).chainId,
          isUnlocked: !!selectedAddress,
        };
      },

      eth_setPreferredAggregator: async (req: any) => {
        // eslint-disable-next-line prefer-destructuring
        this.tabPreferredAggregators[req.tabId] = req.params[0];

        return 'ok';
      },

      eth_sendTransaction: async (req: any) => {
        const txParams = getAllReqParam<SendTransactionParams[]>(req);
        const { from } = txParams[0];

        const actions = txParams.map((tx) => {
          return {
            ethValue: tx.value || '0',
            contractAddress: tx.to,
            encodedFunction: tx.data,
          };
        });

        const nonce = await this.keyringController.getNonce(from);
        const tx = {
          nonce: nonce.toString(),
          actions,
        };

        const bundle = await this.keyringController.signTransactions(from, tx);
        const aggregatorUrl =
          this.tabPreferredAggregators[req.tabId] ?? AGGREGATOR_URL;
        const agg = new Aggregator(aggregatorUrl);
        const result = await agg.add(bundle);

        if ('failures' in result) {
          throw new Error(JSON.stringify(result.failures));
        }

        knownTransactions[result.hash] = {
          ...txParams[0],
          nonce: nonce.toString(),
          value: txParams[0].value || '0',
          aggregatorUrl,
        };

        return result.hash;
      },

      ...this.makePublicRpc(),
      ...this.makePrivateRpc(),
    });
  }

  private makePublicRpc(): Record<string, unknown> {
    type MethodsWithOrigin = {
      [M in keyof Rpc['public']]: (
        origin: string,
        params: Parameters<Rpc['public'][M]>,
      ) => ReturnType<Rpc['public'][M]>;
    };

    const methods: MethodsWithOrigin = {
      eth_accounts: async (origin) => {
        if (origin === window.location.origin) {
          return (await this.keyringController.state.read()).wallets.map(
            ({ address }) => address,
          );
        }

        const selectedAddress = await this.getSelectedAddress();

        // TODO (merge-ok) Expose no accounts if this origin has not been approved,
        // preventing account-requiring RPC methods from completing successfully
        // only show address if account is unlocked
        // https://github.com/web3well/bls-wallet/issues/224
        return selectedAddress ? [selectedAddress] : [];
      },
    };

    return mapValues(methods, (method, methodName) => (req: any) => {
      const params = req.params ?? [];
      assertType(params, rpcMap.public[methodName].params);
      return (method as ExplicitAny)(req.origin, params);
    });
  }

  private makePrivateRpc(): Record<string, unknown> {
    const methods: Rpc['private'] = {
      quill_setSelectedAddress: async (newSelectedAddress) => {
        this.preferencesController.setSelectedAddress(newSelectedAddress);
        return 'ok';
      },

      quill_createHDAccount: async () => {
        return this.keyringController.createHDAccount();
      },

      quill_isOnboardingComplete: async () => {
        return this.keyringController.isOnboardingComplete();
      },

      quill_setHDPhrase: async (phrase) => {
        this.keyringController.setHDPhrase(phrase);
        return 'ok';
      },
    };

    return mapValues(methods, (method, methodName) => (req: any) => {
      if (req.origin !== window.location.origin) {
        return;
      }

      const params = req.params ?? [];

      assertType(
        params,
        rpcMap.private[methodName].params as unknown as io.Type<unknown[]>,
      );

      return (method as ExplicitAny)(...params);
    });
  }

  private async requestAccounts(): Promise<string[]> {
    const selectedAddress = await this.getSelectedAddress();

    // If we have a selected address, return it
    // TODO: Add support for permissions controller
    if (selectedAddress) {
      return [selectedAddress];
    }
    return [];
  }

  /**
   * Adds a reference to a connection by origin. Ignores the 'quill' origin.
   * Caller must ensure that the returned id is stored such that the reference
   * can be deleted later.
   */
  addConnection(
    origin: string,
    { engine }: { engine: JRPCEngine },
  ): string | null {
    if (origin === 'quill') {
      return null;
    }

    if (!this.connections[origin]) {
      this.connections[origin] = {};
    }

    const id = createRandomId();
    this.connections[origin][id] = {
      engine,
    };

    return id;
  }

  /**
   * Deletes a reference to a connection, by origin and id.
   * Ignores unknown origins.
   */
  removeConnection(origin: string, id: string) {
    const connections = this.connections[origin];
    if (!connections) {
      return;
    }

    delete connections[id];

    if (Object.keys(connections).length === 0) {
      delete this.connections[origin];
    }
  }

  /**
   * Causes the RPC engines associated with the connections to the given origin
   * to emit a notification event with the given payload.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   * Ignores unknown origins.
   */
  notifyConnections(origin: string, payload: unknown) {
    const connections = this.connections[origin];

    if (connections) {
      Object.values(connections).forEach((conn) => {
        if (conn.engine) {
          conn.engine.emit('notification', payload);
        }
      });
    }
  }

  /**
   * Causes the RPC engines associated with all connections to emit a
   * notification event with the given payload.
   *
   * If the "payload" parameter is a function, the payload for each connection
   * will be the return value of that function called with the connection's
   * origin.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   */
  notifyAllConnections(payload: unknown) {
    const getPayload =
      typeof payload === 'function'
        ? (origin: string) => payload(origin)
        : () => payload;

    Object.keys(this.connections).forEach((origin) => {
      Object.values(this.connections[origin]).forEach(async (conn) => {
        if (conn.engine) {
          conn.engine.emit('notification', await getPayload(origin));
        }
      });
    });
  }
}
