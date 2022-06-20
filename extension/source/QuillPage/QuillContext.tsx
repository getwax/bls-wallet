import * as io from 'io-ts';
import React, { useMemo } from 'react';

import mapValues from '../helpers/mapValues';
import { EthereumRequestBody, RpcClient, rpcMap } from '../types/Rpc';
import elcc from '../cells/extensionLocalCellCollection';
import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import QuillStorageCells from '../QuillStorageCells';
import QuillEthereumProvider from '../QuillEthereumProvider';
import EthersProvider from '../EthersProvider';
import CellCollection from '../cells/CellCollection';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);

  // TODO: MEGAFIX: Replace this with window.ethereum.rpc
  const rpc = mapValues(rpcMap, ({ Params, Response }, method) => {
    return async (...params: unknown[]) => {
      assertType(params, Params as unknown as io.Type<unknown[]>);

      const request = {
        method,
        params,
      } as EthereumRequestBody<string>;

      const response = await ethereum.request(request);
      assertType(response, Response as io.Type<unknown>);

      return response;
    };
  }) as RpcClient;

  return {
    ethereum,
    ethersProvider: EthersProvider(ethereum),
    rpc,
    cells: QuillContextCells(elcc, rpc),
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

function QuillContextCells(storage: CellCollection, _rpc: RpcClient) {
  const storageCells = QuillStorageCells(storage);

  return {
    ...storageCells,
    // TODO: MEGAFIX: Add blockNumber here
  };
}
