import * as io from 'io-ts';

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
