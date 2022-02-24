import { BaseConfig, BaseState, IController } from '../interfaces';

export interface IAccountTrackerController<C, S> extends IController<C, S> {
  /**
   * Syncs accounts from preferences controller
   */
  syncAccounts(): void;

  /**
   * Refreshes the balances of all accounts
   */
  refresh(): Promise<void>;
}

export interface AccountTrackerConfig extends BaseConfig {
  _currentBlock?: string;
}

/**
 * Account information object
 */
export interface AccountInformation {
  /**
   * Hex string of an account balance in wei (base unit)
   */
  balance: string;
}

/**
 * Account tracker controller state
 */
export interface AccountTrackerState extends BaseState {
  /**
   * Map of addresses to account information
   */
  accounts: { [address: string]: AccountInformation }; // address here is public address
}
