import React from 'react';
import getWindowQuillProvider from './getWindowQuillProvider';
import assert from '../helpers/assert';
import mapValues from '../helpers/mapValues';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, { rpcMap } from '../types/Rpc';

type QuillContextValue = {
  provider: QuillInPageProvider;
  rpc: Rpc;
};

function getQuillContextValue(
  provider: QuillInPageProvider,
): QuillContextValue {
  return {
    provider,
    rpc: {
      public: mapValues(
        rpcMap.public,
        ({ params: paramsType, output }, method) => {
          return async (...params: unknown[]) => {
            assert(paramsType.is(params));
            const response = await provider.request({
              method,
              params,
            });
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
            const response = await provider.request({
              method,
              params,
            });
            assert(output.is(response));
            return response as ExplicitAny;
          };
        },
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
