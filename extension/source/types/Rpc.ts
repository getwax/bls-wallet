import * as io from 'io-ts';
import TypedEventEmitter from 'typed-emitter';

import assert from '../helpers/assert';
import emptyTuple from './emptyTuple';
import ExplicitAny from './ExplicitAny';

export const rpcMap = {
  public: {
    eth_accounts: {
      params: emptyTuple,
      output: io.array(io.string),
    },
    debugMe: {
      params: io.tuple([io.string, io.number, io.string]),
      output: io.literal('ok'),
    },
    quill_breakOnAssertionFailures: {
      params: io.tuple([
        /** differentFrom: only reply when different from this value */
        io.union([io.undefined, io.boolean]),
      ]),
      output: io.boolean,
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

export const notificationEventMap = {
  accountsChanged: io.array(io.string),
  unlockStateChanged: io.type({
    accounts: io.array(io.string),
    isUnlocked: io.boolean,
  }),
  chainChanged: io.string,
};

export type NotificationEventMap = {
  [E in NotificationEventName]: io.TypeOf<typeof notificationEventMap[E]>;
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

export const PublicRpcMethodName: io.Type<keyof RpcMap['public']> = io.union(
  Object.keys(rpcMap.public).map((k) => io.literal(k)) as ExplicitAny,
);

export type PublicRpcMethodName = io.TypeOf<typeof PublicRpcMethodName>;

export const PrivateRpcMessage = io.type({
  type: io.literal('quill-private-rpc'),
  method: io.string,
  params: io.array(io.unknown),
});

export type PrivateRpcMessage = io.TypeOf<typeof PrivateRpcMessage>;

export const PublicRpcMessage = io.type({
  type: io.literal('quill-public-rpc'),
  id: io.string,
  providerId: io.string,
  origin: io.string,
  method: io.string,
  params: io.array(io.unknown),
});

export const EventsPortInfo = io.type({
  type: io.literal('quill-events-port'),
  providerId: io.string,
  origin: io.string,
});

export type EventsPortInfo = io.TypeOf<typeof EventsPortInfo>;

export type PublicRpcMessage = io.TypeOf<typeof PublicRpcMessage>;

export const PublicRpcResponse = io.type({
  type: io.literal('quill-public-rpc-response'),
  id: io.string,
  result: io.union([
    io.type({ ok: io.unknown }),
    io.type({ error: io.type({ message: io.string, stack: io.string }) }),
  ]),
});

export type PublicRpcResponse = io.TypeOf<typeof PublicRpcResponse>;

export type PublicRpc = Rpc['public'];
export type PrivateRpc = Rpc['private'];

export type PublicRpcWithOrigin = {
  [M in keyof PublicRpc]: (
    origin: string,
    params: Parameters<PublicRpc[M]>,
  ) => ReturnType<PublicRpc[M]>;
};

export type NotificationEventName = keyof typeof notificationEventMap;

export const NotificationEventName: io.Type<NotificationEventName> = io.union(
  Object.keys(notificationEventMap).map((eventName) =>
    io.literal(eventName),
  ) as ExplicitAny,
);

export type Notification = {
  [E in NotificationEventName]: {
    origin: string;
    eventName: E;
    value: io.TypeOf<typeof notificationEventMap[E]>;
  };
}[NotificationEventName];

export const Notification: io.Type<Notification> = io.union(
  Object.entries(notificationEventMap).map(([eventName, type]) =>
    io.type({
      origin: io.string,
      eventName: io.literal(eventName),
      value: type,
    }),
  ) as ExplicitAny,
);

export type NotificationEventEmitter = new () => TypedEventEmitter<
  {
    [E in NotificationEventName]: (value: NotificationEventMap[E]) => void;
  } & {
    newListener(eventName: NotificationEventName): void;
    removeListener(eventName: NotificationEventName): void;
  }
>;

export const SetEventEnabledMessage = io.type({
  type: io.literal('set-event-enabled'),
  eventName: NotificationEventName,
  enabled: io.boolean,
});

export type SetEventEnabledMessage = io.TypeOf<typeof SetEventEnabledMessage>;

export default Rpc;
