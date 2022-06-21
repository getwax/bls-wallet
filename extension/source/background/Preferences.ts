import * as io from 'io-ts';

export const Theme = io.union([io.literal('light'), io.literal('dark')]);
export type Theme = io.TypeOf<typeof Theme>;

export const Contact = io.type({
  displayName: io.string,
  publicAddress: io.string,
});

export type Contact = io.TypeOf<typeof Contact>;

const CustomNft = io.type({
  nftAddress: io.string,
  chainId: io.string,
  nftContractStandard: io.string,
  nftTokenId: io.string,
});

type CustomNft = io.TypeOf<typeof CustomNft>;

const CustomToken = io.type({
  tokenAddress: io.string,
  chainId: io.string,
  tokenSymbol: io.string,
  tokenName: io.string,
  decimals: io.string,
});

type CustomToken = io.TypeOf<typeof CustomToken>;

export const AddressPreferences = io.type({
  preferredCurrency: io.string,
  theme: Theme,
  defaultPublicAddress: io.union([io.undefined, io.string]),
  contacts: io.array(Contact),
  customTokens: io.array(CustomToken),
  customNfts: io.array(CustomNft),
});

export type AddressPreferences = io.TypeOf<typeof AddressPreferences>;

export const defaultAddressPreferences: AddressPreferences = {
  preferredCurrency: 'USD',
  theme: 'dark',
  defaultPublicAddress: undefined,
  contacts: [],
  customTokens: [],
  customNfts: [],
};

// Note: These settings are communicated in-page. This seems fine for now, but
// if we add something sensitive (or otherwise), we might want to make a
// public/private distinction here.
export const DeveloperSettings = io.type({
  breakOnAssertionFailures: io.boolean,
  exposeEthereumRpc: io.boolean,
  rpcLogging: io.type({
    background: io.boolean,
    inPage: io.boolean,
  }),
});

export type DeveloperSettings = io.TypeOf<typeof DeveloperSettings>;

export const Preferences = io.type({
  identities: io.record(
    io.string,
    io.union([io.undefined, AddressPreferences]),
  ),
  selectedAddress: io.union([io.undefined, io.string]),
  developerSettings: DeveloperSettings,
});

export type Preferences = io.TypeOf<typeof Preferences>;
