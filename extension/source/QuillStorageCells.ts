import { ethers } from 'ethers';
import * as io from 'io-ts';
import { once } from 'lodash-es';

import CellCollection from './cells/CellCollection';
import TransformCell from './cells/TransformCell';
import { ProviderConfig } from './background/ProviderConfig';
import { Preferences } from './background/Preferences';
import AsyncReturnType from './types/AsyncReturnType';
import { FormulaCell } from './cells/FormulaCell';
import assert from './helpers/assert';
import { QuillTransaction } from './types/Rpc';
import optional from './types/optional';
import Config from './Config';

// FIXME: If defaults were built into our io types, we could easily add new
// fields that always have concrete values incrementally without breaking
// existing clients.

function QuillStorageCells(
  config: Config,
  standardStorage: CellCollection,
  encryptedStorage: CellCollection,
) {
  const rootCells = {
    onboarding: standardStorage.Cell(
      'onboarding',
      io.type({
        autoOpened: io.boolean,
        completed: io.boolean,
      }),
      () => ({
        autoOpened: false,
        completed: false,
      }),
    ),
    keyring: encryptedStorage.Cell(
      'keyring',
      io.type({
        HDPhrase: io.string,
        nextHDIndex: io.number,
        wallets: io.array(
          io.type({
            privateKey: io.string,
            publicKeyHash: io.string,
            networks: io.record(
              io.string,
              optional(
                io.type({
                  originalGateway: io.string,
                  address: io.string,
                }),
              ),
            ),
          }),
        ),
      }),
      once(() => ({
        HDPhrase: ethers.Wallet.createRandom().mnemonic.phrase,
        nextHDIndex: 0,
        wallets: [],
      })),
    ),
    transactions: standardStorage.Cell(
      'transactions',
      io.type({
        outgoing: io.array(QuillTransaction),
      }),
      () => ({ outgoing: [] }),
    ),
    network: standardStorage.Cell('network', ProviderConfig, () => {
      const network = config.builtinNetworks[config.defaultNetwork];

      assert(
        network !== undefined,
        () => new Error('Missing config for default network'),
      );

      return network;
    }),
    preferences: standardStorage.Cell(
      'preferences',
      Preferences,
      async (): Promise<Preferences> => ({
        selectedPublicKeyHash: undefined,
        currency: 'USD',
        theme: 'light',
        defaultPublicKeyHash: undefined,
        contacts: [],
        customTokens: [],
        customNfts: [],
        developerSettings: {
          // For now, default to dev settings that are appropriate for the bls
          // wallet team. FIXME: The defaults that get bundled into the
          // extension should probably be configurable.
          breakOnAssertionFailures: true,
          exposeEthereumRpc: false,
          rpcLogging: {
            background: true,
            inPage: true,
          },
        },
      }),
    ),
  };

  const providerStateCells = {
    chainId: FormulaCell.Sub(rootCells.network, 'chainId'),
    selectedPublicKeyHash: TransformCell.Sub(
      rootCells.preferences,
      'selectedPublicKeyHash',
    ),
    developerSettings: TransformCell.Sub(
      rootCells.preferences,
      'developerSettings',
    ),
  };

  return {
    ...rootCells,
    providerState: new FormulaCell(
      providerStateCells,
      ({ $chainId, $developerSettings, $selectedPublicKeyHash }) => ({
        chainId: $chainId,
        developerSettings: $developerSettings,
        selectedPublicKeyHash: $selectedPublicKeyHash,
      }),
    ),
    ...providerStateCells,

    theme: FormulaCell.Sub(rootCells.preferences, 'theme'),
    currency: TransformCell.Sub(rootCells.preferences, 'currency'),

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
