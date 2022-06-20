import * as io from 'io-ts';

import { Result } from '../helpers/toOkError';
import AsyncReturnType from './AsyncReturnType';
import emptyTuple from './emptyTuple';
import ExplicitAny from './ExplicitAny';

// TODO: MEGAFIX: Make a tuple wrapper handling empty and also preventing accidental
// undefineds

export const ProviderState = io.type({
  chainId: io.string,
  selectedAddress: io.union([io.undefined, io.string]),
  breakOnAssertionFailures: io.boolean,
});

export type ProviderState = io.TypeOf<typeof ProviderState>;

export const SendTransactionParams = io.type({
  from: io.string,
  to: io.string,
  gas: io.union([io.undefined, io.string]),
  gasPrice: io.union([io.undefined, io.string]),
  value: io.union([io.undefined, io.string]),
  data: io.string,
});

export type SendTransactionParams = io.TypeOf<typeof SendTransactionParams>;

export const rpcMap = {
  // QuillController
  // - ALL rpc methods are technically implemented by QuillController. It
  //   defines the delegation to other controllers.
  // - Some of these methods, (e.g. eth_getTransactionByHash) are mostly handled
  //   by other controllers (e.g. AggregatorController). However, they aren't
  //   listed under the other controller unless QuillController delegates to
  //   them unconditionally.

  eth_chainId: {
    origin: '*',
    params: emptyTuple,
    output: io.string,
  },
  eth_getTransactionByHash: {
    origin: '*',
    params: io.tuple([io.string]),
    output: io.type({
      hash: io.string,
      from: io.string,
      nonce: io.string,
      value: io.string,
      gasLimit: io.string,
      data: io.string,
    }),
  },
  eth_getTransactionReceipt: {
    origin: '*',
    params: io.tuple([io.string]),
    output: io.type({
      transactionHash: io.string,
      transactionIndex: io.string,
      blockHash: io.string,
      blockNumber: io.string,
      from: io.string,
      to: io.string,
      logs: io.array(io.unknown),
      cumulativeGasUsed: io.string,
      gasUsed: io.string,
      status: io.string,
      effectiveGasPrice: io.string,
    }),
  },
  debugMe: {
    origin: '*',
    params: io.tuple([io.string, io.number, io.string]),
    output: io.literal('ok'),
  },
  quill_providerState: {
    origin: '*',
    params: io.tuple([
      io.union([io.null, io.type({ differentFrom: ProviderState })]),
    ]),
    output: ProviderState,
  },
  addAccount: {
    origin: '<quill>',
    params: io.tuple([io.union([io.undefined, io.string])]),
    output: io.string,
  },

  // KeyringController

  eth_accounts: {
    origin: '*',
    params: emptyTuple,
    output: io.array(io.string),
  },
  eth_coinbase: {
    origin: '*',
    params: emptyTuple,
    output: io.union([io.null, io.string]),
  },
  eth_requestAccounts: {
    origin: '*',
    params: emptyTuple,
    output: io.array(io.string),
  },
  addHDAccount: {
    origin: '<quill>',
    params: emptyTuple,
    output: io.string,
  },
  isOnboardingComplete: {
    origin: '<quill>',
    params: emptyTuple,
    output: io.boolean,
  },
  setHDPhrase: {
    origin: '<quill>',
    params: io.tuple([io.string]),
    output: io.literal('ok'),
  },
  lookupPrivateKey: {
    origin: '<quill>',
    params: io.tuple([io.string]),
    output: io.string,
  },
  removeAccount: {
    origin: '<quill>',
    params: io.tuple([io.string]),
    output: io.void, // TODO: MEGAFIX: 'ok's should also be io.void
  },

  // AggregatorController

  eth_sendTransaction: {
    origin: '*',
    params: io.array(SendTransactionParams),
    output: io.string,
  },
  eth_setPreferredAggregator: {
    origin: '*',
    params: io.tuple([io.string]),
    output: io.literal('ok'),
  },

  // PreferencesController

  setSelectedAddress: {
    origin: '<quill>',
    params: io.tuple([/* newSelectedAddress */ io.string]),
    output: io.literal('ok'),
  },
};

export type RpcMap = typeof rpcMap;

export const RpcMethodName: io.Type<keyof RpcMap> = io.union(
  Object.keys(rpcMap).map((k) => io.literal(k)) as ExplicitAny,
);

export type RpcMethodName = io.TypeOf<typeof RpcMethodName>;

export const RpcMessage = io.type({
  type: io.literal('quill-rpc'),
  id: io.string,
  providerId: io.string,
  origin: io.string,
  method: io.string,
  params: io.array(io.unknown),
});

export type RpcMessage = io.TypeOf<typeof RpcMessage>;

export type RpcMethodMessage<M extends RpcMethodName> = Omit<
  RpcMessage,
  'method' | 'params'
> & {
  method: M;
  params: io.TypeOf<RpcMap[M]['params']>;
  Output: RpcMap[M]['output'];
};

export const RpcResult = io.union([
  io.type({ ok: io.unknown }),
  io.type({
    error: io.type({
      message: io.string,
      stack: io.union([io.undefined, io.string]),
    }),
  }),
]);

export type RpcResult<T> =
  | { ok: T }
  | { error: { message: string; stack?: string } };

export function toRpcResult<T>(result: Result<T>): RpcResult<T> {
  if ('error' in result) {
    console.error('Quill RPC:', result.error);

    return {
      error: {
        message: `Quill RPC: ${result.error.message}`,
        stack: result.error.stack && `Quill RPC: ${result.error.stack}`,
      },
    };
  }

  return result;
}

export const RpcResponse = io.type({
  type: io.literal('quill-rpc-response'),
  id: io.string,
  result: RpcResult,
});

export type RpcResponse = io.TypeOf<typeof RpcResponse>;

export type RpcImpl = {
  [M in RpcMethodName]: (
    message: RpcMethodMessage<M>,
  ) => Promise<io.TypeOf<RpcMap[M]['output']>>;
};

export type PartialRpcImpl = {
  [M in RpcMethodName]?: (
    message: RpcMethodMessage<M>,
  ) => Promise<AsyncReturnType<RpcImpl[M]> | undefined>;
};

export type RpcClient = {
  [M in RpcMethodName]: (
    ...params: RpcMethodMessage<M>['params']
  ) => Promise<io.TypeOf<RpcMap[M]['output']>>;
};

// TODO: MEGAFIX: export type EthereumRequest...
