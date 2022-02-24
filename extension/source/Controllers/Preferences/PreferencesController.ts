import { cloneDeep } from 'lodash-es';

import BaseController from '../BaseController';
import {
  AddressPreferences,
  Contact,
  IPreferencesController,
  PreferencesConfig,
  PreferencesState,
  Theme,
} from './IPreferencesController';

export const DEFAULT_PREFERENCES = {
  selectedCurrency: 'USD',
  locale: 'en-US',
  theme: 'dark',
  contacts: [],
  customTokens: [],
  customNfts: [],
} as AddressPreferences;

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController
  extends BaseController<PreferencesConfig, PreferencesState>
  implements IPreferencesController<PreferencesConfig, PreferencesState>
{
  /**
   * Name of this controller used during composition
   */
  name = 'PreferencesController';

  private defaultPreferences: Partial<AddressPreferences>;

  /**
   * Creates a PreferencesController instance
   *
   * @param config - Initial options used to configure this controller
   * @param state - Initial state to set on this controller
   */
  constructor({
    config,
    state,
    defaultPreferences,
  }: {
    config?: Partial<PreferencesConfig>;
    state?: Partial<PreferencesState>;
    defaultPreferences?: Partial<AddressPreferences>;
  }) {
    super({ config, state });
    this.defaultState = {
      identities: {},
      selectedAddress: '',
      lastErrorMessage: '',
      lastSuccessMessage: '',
    } as PreferencesState;
    this.defaultConfig = {} as PreferencesConfig;
    this.initialize();
    this.defaultPreferences = {
      ...DEFAULT_PREFERENCES,
      ...defaultPreferences,
    };
  }

  getAddressState(address?: string): AddressPreferences | undefined {
    const selectedAddress = address || this.state.selectedAddress;
    return this.state.identities[selectedAddress];
  }

  createUser(params: {
    selectedCurrency: string;
    theme: Theme;
    locale: string;
    address: string;
  }): void {
    const { selectedCurrency, theme, locale, address } = params;
    if (this.getAddressState(address)) return;
    this.updateState(
      {
        theme,
        defaultPublicAddress: address,
        selectedCurrency,
        locale,
      } as Partial<AddressPreferences>,
      address,
    );
  }

  setUserTheme(theme: Theme): void {
    if (theme === this.getAddressState()?.theme) return;
    this.updateState({ theme } as Partial<AddressPreferences>);
  }

  setUserLocale(locale: string): void {
    if (locale === this.getAddressState()?.locale) return;
    this.updateState({ locale } as Partial<AddressPreferences>);
  }

  setSelectedCurrency(selectedCurrency: string): void {
    if (selectedCurrency === this.getAddressState()?.selectedCurrency) return;
    this.updateState({
      selectedCurrency,
    } as Partial<AddressPreferences>);
  }

  addContact(contact: Contact): void {
    this.updateState({
      contacts: [...(this.getAddressState()?.contacts || []), contact],
    } as Partial<AddressPreferences>);
  }

  deleteContact(contactPublicAddress: string): void {
    const finalContacts = this.getAddressState()?.contacts?.filter(
      (contact) => contact.publicAddress.toLowerCase() !== contactPublicAddress,
    );
    if (finalContacts)
      this.updateState({
        contacts: [...finalContacts],
      } as Partial<AddressPreferences>);
  }

  protected updateState(
    preferences?: Partial<AddressPreferences>,
    address?: string,
  ): AddressPreferences {
    const selectedAddress = address || this.state.selectedAddress;
    const currentState =
      this.getAddressState(selectedAddress) ||
      cloneDeep(this.defaultPreferences);
    const mergedState = {
      ...currentState,
      ...preferences,
    } as AddressPreferences;
    this.update({
      identities: {
        ...this.state.identities,
        [selectedAddress]: mergedState,
      },
    } as PreferencesState);
    return mergedState;
  }

  /**
   * Sets selected address
   *
   * @param selectedAddress - eth address
   */
  setSelectedAddress(selectedAddress: string): void {
    this.update({ selectedAddress } as Partial<PreferencesState>);
  }
}
