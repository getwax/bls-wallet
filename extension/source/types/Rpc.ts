import * as io from 'io-ts';

import assert from '../helpers/assert';
import emptyTuple from './emptyTuple';
import ExplicitAny from './ExplicitAny';

export const rpcMap = {
  public: {
    eth_accounts: {
      params: emptyTuple,
      output: io.array(io.string),
    },
  },
  private: {
    setSelectedAddress: {
      params: io.tuple([/* newSelectedAddress */ io.string]),
      output: io.literal('ok'),
    },

    createHDAccount: {
      params: emptyTuple,
      output: io.string,
    },

    isOnboardingComplete: {
      params: emptyTuple,
      output: io.boolean,
    },

    setHDPhrase: {
      params: io.tuple([io.string]),
      output: io.literal('ok'),
    },
  },
};

const publicMethodNames = Object.keys(rpcMap.public);
const privateMethodNames = Object.keys(rpcMap.private);

const overlappingMethodNames = publicMethodNames.filter((publicMethodName) =>
  privateMethodNames.includes(publicMethodName),
);

// Check that public & private rpc don't overlap. This is relevant to security
// because QuillController assumes that private methods can only be called
// privately.
assert(overlappingMethodNames.length === 0);

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

export const PrivateRpcMethodName: io.Type<keyof RpcMap['private']> = io.union(
  Object.keys(rpcMap.private).map((k) => io.literal(k)) as ExplicitAny,
);

export type PrivateRpcMethodName = io.TypeOf<typeof PrivateRpcMethodName>;

export default Rpc;
