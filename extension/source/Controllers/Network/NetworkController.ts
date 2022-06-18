import * as io from 'io-ts';
import { providers } from 'ethers';
import { JRPCEngine, JRPCMiddleware } from '@toruslabs/openlogin-jrpc';
import { Mutex } from 'async-mutex';
import EthQuery from '../rpcHelpers/EthQuery';

import { ProviderConfig } from '../constants';
import { createWalletMiddleware } from './createEthMiddleware';
import { createJsonRpcClient } from './createJsonRpcClient';
import {
  INetworkController,
  providerFromEngine,
  SafeEventEmitterProvider,
} from './INetworkController';
import { IReadableCell } from '../../cells/ICell';
import { FormulaCell } from '../../cells/FormulaCell';
import approximate from '../../cells/approximate';
import { createRandomId } from '../utils';
import assertType from '../../cells/assertType';
import assert from '../../helpers/assert';
import QuillCells from '../../QuillCells';
import MemoryCell from '../../cells/MemoryCell';

// use state_get_balance for account balance

type RpcMessage = {
  method: string;
  params: unknown[];
  id?: string;
};

export default class NetworkController implements INetworkController {
  ticker: IReadableCell<string>;
  chainId: IReadableCell<string>;
  blockNumber: IReadableCell<number>;
  providerConfig: IReadableCell<ProviderConfig>;

  provider = new MemoryCell<SafeEventEmitterProvider | undefined>(
    undefined,
    (p1, p2) => p1 !== p2,
  );

  private mutex = new Mutex();

  /**
   * Initialized before our provider is created.
   */
  private ethQuery!: EthQuery;

  private _baseProviderHandlers = {};

  constructor(
    public state: QuillCells['network'],
    time: IReadableCell<number>,
  ) {
    this.ticker = new FormulaCell(
      { state: this.state },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ state }) => state.providerConfig.ticker,
    );

    this.chainId = new FormulaCell(
      { state: this.state },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ state }) => state.chainId,
    );

    this.blockNumber = new FormulaCell(
      {
        networkState: this.state,
        time: approximate(time, 20_000),
      },
      () => this.fetchBlockNumber(),
    );

    this.providerConfig = new FormulaCell(
      { state: this.state },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ state }) => state.providerConfig,
    );

    // TODO: Delete stuff?
    this.initializeProvider();

    this.watchThings();

    // when a new network is set, we set to loading first and then when connection succeeds, we update the network
  }

  async getNetworkIdentifier(): Promise<string> {
    return (await this.state.read()).chainId;
  }

  /**
   * Called by orchestrator once while initializing the class
   * @param providerHandlers - JRPC handlers for provider
   * @returns - provider - Returns the providerProxy
   */
  public initializeProvider() {
    this.configureProvider();
    this.lookupNetwork(); // Not awaiting this, because we don't want to block the initialization
  }

  async Provider(): Promise<SafeEventEmitterProvider> {
    for await (const provider of this.provider) {
      if (provider === undefined) {
        continue;
      }

      return provider;
    }

    assert(false, 'Unexpected end of provider cell');
  }

  /**
   * Refreshes the current network code
   */
  async lookupNetwork(): Promise<void> {
    const { rpcTarget, chainId } = await this.providerConfig.read();
    if (!chainId || !rpcTarget || !(await this.Provider())) {
      await this.state.update({
        chainId: 'loading', // TODO: no
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
            this.state.update({
              chainId: 'loading',
              properties: {
                EIPS: { 1559: undefined },
              },
            });
            reject(error);
          }

          this.state.update({
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
    this.state.update({
      properties: {
        EIPS: { 1559: supportsEIP1559 },
      },
    });
    return supportsEIP1559;
  }

  async fetch(body: RpcMessage) {
    const provider = await this.Provider();

    const res = await provider.request({
      method: body.method,
      jsonrpc: '2.0',
      id: body.id, // TODO: Do we need to set id if body.id is not provided?
      params: body.params,
    });

    return res;
  }

  private async configureProvider() {
    const { chainId, rpcTarget, ...rest } = await this.providerConfig.read();
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
    this.setProvider(provider);
  }

  private async setProvider(provider: SafeEventEmitterProvider) {
    await this.provider.write(provider);
    this.ethQuery = new EthQuery(provider);
  }

  private refreshNetwork() {
    this.state.update({
      chainId: 'loading',
      properties: { EIPS: { 1559: undefined } },
    });
    this.configureProvider();
    this.lookupNetwork();
  }

  private async fetchBlockNumber() {
    const res = await this.fetch({
      method: 'eth_blockNumber',
      id: createRandomId(),
      params: [],
    });
    assertType(res, io.string);
    const resNumber = Number(res);
    assert(Number.isFinite(resNumber));
    return resNumber;
  }

  private watchThings() {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
      for await (const _ of this.providerConfig) {
        this.refreshNetwork();
      }
    })();
  }
}
