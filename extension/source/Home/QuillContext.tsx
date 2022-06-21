import React, { useMemo } from 'react';

import elcc from '../cells/extensionLocalCellCollection';
import assert from '../helpers/assert';
import QuillStorageCells from '../QuillStorageCells';
import QuillEthereumProvider from '../QuillEthereumProvider';
import EthersProvider from '../EthersProvider';
import CellCollection from '../cells/CellCollection';
import { FormulaCell } from '../cells/FormulaCell';
import QuillLongPollingCell from '../QuillLongPollingCell';
import TransformCell from '../cells/TransformCell';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);
  assert(ethereum.rpc !== undefined);

  return {
    ethereum,
    ethersProvider: EthersProvider(ethereum),
    rpc: ethereum.rpc,
    cells: QuillContextCells(elcc, ethereum),
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
  storage: CellCollection,
  ethereum: QuillEthereumProvider,
) {
  const storageCells = QuillStorageCells(storage);

  const rpcLogging = TransformCell.Sub(
    storageCells.developerSettings,
    'rpcLogging',
  );

  return {
    ...storageCells,
    networkJson: new FormulaCell(
      { network: storageCells.network },
      ({ network }) => JSON.stringify(network, null, 2),
    ),
    blockNumber: QuillLongPollingCell(ethereum, 'blockNumber'),
    rpcBackgroundLogging: TransformCell.Sub(rpcLogging, 'background'),
    rpcInPageLogging: TransformCell.Sub(rpcLogging, 'inPage'),
  };
}
