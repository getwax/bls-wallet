import { cloneDeep } from 'lodash-es';
import * as io from 'io-ts';
import assert from '../helpers/assert';
import QuillCells, { QuillState } from '../QuillCells';

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController {
  /**
   * Name of this controller used during composition
   */
  name = 'PreferencesController';

  constructor(public state: QuillCells['preferences']) {}

  /**
   * Gets the preferences state of specified address
   * @defaultValue - By default it will return selected address preferences
   */
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

  /**
   * creates a new user and stores his details
   * @param address - address of the user
   *
   */
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
    await this.update({ selectedAddress } as Partial<
      QuillState<'preferences'>
    >);
  }

  private async update(stateUpdates: Partial<QuillState<'preferences'>>) {
    const state = await this.state.read();
    await this.state.write({ ...state, ...stateUpdates });
  }
}

export const Theme = io.union([io.literal('light'), io.literal('dark')]);
export type Theme = io.TypeOf<typeof Theme>;

export const Contact = io.type({
  displayName: io.string,
  publicAddress: io.string,
});

export type Contact = io.TypeOf<typeof Contact>;

export const CustomNft = io.type({
  /**
   * Address of the nft contract
   */
  nftAddress: io.string,
  /**
   * Chain Id of the nft contract
   */
  chainId: io.string,
  /**
   * NFT standard of the nft contract. (ERC-721 or ERC-1155)
   */
  nftContractStandard: io.string,
  /**
   * Token Id for the nft
   */
  nftTokenId: io.string,
});

export type CustomNft = io.TypeOf<typeof CustomNft>;

export const CustomToken = io.type({
  /**
   * Address of the ERC20 token contract
   */
  tokenAddress: io.string,
  /**
   * Chain Id of the token contract
   */
  chainId: io.string,
  /**
   * Symbol of the token (e.g. 'DAI', 'USDC')
   */
  tokenSymbol: io.string,
  /**
   * Name of the token
   */
  tokenName: io.string,
  /**
   * Decimals of the token
   */
  decimals: io.string,
});

export type CustomToken = io.TypeOf<typeof CustomToken>;

const AddressPreferences = io.type({
  selectedCurrency: io.string,
  locale: io.string,
  theme: Theme,
  defaultPublicAddress: io.union([io.undefined, io.string]),
  contacts: io.union([io.undefined, io.array(Contact)]),
  customTokens: io.union([io.undefined, io.array(CustomToken)]),
  customNfts: io.union([io.undefined, io.array(CustomNft)]),
});

export type AddressPreferences = io.TypeOf<typeof AddressPreferences>;

export const defaultAddressPreferences: AddressPreferences = {
  selectedCurrency: 'USD',
  locale: 'en-US',
  theme: 'dark',
  defaultPublicAddress: undefined,
  contacts: [],
  customTokens: [],
  customNfts: [],
};
