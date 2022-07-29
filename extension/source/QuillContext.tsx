import React, { useMemo } from 'react';

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
import { StorageConfig } from './background/QuillController';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);
  assert(ethereum.rpc !== undefined);

  const storage: StorageConfig = {
    standardStorage: extensionLocalCellCollection,
    encryptedStorage: encryptedLocalCellCollection,
  };

  const cells = QuillContextCells(storage, ethereum);

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

  return {
    ethereum,
    ethersProvider: EthersProvider(ethereum),
    rpc: ethereum.rpc,
    cells,
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
  storage: StorageConfig,
  ethereum: QuillEthereumProvider,
) {
  const storageCells = QuillStorageCells(
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
  };
}
