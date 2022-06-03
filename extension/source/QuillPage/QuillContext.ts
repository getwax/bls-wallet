import { createContext, useContext } from 'react';
import mapValues from '../helpers/mapValues';
import assert from '../helpers/assert';

import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, { rpcMap } from '../types/Rpc';

export default class QuillContext {
  rpc: Rpc;

  constructor(public ethereum: QuillInPageProvider) {
    this.rpc = {
      public: mapValues(rpcMap.public, ({ output }, method) => {
        return async (...params: unknown[]) => {
          const response = await this.ethereum.request({ method, params });
          assert(output.is(response));
          return response as ExplicitAny;
        };
      }),
      private: mapValues(rpcMap.private, ({ output }, method) => {
        return async (...params: unknown[]) => {
          const response = await this.ethereum.request({ method, params });
          assert(output.is(response));
          return response as ExplicitAny;
        };
      }),
    };
  }

  private static context = createContext<QuillContext>({} as QuillContext);
  static Provider = QuillContext.context.Provider;

  static use() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useContext(QuillContext.context);
  }
}
