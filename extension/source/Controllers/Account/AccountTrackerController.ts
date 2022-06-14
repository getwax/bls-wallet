import { Mutex } from 'async-mutex';
import EthQuery from '../rpcHelpers/EthQuery';
import BaseController from '../BaseController';

import { SafeEventEmitterProvider } from '../Network/INetworkController';
import NetworkController from '../Network/NetworkController';
import { PreferencesState } from '../Preferences/IPreferencesController';
import {
  AccountInformation,
  AccountTrackerConfig,
  AccountTrackerState,
  IAccountTrackerController,
} from './IAccountTrackerController';
import { IReadableCell } from '../../cells/ICell';

/**
 * Tracks accounts based on blocks.
 * If block tracker provides latest block, we query accounts from it.
 * Preferences state changes also retrigger accounts update.
 * Network state changes also retrigger accounts update.
 */
class AccountTrackerController
  extends BaseController<AccountTrackerConfig, AccountTrackerState>
  implements
    IAccountTrackerController<AccountTrackerConfig, AccountTrackerState>
{
  private provider: SafeEventEmitterProvider;

  private blockNumber: IReadableCell<number>;

  private mutex = new Mutex();

  private ethQuery: EthQuery;

  private getIdentities: () => PreferencesState['identities'];

  private getCurrentChainId: NetworkController['getNetworkIdentifier'];

  constructor({
    config,
    state,
    provider,
    blockNumber,
    getCurrentChainId,
    getIdentities,
    onPreferencesStateChange,
  }: {
    config: AccountTrackerConfig;
    state: Partial<AccountTrackerState>;
    provider: SafeEventEmitterProvider;
    blockNumber: IReadableCell<number>;
    getCurrentChainId: NetworkController['getNetworkIdentifier'];
    getIdentities: () => PreferencesState['identities'];
    onPreferencesStateChange: (
      listener: (preferencesState: PreferencesState) => void,
    ) => void;
  }) {
    super({ config, state });
    this.defaultState = {
      accounts: {},
    };
    this.defaultConfig = {
      _currentBlock: '',
    };
    this.initialize();
    this.provider = provider;
    this.blockNumber = blockNumber;
    this.ethQuery = new EthQuery(provider);

    (async () => {
      for await (const blockNumberValue of this.blockNumber) {
        this.configure({ _currentBlock: blockNumberValue?.toString(16) });
        this.refresh();
      }
    })();

    this.getIdentities = getIdentities;
    this.getCurrentChainId = getCurrentChainId;
    onPreferencesStateChange(() => {
      this.syncAccounts();
      this.refresh();
    });
    console.log(this.provider, 'eth provider in account tracker');
  }

  syncAccounts(): void {
    const { accounts } = this.state;
    const addresses = Object.keys(this.getIdentities());
    const existing = Object.keys(accounts);
    const newAddresses = addresses.filter(
      (address) => existing.indexOf(address) === -1,
    );
    const oldAddresses = existing.filter(
      (address) => addresses.indexOf(address) === -1,
    );
    newAddresses.forEach((address) => {
      accounts[address] = { balance: '0x0' };
    });
    oldAddresses.forEach((address) => {
      delete accounts[address];
    });
    this.update({ accounts: { ...accounts } });
  }

  async refresh(): Promise<void> {
    const releaseLock = await this.mutex.acquire();
    try {
      const { accounts } = this.state;
      const currentBlock = this.config._currentBlock;
      if (!currentBlock) return;
      const addresses = Object.keys(accounts);
      await Promise.all(
        addresses.map((x) => this._updateAccount(x, currentBlock)),
      );
    } catch (error) {
      console.error(error);
    } finally {
      releaseLock();
    }
  }

  private async _updateAccount(
    address: string,
    currentBlock: string,
  ): Promise<void> {
    const currentChainId = await this.getCurrentChainId();
    if (currentChainId === 'loading') {
      return;
    }
    const balance = await this.ethQuery.request({
      method: 'eth_getBalance',
      params: [address, currentBlock],
    });
    const result: AccountInformation = {
      balance: balance as string,
    };
    // update accounts state
    const { accounts: newAccounts } = this.state;
    // only populate if the entry is still present
    if (!newAccounts[address]) return;
    newAccounts[address] = result;
    this.update({ accounts: newAccounts });
  }
}

export default AccountTrackerController;
