import * as io from 'io-ts';
import assertType from '../cells/assertType';
import isType from '../cells/isType';

import { Result } from '../helpers/toOkError';
import AsyncReturnType from './AsyncReturnType';
import emptyTuple from './emptyTuple';
import ExplicitAny from './ExplicitAny';
import optional from './optional';

// TODO: MEGAFIX: Make a tuple wrapper handling empty and also preventing accidental
// undefineds

export const ProviderState = io.type({
  chainId: io.string,
  selectedAddress: io.union([io.undefined, io.string]),
  developerSettings: io.type({
    breakOnAssertionFailures: io.boolean,
    exposeEthereumRpc: io.boolean,
  }),
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
    Params: emptyTuple,
    Response: io.string,
  },
  eth_getTransactionByHash: {
    origin: '*',
    Params: io.tuple([io.string]),
    Response: io.type({
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
    Params: io.tuple([io.string]),
    Response: optional(
      io.type({
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
    ),
  },
  debugMe: {
    origin: '*',
    Params: io.tuple([io.string, io.number, io.string]),
    Response: io.literal('ok'),
  },
  quill_providerState: {
    origin: '*',
    Params: io.tuple([
      io.union([io.null, io.type({ differentFrom: ProviderState })]),
    ]),
    Response: ProviderState,
  },
  addAccount: {
    origin: '<quill>',
    Params: io.tuple([io.union([io.undefined, io.string])]),
    Response: io.string,
  },

  // KeyringController

  eth_accounts: {
    origin: '*',
    Params: emptyTuple,
    Response: io.array(io.string),
  },
  eth_coinbase: {
    origin: '*',
    Params: emptyTuple,
    Response: io.union([io.null, io.string]),
  },
  eth_requestAccounts: {
    origin: '*',
    Params: emptyTuple,
    Response: io.array(io.string),
  },
  addHDAccount: {
    origin: '<quill>',
    Params: emptyTuple,
    Response: io.string,
  },
  isOnboardingComplete: {
    origin: '<quill>',
    Params: emptyTuple,
    Response: io.boolean,
  },
  setHDPhrase: {
    origin: '<quill>',
    Params: io.tuple([io.string]),
    Response: io.literal('ok'),
  },
  lookupPrivateKey: {
    origin: '<quill>',
    Params: io.tuple([io.string]),
    Response: io.string,
  },
  removeAccount: {
    origin: '<quill>',
    Params: io.tuple([io.string]),
    Response: io.void, // TODO: MEGAFIX: 'ok's should also be io.void
  },

  // AggregatorController

  eth_sendTransaction: {
    origin: '*',
    Params: io.array(SendTransactionParams),
    Response: io.string,
  },
  eth_setPreferredAggregator: {
    origin: '*',
    Params: io.tuple([io.string]),
    Response: io.literal('ok'),
  },

  // PreferencesController

  setSelectedAddress: {
    origin: '<quill>',
    Params: io.tuple([/* newSelectedAddress */ io.string]),
    Response: io.literal('ok'),
  },

  // LongPollingController

  longPoll: {
    origin: '<quill>',
    Params: io.tuple([
      io.type({
        cellName: io.string,
        longPollingId: io.string,
        differentMaybe: optional(
          io.type({
            value: io.unknown,
          }),
        ),
      }),
    ]),
    Response: io.union([
      io.literal('please-retry'),
      io.literal('cancelled'),
      io.type({
        value: io.unknown,
      }),
    ]),
  },

  longPollCancel: {
    origin: '<quill>',
    Params: io.tuple([
      io.type({
        longPollingId: io.string,
      }),
    ]),
    Response: io.void,
  },
};

export type RpcMap = typeof rpcMap;

export const RpcMethodName: io.Type<keyof RpcMap> = io.union(
  Object.keys(rpcMap).map((k) => io.literal(k)) as ExplicitAny,
);

export type RpcMethodName = io.TypeOf<typeof RpcMethodName>;

// TODO: MEGAFIX: Message -> Request
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
  params: io.TypeOf<RpcMap[M]['Params']>;
  Params: RpcMap[M]['Params'];
  Response: RpcMap[M]['Response'];
  callInternal: <M2 extends RpcMethodName>(
    methodName: M2,
  ) => (
    ...params: RpcMethodMessage<M2>['params']
  ) => io.TypeOf<RpcMap[M2]['Response']>;
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
  ) => Promise<io.TypeOf<RpcMap[M]['Response']>>;
};

export type PartialRpcImpl = {
  [M in RpcMethodName]?: (
    message: RpcMethodMessage<M>,
  ) => Promise<AsyncReturnType<RpcImpl[M]> | undefined>;
};

export type RpcClient = {
  [M in RpcMethodName]: (
    ...params: RpcMethodMessage<M>['params']
  ) => Promise<io.TypeOf<RpcMap[M]['Response']>>;
};

export type EthereumRequestBody<M extends string> = {
  method: M;
  params: M extends RpcMethodName ? RpcMethodMessage<M>['params'] : unknown[];
};

// FIXME: MEGAFIX: Lints are only warnings!

export const EthereumRequestBody = io.union(
  Object.entries(rpcMap).map(([methodName, { Params }]) =>
    io.type({
      method: io.literal(methodName),
      params: Params,
    }),
  ) as ExplicitAny,
);

export function assertEthereumRequestBody(
  body: unknown,
): asserts body is EthereumRequestBody<string> {
  assertType(
    body,
    io.type({
      method: io.string,
      params: io.array(io.unknown),
    }),
  );

  if (isType(body.method, RpcMethodName)) {
    assertType(body.params, rpcMap[body.method].Params as io.Type<unknown>);
  }
}
