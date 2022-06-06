import * as io from 'io-ts';
import { createContext, useContext } from 'react';
import { ethers } from 'ethers';

import mapValues from '../helpers/mapValues';
import assert from '../helpers/assert';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, { rpcMap } from '../types/Rpc';
import TimeCell from './TimeCell';
import approximate from './approximate';
import { FormulaCell } from '../cells/FormulaCell';
import ICell, { IReadableCell } from '../cells/ICell';
import elcc from '../cells/extensionLocalCellCollection';

export default class QuillContext {
  ethersProvider: ethers.providers.Provider;
  rpc: Rpc;
  time = TimeCell(100);
  blockNumber: IReadableCell<number>;
  theme: ICell<string>;

  constructor(public ethereum: QuillInPageProvider) {
    this.ethersProvider = new ethers.providers.Web3Provider(ethereum);

    this.rpc = {
      public: mapValues(
        rpcMap.public,
        ({ params: paramsType, output }, method) => {
          return async (...params: unknown[]) => {
            assert(paramsType.is(params));
            const response = await this.ethereum.request({ method, params });
            assert(output.is(response));
            return response as ExplicitAny;
          };
        },
      ),
      private: mapValues(
        rpcMap.private,
        ({ params: paramsType, output }, method) => {
          return async (...params: unknown[]) => {
            assert(paramsType.is(params));
            const response = await this.ethereum.request({ method, params });
            assert(output.is(response));
            return response as ExplicitAny;
          };
        },
      ),
    };

    this.blockNumber = new FormulaCell(
      { _: approximate(this.time, 5000) },
      async () => {
        console.log('getting block number');
        return Number(
          await this.ethereum.request({ method: 'eth_blockNumber' }),
        );
      },
    );

    this.theme = elcc.Cell('theme', io.string, 'light');
  }

  private static context = createContext<QuillContext>({} as QuillContext);
  static Provider = QuillContext.context.Provider;

  static use() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useContext(QuillContext.context);
  }
}
