import { createContext, useContext } from 'react';
import mapValues from '../cells/mapValues';
import assert from '../helpers/assert';

import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import InternalRpc, { InternalRpcMap } from '../types/InternalRpc';

export default class QuillContext {
  internalRpc: InternalRpc;

  constructor(public ethereum: QuillInPageProvider) {
    this.internalRpc = mapValues(InternalRpcMap, ({ output }, method) => {
      return async (...params: unknown[]) => {
        const response = await this.ethereum.request({ method, params });
        assert(output.is(response));
        return response as ExplicitAny;
      };
    });
  }

  private static context = createContext<QuillContext>({} as QuillContext);
  static Provider = QuillContext.context.Provider;

  static use() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useContext(QuillContext.context);
  }
}
