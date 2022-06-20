import { ethers } from 'ethers';
import * as io from 'io-ts';

import CellCollection from './cells/CellCollection';
import TransformCell from './cells/TransformCell';
import {
  builtinChainIdToName,
  builtinProviderConfigs,
  ProviderConfig,
} from './background/networks';
import { Preferences, Theme } from './background/PreferencesController';
import AsyncReturnType from './types/AsyncReturnType';
import { DEFAULT_CHAIN_ID_HEX } from './env';
import { FormulaCell } from './cells/FormulaCell';
import assert from './helpers/assert';

function QuillStorageCells(storage: CellCollection) {
  const rootCells = {
    keyring: storage.Cell(
      'keyring',
      io.type({
        HDPhrase: io.string,
        nextHDIndex: io.number,
        wallets: io.array(
          io.type({
            privateKey: io.string,
            address: io.string,
          }),
        ),
      }),
      () => ({
        HDPhrase: ethers.Wallet.createRandom().mnemonic.phrase,
        nextHDIndex: 0,
        wallets: [],
      }),
    ),
    network: storage.Cell('network', ProviderConfig, () => {
      const networkName = builtinChainIdToName(DEFAULT_CHAIN_ID_HEX);
      const config = builtinProviderConfigs[networkName];

      return config;
    }),
    preferences: storage.Cell('preferences', Preferences, () => ({
      identities: {},
      selectedAddress: undefined,
      lastErrorMessage: undefined,
      lastSuccessMessage: undefined,
      developerSettings: {
        breakOnAssertionFailures: false,
        exposeEthereumRpc: false,
      },
    })),
  };

  const providerStateCells = {
    chainId: FormulaCell.Sub(rootCells.network, 'chainId'),
    selectedAddress: TransformCell.Sub(
      rootCells.preferences,
      'selectedAddress',
    ),
    developerSettings: TransformCell.Sub(
      rootCells.preferences,
      'developerSettings',
    ),
  };

  return {
    ...rootCells,
    providerState: new FormulaCell(providerStateCells, (values) => values),
    ...providerStateCells,

    theme: new FormulaCell(
      { preferences: rootCells.preferences },
      ({ preferences: { selectedAddress, identities } }): Theme => {
        if (selectedAddress === undefined) {
          return 'light';
        }

        const identity = identities[selectedAddress];
        assert(identity !== undefined);

        return identity.theme;
      },
    ),

    breakOnAssertionFailures: TransformCell.Sub(
      providerStateCells.developerSettings,
      'breakOnAssertionFailures',
    ),

    exposeEthereumRpc: TransformCell.Sub(
      providerStateCells.developerSettings,
      'exposeEthereumRpc',
    ),
  };
}

type QuillStorageCells = ReturnType<typeof QuillStorageCells>;

export default QuillStorageCells;

export type QuillState<K extends keyof QuillStorageCells> = AsyncReturnType<
  QuillStorageCells[K]['read']
>;
