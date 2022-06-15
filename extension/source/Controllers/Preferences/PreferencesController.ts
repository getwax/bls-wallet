import { cloneDeep } from 'lodash-es';
import CellCollection from '../../cells/CellCollection';
import ICell from '../../cells/ICell';
import assert from '../../helpers/assert';

import {
  AddressPreferences,
  Contact,
  defaultAddressPreferences,
  defaultPreferencesState,
  IPreferencesController,
  PreferencesState,
  Theme,
} from './IPreferencesController';

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController implements IPreferencesController {
  /**
   * Name of this controller used during composition
   */
  name = 'PreferencesController';

  state: ICell<PreferencesState>;

  constructor(storage: CellCollection) {
    this.state = storage.Cell(
      'preferences-controller-state',
      PreferencesState,
      () => defaultPreferencesState,
    );
  }

  async getAddressState(
    address?: string,
  ): Promise<AddressPreferences | undefined> {
    const state = await this.state.read();
    const selectedAddress = address ?? state.selectedAddress;

    if (selectedAddress === undefined) {
      return undefined;
    }

    return state.identities[selectedAddress];
  }

  async createUser(params: {
    selectedCurrency: string;
    theme: Theme;
    locale: string;
    address: string;
  }) {
    const { selectedCurrency, theme, locale, address } = params;
    if (await this.getAddressState(address)) return;
    await this.updateState(
      {
        theme,
        defaultPublicAddress: address,
        selectedCurrency,
        locale,
      },
      address,
    );
  }

  async setUserTheme(theme: Theme) {
    if (theme === (await this.getAddressState())?.theme) return;
    await this.updateState({ theme });
  }

  async setUserLocale(locale: string) {
    if (locale === (await this.getAddressState())?.locale) return;
    await this.updateState({ locale });
  }

  async setSelectedCurrency(selectedCurrency: string) {
    if (selectedCurrency === (await this.getAddressState())?.selectedCurrency)
      return;
    await this.updateState({
      selectedCurrency,
    });
  }

  async addContact(contact: Contact) {
    await this.updateState({
      contacts: [...((await this.getAddressState())?.contacts || []), contact],
    });
  }

  async deleteContact(contactPublicAddress: string) {
    const finalContacts = (await this.getAddressState())?.contacts?.filter(
      (contact) => contact.publicAddress.toLowerCase() !== contactPublicAddress,
    );
    if (finalContacts)
      await this.updateState({
        contacts: [...finalContacts],
      });
  }

  protected async updateState(
    preferences?: Partial<AddressPreferences>,
    address?: string,
  ) {
    const state = await this.state.read();
    const selectedAddress = address ?? state.selectedAddress;
    assert(selectedAddress !== undefined);
    const currentState =
      (await this.getAddressState(selectedAddress)) ??
      cloneDeep(defaultAddressPreferences);
    const mergedState: AddressPreferences = {
      ...currentState,
      ...preferences,
    };
    await this.update({
      identities: {
        ...(await this.state.read()).identities,
        [selectedAddress]: mergedState,
      },
    });
    return mergedState;
  }

  /**
   * Sets selected address
   *
   * @param selectedAddress - eth address
   */
  async setSelectedAddress(selectedAddress: string) {
    await this.update({ selectedAddress } as Partial<PreferencesState>);
  }

  private async update(stateUpdates: Partial<PreferencesState>) {
    const state = await this.state.read();
    await this.state.write({ ...state, ...stateUpdates });
  }
}
