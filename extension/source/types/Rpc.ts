import * as io from 'io-ts';

import emptyTuple from './emptyTuple';

export const rpcMap = {
  public: {
    eth_accounts: {
      params: emptyTuple,
      output: io.array(io.string),
    },
  },
  private: {
    quill_setSelectedAddress: {
      params: io.tuple([/* newSelectedAddress */ io.string]),
      output: io.void,
    },

    quill_createHDAccount: {
      params: emptyTuple,
      output: io.string,
    },

    quill_isOnboardingComplete: {
      params: emptyTuple,
      output: io.boolean,
    },

    quill_setHDPhrase: {
      params: io.tuple([io.string]),
      output: io.void,
    },
  },
};

export type RpcMap = typeof rpcMap;

type Rpc = {
  public: {
    [K in keyof RpcMap['public']]: (
      ...params: io.TypeOf<RpcMap['public'][K]['params']>
    ) => Promise<io.TypeOf<RpcMap['public'][K]['output']>>;
  };
  private: {
    [K in keyof RpcMap['private']]: (
      ...params: io.TypeOf<RpcMap['private'][K]['params']>
    ) => Promise<io.TypeOf<RpcMap['private'][K]['output']>>;
  };
};

export default Rpc;
