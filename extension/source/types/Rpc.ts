import * as io from 'io-ts';
import optional from './optional';

export const rpcMap = {
  public: {
    example: {
      params: io.tuple([io.string]),
      output: io.void,
    },
  },
  private: {
    quill_read: {
      params: io.tuple([
        /* key */ io.string,
        /* defaultValue */ io.unknown,
        /* minVersion */ optional(io.number),
      ]),
      output: io.union([
        io.type({
          version: io.number,
          value: io.unknown,
        }),
        io.literal('ended'),
      ]),
    },

    quill_write: {
      params: io.tuple([/* key */ io.string, /* value */ io.unknown]),
      output: io.void,
    },

    quill_remove: {
      params: io.tuple([/* key */ io.string]),
      output: io.void,
    },

    quill_setSelectedAddress: {
      params: io.tuple([/* newSelectedAddress */ io.string]),
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
