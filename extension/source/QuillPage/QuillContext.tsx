import * as io from 'io-ts';
import React, { useMemo } from 'react';
import { ethers } from 'ethers';

import mapValues from '../helpers/mapValues';
import ExplicitAny from '../types/ExplicitAny';
import { RpcClient, rpcMap } from '../types/Rpc';
import { IReadableCell } from '../cells/ICell';
import elcc from '../cells/extensionLocalCellCollection';
import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import { FormulaCell } from '../cells/FormulaCell';
import TimeCell from '../cells/TimeCell';
import QuillCells from '../QuillCells';
import TransformCell from '../cells/TransformCell';
import QuillEthereumProvider from '../QuillEthereumProvider';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);

  const rpc = mapValues(rpcMap, ({ params: paramsType, output }, method) => {
    return async (...params: unknown[]) => {
      assertType(params, paramsType as unknown as io.Type<unknown[]>);
      const response = await ethereum.request({
        method,
        params,
      });
      assertType(response, output as io.Type<unknown>);
      return response as ExplicitAny;
    };
  }) as RpcClient;

  const Cell = elcc.Cell.bind(elcc);
  const time = TimeCell(100);

  const blockNumber = Cell('block-number', io.number, async () => {
    const blockNumberStr = await ethereum.request({
      method: 'eth_blockNumber',
    });

    assertType(blockNumberStr, io.string);
    assert(Number.isFinite(Number(blockNumberStr)));

    return Number(blockNumberStr);
  });

  // FIXME: MEGAFIX: This cell has an awkward name due to an apparent collision with
  // theming coming from the old controller system. It should simply be named
  // 'theme', but this requires updating the controllers, which is out of scope
  // for now.
  const theme = Cell('cell-based-theme', io.string, () => 'light');

  // TODO: MEGAFIX: Cleanup other cells
  const cells = QuillCells(elcc);

  const selectedAddress: IReadableCell<string | undefined> = new FormulaCell(
    { preferences: cells.preferences },
    ({ preferences }) => preferences.selectedAddress,
  );

  return {
    ethereum,
    ethersProvider: new ethers.providers.Web3Provider(ethereum),
    rpc,
    Cell,
    time,
    blockNumber,
    theme,
    selectedAddress,
    cells: {
      ...cells,
      breakOnAssertionFailures: TransformCell.SubWithDefault(
        cells.preferences,
        'breakOnAssertionFailures',
        false,
      ),
    },
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
