import * as io from 'io-ts';
import React from 'react';
import { ethers } from 'ethers';

import getWindowQuillProvider from './getWindowQuillProvider';
import mapValues from '../helpers/mapValues';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, { rpcMap } from '../types/Rpc';
import CellCollection from '../cells/CellCollection';
import ICell, { IReadableCell } from '../cells/ICell';
import elcc from '../cells/extensionLocalCellCollection';
import TimeCell from './TimeCell';
import { FormulaCell } from '../cells/FormulaCell';
import approximate from './approximate';
import assertType from '../cells/assertType';

type QuillContextValue = {
  provider: QuillInPageProvider;
  ethersProvider: ethers.providers.Web3Provider;
  rpc: Rpc;
  Cell: CellCollection['Cell'];
  time: IReadableCell<number>;
  blockNumber: IReadableCell<number>;
  theme: ICell<string>;
};

function getQuillContextValue(
  provider: QuillInPageProvider,
): QuillContextValue {
  const Cell = elcc.Cell.bind(elcc);
  const time = TimeCell(100);

  const blockNumber = new FormulaCell(
    { _: approximate(time, 5000) },
    async () => {
      console.log('getting block number');
      return Number(await provider.request({ method: 'eth_blockNumber' }));
    },
  );

  // FIXME: This cell has an awkward name due to an apparent collision with
  // theming coming from the old controller system. It should simply be named
  // 'theme', but this requires updating the controllers, which is out of scope
  // for now.
  const theme = Cell('cell-based-theme', io.string, 'light');

  return {
    provider,
    ethersProvider: new ethers.providers.Web3Provider(provider),
    rpc: {
      public: mapValues(
        rpcMap.public,
        ({ params: paramsType, output }, method) => {
          return async (...params: unknown[]) => {
            assertType(params, paramsType);
            const response = await provider.request({
              method,
              params,
            });
            assertType(response, output);
            return response as ExplicitAny;
          };
        },
      ),
      private: mapValues(
        rpcMap.private,
        ({ params: paramsType, output }, method) => {
          return async (...params: unknown[]) => {
            assertType(params, paramsType as unknown as io.Type<unknown[]>);
            const response = await provider.request({
              method,
              params,
            });
            assertType(response, output as io.Type<unknown>);
            return response as ExplicitAny;
          };
        },
      ),
    },
    Cell,
    time,
    blockNumber,
    theme,
  };
}

const QuillContext = React.createContext<QuillContextValue>(
  // QuillProvider render will ensure this is set properly
  // before other components load.
  {} as QuillContextValue,
);

export function useQuill() {
  return React.useContext(QuillContext);
}

type Props = {
  children: React.ReactNode;
};

export function QuillProvider({ children }: Props) {
  const [ctxVal, setCtxVal] = React.useState<QuillContextValue | undefined>();

  React.useEffect(() => {
    (async () => {
      const provider = await getWindowQuillProvider();
      const val = getQuillContextValue(provider);
      setCtxVal(val);
    })();
  }, []);

  if (!ctxVal) {
    // This could be replaced by a nicer splash screen
    return <div>Loading...</div>;
  }

  return (
    <QuillContext.Provider value={ctxVal}>{children}</QuillContext.Provider>
  );
}
