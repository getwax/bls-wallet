import * as io from 'io-ts';
import { providers } from 'ethers';
import { JRPCEngine, JRPCMiddleware } from '@toruslabs/openlogin-jrpc';
import { Mutex } from 'async-mutex';
import EthQuery from '../rpcHelpers/EthQuery';

import { ProviderConfig } from '../constants';
import createSwappableProxy from '../createSwappableProxy';
import {
  createWalletMiddleware,
  IProviderHandlers,
} from './createEthMiddleware';
import { createJsonRpcClient } from './createJsonRpcClient';
import {
  INetworkController,
  NetworkState,
  providerFromEngine,
  SafeEventEmitterProvider,
} from './INetworkController';
import ICell, { IReadableCell } from '../../cells/ICell';
import { FormulaCell } from '../../cells/FormulaCell';
import approximate from '../../cells/approximate';
import { createRandomId } from '../utils';
import assertType from '../../cells/assertType';
import assert from '../../helpers/assert';

// use state_get_balance for account balance

export default class NetworkController implements INetworkController {
  name = 'NetworkController';

  _providerProxy!: SafeEventEmitterProvider;

  private mutex = new Mutex();

  private _provider: SafeEventEmitterProvider | null = null;

  /**
   * Initialized before our provider is created.
   */
  private ethQuery!: EthQuery;

  private _baseProviderHandlers!: IProviderHandlers;

  public chainId: IReadableCell<string>;
  public blockNumber: IReadableCell<number>;

  constructor(
    public state: ICell<NetworkState>,
    time: IReadableCell<number>,
    ethereumMethods: IProviderHandlers,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    this.chainId = new FormulaCell({ state }, ({ state }) => state.chainId);

    this.blockNumber = new FormulaCell(
      {
        networkState: state,
        time: approximate(time, 20_000),
      },
      () => this.fetchBlockNumber(),
    );

    this.initializeProvider(ethereumMethods);

    // when a new network is set, we set to loading first and then when connection succeeds, we update the network
  }

  async getNetworkIdentifier(): Promise<string> {
    return (await this.state.read()).chainId;
  }

  async update(stateUpdates: Partial<NetworkState>) {
    await this.state.write({ ...(await this.state.read()), ...stateUpdates });

    if ('providerConfig' in stateUpdates) {
      this.refreshNetwork();
    }
  }

  /**
   * Called by orchestrator once while initializing the class
   * @param providerHandlers - JRPC handlers for provider
   * @returns - provider - Returns the providerProxy
   */
  public initializeProvider(
    providerHandlers: IProviderHandlers,
  ): SafeEventEmitterProvider {
    this._baseProviderHandlers = providerHandlers;
    this.configureProvider();
    this.lookupNetwork(); // Not awaiting this, because we don't want to block the initialization
    return this._providerProxy;
  }

  getProvider(): SafeEventEmitterProvider {
    return this._providerProxy;
  }

  async getProviderConfig(): Promise<ProviderConfig> {
    return (await this.state.read()).providerConfig;
  }

  /**
   * Refreshes the current network code
   */
  async lookupNetwork(): Promise<void> {
    const { rpcTarget, chainId } = await this.getProviderConfig();
    if (!chainId || !rpcTarget || !this._provider) {
      await this.update({
        chainId: 'loading',
        properties: { EIPS: { 1559: undefined } },
      });
      return;
    }
    const query = this.ethQuery;
    if (!query) {
      return;
    }
    const releaseLock = await this.mutex.acquire();
    return new Promise((resolve, reject) => {
      // info_get_status
      query.sendAsync(
        { method: 'net_version' },
        (error: Error, network: unknown) => {
          releaseLock();
          if (error) {
            this.update({
              chainId: 'loading',
              properties: {
                EIPS: { 1559: undefined },
              },
            });
            reject(error);
          }

          this.update({
            // Network is returned as a string (base 10)
            chainId: `0x${Number.parseInt(network as string, 16).toString()}`,
          });
          // Don't need to wait for this
          this.getEIP1559Compatibility();
          resolve();
        },
      );
    });
  }

  async getEIP1559Compatibility(): Promise<boolean> {
    const { EIPS } = (await this.state.read()).properties;
    // log.info('checking eip 1559 compatibility', EIPS[1559])
    if (EIPS[1559] !== undefined) {
      return EIPS[1559];
    }
    const latestBlock = await this.ethQuery.request<providers.Block>({
      method: 'eth_getBlockByNumber',
      params: ['latest', false],
    });
    const supportsEIP1559 =
      latestBlock && latestBlock.baseFeePerGas !== undefined;
    this.update({
      properties: {
        EIPS: { 1559: supportsEIP1559 },
      },
    });
    return supportsEIP1559;
  }

  private async configureProvider() {
    const { chainId, rpcTarget, ...rest } = await this.getProviderConfig();
    if (!chainId || !rpcTarget) {
      throw new Error(
        'chainId and rpcTarget must be provider in providerConfig',
      );
    }
    this.configureStandardProvider({ chainId, rpcTarget, ...rest });
  }

  private configureStandardProvider(providerConfig: ProviderConfig) {
    const networkClient = createJsonRpcClient(providerConfig);
    this.setNetworkClient(networkClient);
  }

  private setNetworkClient({
    networkMiddleware,
  }: {
    networkMiddleware: JRPCMiddleware<unknown, unknown>;
  }) {
    const walletMiddleware = createWalletMiddleware(this._baseProviderHandlers);
    const engine = new JRPCEngine();
    engine.push(walletMiddleware);
    engine.push(networkMiddleware);
    const provider = providerFromEngine(engine);
    this.setProvider({ provider });
  }

  private setProvider({ provider }: { provider: SafeEventEmitterProvider }) {
    if (this._providerProxy) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this._providerProxy.setTarget(provider);
    } else {
      this._providerProxy =
        createSwappableProxy<SafeEventEmitterProvider>(provider);
    }

    // set new provider and blockTracker
    this._provider = provider;
    provider.setMaxListeners(10);
    this.ethQuery = new EthQuery(provider);
  }

  private refreshNetwork() {
    this.update({
      chainId: 'loading',
      properties: { EIPS: { 1559: undefined } },
    });
    this.configureProvider();
    this.lookupNetwork();
  }

  private async fetchBlockNumber() {
    const res = await this._providerProxy.request({
      method: 'eth_blockNumber',
      jsonrpc: '2.0',
      id: createRandomId(),
      params: [],
    });
    assertType(res, io.string);
    const resNumber = Number(res);
    assert(Number.isFinite(resNumber));
    return resNumber;
  }
}
