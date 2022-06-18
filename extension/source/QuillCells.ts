import { ethers } from 'ethers';
import * as io from 'io-ts';

import CellCollection from './cells/CellCollection';
import TransformCell from './cells/TransformCell';
import { ProviderConfig } from './Controllers/constants';
import { Preferences } from './Controllers/PreferencesController';
import { getDefaultProviderConfig } from './Controllers/utils';
import AsyncReturnType from './types/AsyncReturnType';

function QuillCells(storage: CellCollection) {
  const rootCells = {
    preferredCurrency: storage.Cell(
      'preferredCurrency',
      io.type({
        userCurrency: io.string,
        cachedConversion: io.union([
          io.undefined,
          io.type({
            rate: io.number,
            lastUpdated: io.string,
          }),
        ]),
      }),
      () => ({
        userCurrency: 'usd',
        cachedConversion: undefined,
      }),
    ),
    keyring: storage.Cell(
      'keyring',
      io.type({
        HDPhrase: io.string,
        wallets: io.array(
          io.type({
            privateKey: io.string,
            address: io.string,
          }),
        ),
        // FIXME: redundant storage of chainId
        chainId: io.union([io.undefined, io.string]),
      }),
      () => ({
        HDPhrase: ethers.Wallet.createRandom().mnemonic.phrase,
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
        // TODO: Remove this - the real chain id is in
        //       providerConfig
        chainId: '0x66eeb',
        properties: {
          EIPS: { 1559: undefined },
        },
        providerConfig: getDefaultProviderConfig(),
      }),
    ),
    preferences: storage.Cell('preferences', Preferences, () => ({
      identities: {},
      selectedAddress: undefined,
      lastErrorMessage: undefined,
      lastSuccessMessage: undefined,
      breakOnAssertionFailures: undefined,
    })),
  };

  /** the cells involved in the response to quill_providerState in public rpc */
  const providerStateCells = {
    chainId: TransformCell.Sub(rootCells.network, 'chainId'),
    selectedAddress: TransformCell.Sub(
      rootCells.preferences,
      'selectedAddress',
    ),
    // TODO: Deduplicate with quillPage
    breakOnAssertionFailures: TransformCell.SubWithDefault(
      rootCells.preferences,
      'breakOnAssertionFailures',
      false,
    ),
  };

  return {
    ...rootCells,
    ...providerStateCells,
  };
}

type QuillCells = ReturnType<typeof QuillCells>;

export default QuillCells;

export type QuillState<K extends keyof QuillCells> = AsyncReturnType<
  QuillCells[K]['read']
>;
