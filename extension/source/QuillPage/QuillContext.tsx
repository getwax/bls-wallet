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

  const time = TimeCell(100);

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
    time,
    selectedAddress,
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
