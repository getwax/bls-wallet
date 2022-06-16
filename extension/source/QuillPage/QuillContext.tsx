import * as io from 'io-ts';
import React from 'react';
import { ethers } from 'ethers';

import Browser from 'webextension-polyfill';
import getWindowQuillProvider from './getWindowQuillProvider';
import mapValues from '../helpers/mapValues';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import { rpcMap } from '../types/Rpc';
import { IReadableCell } from '../cells/ICell';
import elcc from '../cells/extensionLocalCellCollection';
import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import { FormulaCell } from '../cells/FormulaCell';
import TimeCell from '../cells/TimeCell';
import QuillCells from '../QuillCells';
import TransformCell from '../cells/TransformCell';

type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue(provider: QuillInPageProvider) {
  const rpc = {
    public: mapValues(
      rpcMap.public,
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
    private: mapValues(
      rpcMap.private,
      ({ params: paramsType, output }, method) => {
        return async (...params: unknown[]) => {
          assertType(params, paramsType as unknown as io.Type<unknown[]>);
          const response = await Browser.runtime.sendMessage(undefined, {
            type: 'quill-private-rpc',
            method,
            params,
          });
          assertType(response, output as io.Type<unknown>);
          return response as ExplicitAny;
        };
      },
    ),
  };

  const Cell = elcc.Cell.bind(elcc);
  const time = TimeCell(100);

  const blockNumber = Cell('block-number', io.number, async () => {
    const blockNumberStr = await provider.request({
      method: 'eth_blockNumber',
    });

    assertType(blockNumberStr, io.string);
    assert(Number.isFinite(Number(blockNumberStr)));

    return Number(blockNumberStr);
  });

  // FIXME: This cell has an awkward name due to an apparent collision with
  // theming coming from the old controller system. It should simply be named
  // 'theme', but this requires updating the controllers, which is out of scope
  // for now.
  const theme = Cell('cell-based-theme', io.string, () => 'light');

  // TODO: Cleanup other cells
  const cells = QuillCells(elcc);

  const selectedAddress: IReadableCell<string | undefined> = new FormulaCell(
    { preferences: cells.preferences },
    ({ preferences }) => preferences.selectedAddress,
  );

  return {
    provider,
    ethersProvider: new ethers.providers.Web3Provider(provider),
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

export function QuillContextProvider({ children }: Props) {
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
