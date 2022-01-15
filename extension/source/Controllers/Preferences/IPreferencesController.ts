import { BaseConfig, BaseState, IController } from '../interfaces';

export type Theme = 'light' | 'dark';

export type Contact = {
  displayName: string;
  publicAddress: string;
};

export type CustomNft = {
  /**
   * Address of the nft contract
   */
  nftAddress: string;
  /**
   * Chain Id of the nft contract
   */
  chainId: string;
  /**
   * NFT standard of the nft contract. (ERC-721 or ERC-1155)
   */
  nftContractStandard: string;
  /**
   * Token Id for the nft
   */
  nftTokenId: string;
};

export type CustomToken = {
  /**
   * Address of the ERC20 token contract
   */
  tokenAddress: string;
  /**
   * Chain Id of the token contract
   */
  chainId: string;
  /**
   * Symbol of the token (e.g. 'DAI', 'USDC')
   */
  tokenSymbol: string;
  /**
   * Name of the token
   */
  tokenName: string;
  /**
   * Decimals of the token
   */
  decimals: string;
};

export interface AddressPreferences {
  selectedCurrency: string;
  locale: string;
  theme: Theme;
  contacts?: Contact[];
  customTokens?: CustomToken[];
  customNfts?: CustomNft[];
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

export type PreferencesConfig = BaseConfig;

export interface IPreferencesController<C, S> extends IController<C, S> {
  /**
   * creates a new user and stores his details
   * @param address - address of the user
   *
   */
  createUser(params: { address: string } & Partial<AddressPreferences>): void;

  /**
   * Gets the preferences state of specified address
   * @defaultValue - By default it will return selected address preferences
   */
  getAddressState(address?: string): AddressPreferences | undefined;

  /**
   * Sets the selected address in state
   * @param selectedAddress - Sets the provided address as currently selected address
   */
  setSelectedAddress(selectedAddress: string): void;
}
