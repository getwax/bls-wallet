import React, { useMemo } from 'react';

import {
  AggregatorUtilitiesFactory,
  BlsWalletWrapper,
  MockERC20Factory,
  VerificationGatewayFactory,
} from 'bls-wallet-clients';
import extensionLocalCellCollection from './cells/extensionLocalCellCollection';
import encryptedLocalCellCollection from './cells/encryptedLocalCellCollection';
import assert from './helpers/assert';
import QuillStorageCells from './QuillStorageCells';
import QuillEthereumProvider from './QuillEthereumProvider';
import EthersProvider from './EthersProvider';
import { FormulaCell } from './cells/FormulaCell';
import QuillLongPollingCell from './QuillLongPollingCell';
import TransformCell from './cells/TransformCell';
import forEach from './cells/forEach';
import { loadMultiNetworkConfig } from './MultiNetworkConfig';
import { RpcClient } from './types/Rpc';
import Config, { loadConfig } from './Config';
import { StorageConfig } from './background/QuillController';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);
  assert(ethereum.rpc !== undefined);

  const config = loadConfig();
  const multiNetworkConfig = loadMultiNetworkConfig();

  const storage: StorageConfig = {
    standardStorage: extensionLocalCellCollection,
    encryptedStorage: encryptedLocalCellCollection,
  };

  const cells = QuillContextCells(config, storage, ethereum, ethereum.rpc);

  forEach(cells.onboarding, (onboarding) => {
    if (!onboarding.autoOpened) {
      // Auto-opening is the very first thing that happens, so if it hasn't
      // happened, we should not be open.
      // This is used to make debug.reset() mimic a complete uninstall and
      // reinstall of the extension - all extension pages should close on
      // uninstall.
      window.close();
    }
  });

  const networkAndEthersProvider = new FormulaCell(
    { network: cells.network },
    ({ $network }) => ({
      network: $network,
      ethersProvider: EthersProvider(ethereum),
    }),
  );

  const debugUtils = new FormulaCell(
    { networkAndEthersProvider, keyring: cells.keyring },
    ({ $networkAndEthersProvider, $keyring }) => ({
      ...$networkAndEthersProvider,
      keyring: $keyring,
    }),
  );

  forEach(debugUtils, async ({ network, ethersProvider, keyring }) => {
    window.debug ??= {};

    const netCfg = multiNetworkConfig[network.networkKey];

    if (netCfg === undefined) {
      window.debug.contracts = undefined;
      return;
    }

    window.debug.contracts = {
      // eslint-disable-next-line camelcase
      verificationGateway: VerificationGatewayFactory.connect(
        netCfg.addresses.verificationGateway,
        ethersProvider,
      ),
      // eslint-disable-next-line camelcase
      testToken: MockERC20Factory.connect(
        netCfg.addresses.testToken,
        ethersProvider,
      ),
      // eslint-disable-next-line camelcase
      aggregatorUtilities: AggregatorUtilitiesFactory.connect(
        netCfg.addresses.utilities,
        ethersProvider,
      ),
    };

    window.debug.wallets = await Promise.all(
      keyring.wallets.map((w) =>
        BlsWalletWrapper.connect(
          w.privateKey,
          netCfg.addresses.verificationGateway,
          ethersProvider,
        ),
      ),
    );
  });

  return {
    ethereum,
    ethersProvider: FormulaCell.Sub(networkAndEthersProvider, 'ethersProvider'),
    rpc: ethereum.rpc,
    cells,
    config,
    multiNetworkConfig,
  };
}

const QuillContext = React.createContext<QuillContextValue>(
  // QuillEthereumProvider render will ensure this is set properly
  // before other components load.
  {} as QuillContextValue,
);

export function useQuill() {
  return React.useContext(QuillContext);
}

type Props = {
  children: React.ReactNode;
};

export function QuillContextProvider({ children }: Props) {
  const quill = useMemo(() => getQuillContextValue(), []);

  window.debug ??= {};
  window.debug.quill = quill;

  return (
    <QuillContext.Provider value={quill}>{children}</QuillContext.Provider>
  );
}

function QuillContextCells(
  config: Config,
  storage: StorageConfig,
  ethereum: QuillEthereumProvider,
  rpc: RpcClient,
) {
  const storageCells = QuillStorageCells(
    config,
    storage.standardStorage,
    storage.encryptedStorage,
  );

  const rpcLogging = TransformCell.Sub(
    storageCells.developerSettings,
    'rpcLogging',
  );

  return {
    ...storageCells,
    networkJson: new FormulaCell(
      { network: storageCells.network },
      ({ $network }) => JSON.stringify($network, null, 2),
    ),
    blockNumber: QuillLongPollingCell(ethereum, 'blockNumber'),
    rpcBackgroundLogging: TransformCell.Sub(rpcLogging, 'background'),
    rpcInPageLogging: TransformCell.Sub(rpcLogging, 'inPage'),
    currencyConversion: QuillLongPollingCell(ethereum, 'currencyConversion'),
    networkDisplayName: new TransformCell(
      storageCells.network,
      ($network) => $network.displayName,
      ($network, newDisplayName) => {
        for (const builtinNetwork of Object.values(config.builtinNetworks)) {
          if (builtinNetwork?.displayName === newDisplayName) {
            return builtinNetwork;
          }
        }

        console.error(`Network not found: ${newDisplayName}`);
        return $network;
      },
    ),
    ethAccounts: new FormulaCell(
      { network: storageCells.network, keyring: storageCells.keyring },
      () => rpc.eth_accounts(),
    ),
    selectedAddress: new FormulaCell(
      {
        selectedPublicKeyHash: storageCells.selectedPublicKeyHash,
        network: storageCells.network,
      },
      ({ $selectedPublicKeyHash }) =>
        $selectedPublicKeyHash && rpc.pkHashToAddress($selectedPublicKeyHash),
    ),
  };
}
