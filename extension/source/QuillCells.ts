import { ethers } from 'ethers';
import * as io from 'io-ts';

import CellCollection from './cells/CellCollection';
import TransformCell from './cells/TransformCell';
import {
  builtinChainIdToName,
  builtinProviderConfigs,
  ProviderConfig,
} from './background/networks';
import { Preferences } from './background/PreferencesController';
import AsyncReturnType from './types/AsyncReturnType';
import { DEFAULT_CHAIN_ID_HEX } from './env';
import { FormulaCell } from './cells/FormulaCell';

function QuillCells(storage: CellCollection) {
  const rootCells = {
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
      }),
      () => ({
        HDPhrase: ethers.Wallet.createRandom().mnemonic.phrase,
        wallets: [],
      }),
    ),
    network: storage.Cell(
      'network',
      io.type({
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

  const providerConfig = FormulaCell.Sub(rootCells.network, 'providerConfig');

  /** the cells involved in the response to quill_providerState in public rpc */
  const providerStateCells = {
    chainId: FormulaCell.Sub(providerConfig, 'chainId'),
    selectedAddress: TransformCell.Sub(
      rootCells.preferences,
      'selectedAddress',
    ),
    // TODO: MEGAFIX: Deduplicate with quillPage
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

export const getDefaultProviderConfig = (): ProviderConfig => {
  const networkName = builtinChainIdToName(DEFAULT_CHAIN_ID_HEX);
  const config = builtinProviderConfigs[networkName];

  return config;
};
