import * as io from 'io-ts';
import optional from './optional';

export const InternalRpcMap = {
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
    output: io.undefined,
  },

  quill_remove: {
    params: io.tuple([/* key */ io.string]),
    output: io.undefined,
  },
};

type InternalRpc = {
  [K in keyof typeof InternalRpcMap]: (
    ...params: io.TypeOf<typeof InternalRpcMap[K]['params']>
  ) => Promise<io.TypeOf<typeof InternalRpcMap[K]['output']>>;
};

export default InternalRpc;
