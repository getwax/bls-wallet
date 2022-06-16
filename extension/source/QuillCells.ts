import * as io from 'io-ts';

import CellCollection from './cells/CellCollection';
import { ProviderConfig } from './Controllers/constants';
import { getDefaultProviderConfig } from './Controllers/utils';
import AsyncReturnType from './types/AsyncReturnType';

const Theme = io.union([io.literal('light'), io.literal('dark')]);
type Theme = io.TypeOf<typeof Theme>;

const Contact = io.type({
  displayName: io.string,
  publicAddress: io.string,
});

type Contact = io.TypeOf<typeof Contact>;

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

const AddressPreferences = io.type({
  selectedCurrency: io.string,
  locale: io.string,
  theme: Theme,
  defaultPublicAddress: io.union([io.undefined, io.string]),
  contacts: io.union([io.undefined, io.array(Contact)]),
  customTokens: io.union([io.undefined, io.array(CustomToken)]),
  customNfts: io.union([io.undefined, io.array(CustomNft)]),
});

function QuillCells(storage: CellCollection) {
  return {
    preferredCurrency: storage.Cell(
      'preferredCurrency',
      io.type({
        userCurrency: io.string,
        conversionRate: io.number,
        conversionDate: io.string,
      }),
      () => ({
        userCurrency: 'usd',
        conversionRate: 0,
        conversionDate: 'N/A',
      }),
    ),
    keyring: storage.Cell(
      'keyring',
      io.type({
        HDPhrase: io.union([io.undefined, io.string]),
        wallets: io.array(
          io.type({
            privateKey: io.string,
            address: io.string,
          }),
        ),
        chainId: io.union([io.undefined, io.string]),
      }),
      () => ({
        HDPhrase: undefined,
        wallets: [],
        chainId: undefined,
      }),
    ),
    network: storage.Cell(
      'network',
      io.type({
        chainId: io.string,
        providerConfig: ProviderConfig,
        properties: io.intersection([
          io.record(io.string, io.unknown),
          io.type({
            // undefined means we have not checked yet. (true or false means property is set)
            EIPS: io.record(io.string, io.union([io.boolean, io.undefined])),
          }),
        ]),
      }),
      () => ({
        chainId: 'loading', // TODO: Use undefined instead
        properties: {
          EIPS: { 1559: undefined },
        },
        providerConfig: getDefaultProviderConfig(),
      }),
    ),
    preferences: storage.Cell(
      'preferences',
      io.type({
        identities: io.record(io.string, AddressPreferences),
        selectedAddress: io.union([io.undefined, io.string]),
        lastErrorMessage: io.union([io.undefined, io.string]),
        lastSuccessMessage: io.union([io.undefined, io.string]),
        breakOnAssertionFailures: io.union([io.undefined, io.boolean]),
      }),
      () => ({
        identities: {},
        selectedAddress: undefined,
        lastErrorMessage: undefined,
        lastSuccessMessage: undefined,
        breakOnAssertionFailures: undefined,
      }),
    ),
  };
}

type QuillCells = ReturnType<typeof QuillCells>;

export default QuillCells;

export type QuillState<K extends keyof QuillCells> = AsyncReturnType<
  QuillCells[K]['read']
>;
