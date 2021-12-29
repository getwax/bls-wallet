import { BaseConfig, BaseState, IController } from '../interfaces';

export interface AddressPreferences {
  selectedCurrency: string;
  locale: string;
}

/**
 * Preferences controller state
 */
export interface PreferencesState extends BaseState {
  /**
   * Map of addresses to AddressPreferences objects
   */
  identities: { [address: string]: AddressPreferences };
  /**
   * Current coinbase account
   */
  selectedAddress: string;

  lastErrorMessage?: string;

  lastSuccessMessage?: string;
}

export interface PreferencesConfig extends BaseConfig {
  pollInterval?: number;
}

export interface IPreferencesController<P, C, S> extends IController<C, S> {
  /**
   * Init will sync the preferences of specified address with backend and also add the identity in state
   * the store.
   * @param address - address of the user
   *
   */
  initPreferences(params: { address: string; locale?: string }): Promise<void>;

  /**
   * Gets the preferences state of specified address
   * @defaultValue - By default it will return selected address preferences
   */
  getAddressState(address?: string): P;

  /**
   * Sets the selected address in state
   * @param selectedAddress - Sets the provided address as currently selected address
   */
  setSelectedAddress(selectedAddress: string): void;
}
