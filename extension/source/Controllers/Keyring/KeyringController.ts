import BaseController from '../BaseController';
import { Listener } from '../interfaces';
import {
  Keyring,
  KeyringConfig,
  KeyringMemState,
  KeyringObject,
  KeyringState,
} from './IKeyringController';
import SimpleKeyring from './SimpleKeyring';

const privates = new WeakMap();

export class KeyringController extends BaseController<
  KeyringConfig,
  KeyringState
> {
  name = 'KeyringController';

  constructor(
    {},
    config?: Partial<KeyringConfig>,
    state?: Partial<KeyringState>,
  ) {
    super({ config, state });
    privates.set(this, {
      keyring: new SimpleKeyring(),
    });

    this.defaultState = {
      ...privates.get(this).keyring.store.getState(),
      keyrings: [],
    };
    this.initialize();
    this.fullUpdate();
  }

  async addNewAccount(): Promise<KeyringMemState> {
    await privates.get(this).keyring.addAccounts();
    return this.fullUpdate();
  }

  /**
   * Gets the private key from the keyring controlling an address.
   *
   * @param password - Password of the keyring.
   * @param address - Address to export.
   * @returns Promise resolving to the private key for an address.
   */
  exportAccount(password: string, address: string): Promise<string> {
    if (privates.get(this).keyring.password === password) {
      return privates.get(this).keyring.exportAccount(address);
    }
    throw new Error('Invalid password');
  }

  /**
   * Returns the public addresses of all accounts for the current keyring.
   *
   * @returns A promise resolving to an array of addresses.
   */
  getAccounts(): Promise<string[]> {
    return privates.get(this).keyring.getAccounts();
  }

  /**
   * Removes an account from keyring state.
   *
   * @param address - Address of the account to remove.
   * @returns Promise resolving current state when this account removal completes.
   */
  async removeAccount(address: string): Promise<KeyringMemState> {
    // this.removeIdentity(address);
    await privates.get(this).keyring.removeAccount(address);
    return this.fullUpdate();
  }

  /**
   * Imports an account with the specified import strategy.
   *
   * @param strategy - Import strategy name.
   * @param args - Array of arguments to pass to the underlying stategy.
   * @throws Will throw when passed an unrecognized strategy.
   * @returns Promise resolving to current state when the import is complete.
   */
  async importAccountWithStrategy() {}

  /**
   * Signs message by calling down into a specific keyring.
   *
   * @param messageParams - PersonalMessageParams object to sign.
   * @returns Promise resolving to a signed message string.
   */
  signMessage() {}

  /**
   * Signs personal message by calling down into a specific keyring.
   *
   * @param messageParams - PersonalMessageParams object to sign.
   * @returns Promise resolving to a signed message string.
   */
  signPersonalMessage() {}

  /**
   * Signs a transaction by calling down into a specific keyring.
   *
   * @param transaction - Transaction object to sign. Must be a `ethereumjs-tx` transaction instance.
   * @param from - Address to sign from, should be in keychain.
   * @returns Promise resolving to a signed transaction string.
   */
  signTransaction() {}

  /**
   * Attempts to decrypt the current vault and load its keyrings.
   *
   * @param password - Password to unlock the keychain.
   * @returns Promise resolving to the current state.
   */
  async submitPassword() {}

  /**
   * Adds new listener to be notified of state changes.
   *
   * @param listener - Callback triggered when state changes.
   */
  subscribe(listener: Listener<KeyringState>) {
    privates.get(this).keyring.store.subscribe(listener);
  }

  /**
   * Removes existing listener from receiving state changes.
   *
   * @param listener - Callback to remove.
   * @returns True if a listener is found and unsubscribed.
   */
  unsubscribe(listener: Listener<KeyringState>) {
    return privates.get(this).keyring.store.unsubscribe(listener);
  }

  /**
   * Adds new listener to be notified when the wallet is locked.
   *
   * @param listener - Callback triggered when wallet is locked.
   * @returns EventEmitter if listener added.
   */
  onLock(listener: () => void) {
    return privates.get(this).keyring.on('lock', listener);
  }

  /**
   * Adds new listener to be notified when the wallet is unlocked.
   *
   * @param listener - Callback triggered when wallet is unlocked.
   * @returns EventEmitter if listener added.
   */
  onUnlock(listener: () => void) {
    return privates.get(this).keyring.on('unlock', listener);
  }

  /**
   * Update keyrings in state and calls KeyringController fullUpdate method returning current state.
   *
   * @returns The current state.
   */
  private async fullUpdate(): Promise<KeyringMemState> {
    const keyrings: Keyring[] = await Promise.all<Keyring>(
      privates
        .get(this)
        .keyring.keyrings.map(
          async (keyring: KeyringObject, index: number): Promise<Keyring> => {
            const keyringAccounts = keyring.getAccounts();
            const accounts = Array.isArray(keyringAccounts)
              ? keyringAccounts.map((address) => address)
              : /* istanbul ignore next */ [];
            return {
              accounts,
              index,
              type: keyring.type,
            };
          },
        ),
    );
    this.update({ keyrings: [...keyrings] });
    return privates.get(this).keyring.fullUpdate();
  }
}
