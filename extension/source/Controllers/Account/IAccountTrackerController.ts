import * as io from 'io-ts';

export interface IAccountTrackerController {
  /**
   * Syncs accounts from preferences controller
   */
  syncAccounts(): Promise<void>;

  /**
   * Refreshes the balances of all accounts
   */
  refresh(): Promise<void>;
}

export const AccountInformation = io.type({
  /**
   * Hex string of an account balance in wei (base unit)
   */
  balance: io.string,
});

/**
 * Account information object
 */
export type AccountInformation = io.TypeOf<typeof AccountInformation>;

export const AccountTrackerState = io.type({
  /**
   * Map of addresses to account information
   */
  accounts: io.record(io.string, AccountInformation),
});

/**
 * Account tracker controller state
 */
export type AccountTrackerState = io.TypeOf<typeof AccountTrackerState>;

export const defaultAccountTrackerState: AccountTrackerState = {
  accounts: {},
};
