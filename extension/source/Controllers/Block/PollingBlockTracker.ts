import { BaseBlockTracker } from './BaseBlockTracker';
import { createRandomId, timeout } from '../utils';
import {
  PollingBlockTrackerConfig,
  PollingBlockTrackerState,
} from './IBlockTrackerController';
import { ExtendedJsonRpcRequest } from '../Network/INetworkController';

const sec = 1000;

class PollingBlockTracker extends BaseBlockTracker<
  PollingBlockTrackerConfig,
  PollingBlockTrackerState
> {
  constructor({
    config,
    state = {},
  }: {
    config: Partial<PollingBlockTrackerConfig> &
      Pick<PollingBlockTrackerConfig, 'provider'>;
    state: Partial<PollingBlockTrackerState>;
  }) {
    // parse + validate args
    if (!config.provider) {
      throw new Error('PollingBlockTracker - no provider specified.');
    }
    super({ config, state });

    // config
    this.defaultConfig = {
      provider: config.provider,
      pollingInterval: 20 * sec,
      retryTimeout: 2 * sec,
      setSkipCacheFlag: false,
    };

    this.initialize();
  }

  // trigger block polling
  async checkForLatestBlock(): Promise<string> {
    await this._updateLatestBlock();
    return this.getLatestBlock();
  }

  protected _start(): void {
    this._synchronize().catch((err) => this.emit('error', err));
  }

  private async _synchronize(): Promise<void> {
    while (this.state._isRunning) {
      try {
        await this._updateLatestBlock();
        await timeout(this.config.pollingInterval);
      } catch (err: unknown) {
        const newErr = new Error(
          `PollingBlockTracker - encountered an error while attempting to update latest block:\n${
            (err as Error).stack
          }`,
        );
        try {
          this.emit('error', newErr);
        } catch (emitErr) {
          console.error(newErr, emitErr);
        }
        await timeout(this.config.retryTimeout);
      }
    }
  }

  private async _updateLatestBlock(): Promise<void> {
    // fetch + set latest block
    const latestBlock = await this._fetchLatestBlock();
    this._newPotentialLatest(latestBlock);
  }

  private async _fetchLatestBlock(): Promise<string> {
    try {
      const req: ExtendedJsonRpcRequest<[]> = {
        method: 'eth_blockNumber',
        jsonrpc: '2.0',
        id: createRandomId(),
        params: [],
      };

      const res = await this.config.provider.sendAsync<[], string>(req);
      return res;
    } catch (error: unknown) {
      throw new Error(
        `PollingBlockTracker - encountered error fetching block:\n${
          (error as Error).message
        }`,
      );
    }
  }
}

export default PollingBlockTracker;
