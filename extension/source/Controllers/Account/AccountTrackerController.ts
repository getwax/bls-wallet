import * as io from 'io-ts';

import { Mutex } from 'async-mutex';
import EthQuery from '../rpcHelpers/EthQuery';

import { SafeEventEmitterProvider } from '../Network/INetworkController';
import NetworkController from '../Network/NetworkController';
import { PreferencesState } from '../Preferences/IPreferencesController';
import {
  AccountInformation,
  AccountTrackerState,
  IAccountTrackerController,
} from './IAccountTrackerController';
import ICell, { IReadableCell } from '../../cells/ICell';
import toHex from '../../helpers/toHex';
import assertType from '../../cells/assertType';

/**
 * Tracks accounts based on blocks.
 * If block tracker provides latest block, we query accounts from it.
 * Preferences state changes also retrigger accounts update.
 * Network state changes also retrigger accounts update.
 */
class AccountTrackerController implements IAccountTrackerController {
  private provider: SafeEventEmitterProvider;

  public state: ICell<AccountTrackerState>;

  private blockNumber: IReadableCell<number>;

  private mutex = new Mutex();

  private ethQuery: EthQuery;

  private getIdentities: () => Promise<PreferencesState['identities']>;

  private getCurrentChainId: NetworkController['getNetworkIdentifier'];

  constructor({
    state,
    provider,
    blockNumber,
    getCurrentChainId,
    getIdentities,
    preferences,
  }: {
    state: ICell<AccountTrackerState>;
    provider: SafeEventEmitterProvider;
    blockNumber: IReadableCell<number>;
    getCurrentChainId: NetworkController['getNetworkIdentifier'];
    getIdentities: () => Promise<PreferencesState['identities']>;
    preferences: ICell<PreferencesState>;
  }) {
    this.provider = provider;
    this.state = state;
    this.blockNumber = blockNumber;
    this.ethQuery = new EthQuery(provider);

    (async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
      for await (const _ of this.blockNumber) {
        this.refresh();
      }
    })();

    this.getIdentities = getIdentities;
    this.getCurrentChainId = getCurrentChainId;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
      for await (const _ of preferences) {
        this.syncAccounts();
        this.refresh();
      }
    })();

    console.log(this.provider, 'eth provider in account tracker');
  }

  async syncAccounts() {
    const state = await this.state.read();
    const { accounts } = state;
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
    await this.update({ accounts: { ...accounts } });
  }

  async refresh(): Promise<void> {
    const releaseLock = await this.mutex.acquire();
    try {
      const state = await this.state.read();
      const { accounts } = state;
      const currentBlock = toHex(await this.blockNumber.read());
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
    assertType(balance, io.string);
    const result: AccountInformation = { balance };
    // update accounts state
    const { accounts: newAccounts } = await this.state.read();
    // only populate if the entry is still present
    if (!newAccounts[address]) return;
    newAccounts[address] = result;
    this.update({ accounts: newAccounts });
  }

  private async update(stateUpdates: Partial<AccountTrackerState>) {
    const state = await this.state.read();
    await this.state.write({ ...state, ...stateUpdates });
  }
}

export default AccountTrackerController;
